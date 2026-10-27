import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import type { Block, MediaRef, NotesService } from '@snote/core';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Attachment uploads with an offline queue. Files are first copied into the
 * app's document directory (so they survive restarts and show immediately),
 * then uploaded to Firebase Storage. When offline, the upload is queued and
 * retried on reconnect; the block is patched with the download URL afterwards.
 */

const QUEUE_KEY = 'snote.pendingUploads';

interface PendingUpload {
  blockId: string;
  localUri: string;
  storagePath: string;
  mimeType: string;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
}

function keepLocalCopy(file: PickedFile, blockId: string): string {
  const dir = new Directory(Paths.document, 'attachments', blockId);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, safeName(file.name));
  if (!target.exists) new File(file.uri).copy(target);
  return target.uri;
}

async function readQueue(): Promise<PendingUpload[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]') as PendingUpload[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingUpload[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function upload(localUri: string, storagePath: string, mimeType: string): Promise<string> {
  const storageRef = ref(getStorage(), storagePath);
  await putFile(storageRef, localUri.replace(/^file:\/\//, ''), { contentType: mimeType });
  return getDownloadURL(storageRef);
}

export async function uploadAttachment(file: PickedFile, blockId: string, uid: string): Promise<MediaRef> {
  const localUri = keepLocalCopy(file, blockId);
  const storagePath = `users/${uid}/attachments/${blockId}/${safeName(file.name)}`;
  const base = { name: file.name, mimeType: file.mimeType, size: file.size, storagePath, localUri };
  const net = await NetInfo.fetch();
  if (net.isConnected !== false) {
    try {
      return { ...base, url: await upload(localUri, storagePath, file.mimeType) };
    } catch (error) {
      console.warn('[snote] upload failed, queued', error);
    }
  }
  await writeQueue([...(await readQueue()), { blockId, localUri, storagePath, mimeType: file.mimeType }]);
  return { ...base, url: '' };
}

let flushing = false;

export async function flushPendingUploads(service: NotesService): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let queue = await readQueue();
    for (const item of [...queue]) {
      const block = await service.store.get('blocks', item.blockId);
      if (block) {
        const url = await upload(item.localUri, item.storagePath, item.mimeType);
        const siblings = await service.once('blocks', [{ field: 'noteId', op: '==', value: block.noteId }]);
        const patched = withUrl(block, url);
        if (patched) service.saveBlock(patched, siblings);
      }
      queue = queue.filter((q) => q.blockId !== item.blockId);
      await writeQueue(queue);
    }
  } catch (error) {
    console.warn('[snote] pending upload retry failed', error);
  } finally {
    flushing = false;
  }
}

function withUrl(block: Block, url: string): Block | null {
  if (block.type === 'image' && block.data.image) return { ...block, data: { ...block.data, image: { ...block.data.image, url } } };
  if (block.type === 'file' && block.data.file) return { ...block, data: { ...block.data, file: { ...block.data.file, url } } };
  return null;
}

/** Best URI to display: the local copy on this device, else the cloud URL. */
export function displayUri(media: MediaRef): string | null {
  if (media.localUri && new File(media.localUri).exists) return media.localUri;
  return media.url || null;
}
