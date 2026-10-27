'use client';

import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import type { Block, MediaRef, NotesService } from '@snote/core';
import { firebase } from './firebase';

/**
 * Attachment uploads with an offline queue: when the browser is offline (or
 * the upload fails) the file is parked in IndexedDB and the block keeps a
 * local preview. `flushPendingUploads` retries on reconnect and patches the
 * block with the final download URL, which then syncs to other devices.
 */

const DB_NAME = 'snote-uploads';
const STORE = 'pending';
const LOCAL_MAX_BYTES = 4 * 1024 * 1024;

interface PendingUpload {
  blockId: string;
  path: string;
  file: Blob;
  name: string;
  mimeType: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'blockId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const pendingUploads = {
  put: (item: PendingUpload) => tx('readwrite', (s) => s.put(item)),
  get: (blockId: string) => tx<PendingUpload | undefined>('readonly', (s) => s.get(blockId)),
  all: () => tx<PendingUpload[]>('readonly', (s) => s.getAll()),
  remove: (blockId: string) => tx('readwrite', (s) => s.delete(blockId)),
};

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadAttachment(file: File, blockId: string, uid: string | null): Promise<MediaRef> {
  const base = { name: file.name || 'file', mimeType: file.type || 'application/octet-stream', size: file.size };
  const fb = firebase();
  if (!fb || !uid) {
    // Local mode: embed small files directly.
    if (file.size > LOCAL_MAX_BYTES) throw new Error('Files over 4 MB need a signed-in account (cloud storage).');
    const url = await readAsDataUrl(file);
    return { ...base, url, storagePath: '' };
  }
  const path = `users/${uid}/attachments/${blockId}/${safeName(base.name)}`;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await pendingUploads.put({ blockId, path, file, name: base.name, mimeType: base.mimeType });
    return { ...base, url: '', storagePath: path, localUri: URL.createObjectURL(file) };
  }
  try {
    const snap = await uploadBytes(storageRef(fb.storage, path), file, { contentType: base.mimeType });
    return { ...base, url: await getDownloadURL(snap.ref), storagePath: path };
  } catch (error) {
    console.warn('[snote] upload failed, queued for retry', error);
    await pendingUploads.put({ blockId, path, file, name: base.name, mimeType: base.mimeType });
    return { ...base, url: '', storagePath: path, localUri: URL.createObjectURL(file) };
  }
}

let flushing = false;

export async function flushPendingUploads(service: NotesService): Promise<void> {
  const fb = firebase();
  if (!fb || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const item of await pendingUploads.all()) {
      const block = await service.store.get('blocks', item.blockId);
      if (!block) {
        await pendingUploads.remove(item.blockId);
        continue;
      }
      const snap = await uploadBytes(storageRef(fb.storage, item.path), item.file, { contentType: item.mimeType });
      const url = await getDownloadURL(snap.ref);
      const siblings = await service.once('blocks', [{ field: 'noteId', op: '==', value: block.noteId }]);
      const patched = withUrl(block, url);
      if (patched) service.saveBlock(patched, siblings);
      await pendingUploads.remove(item.blockId);
    }
  } catch (error) {
    console.warn('[snote] pending upload retry failed', error);
  } finally {
    flushing = false;
  }
}

function withUrl(block: Block, url: string): Block | null {
  if (block.type === 'image' && block.data.image) {
    return { ...block, data: { ...block.data, image: { ...block.data.image, url, localUri: undefined } } };
  }
  if (block.type === 'file' && block.data.file) {
    return { ...block, data: { ...block.data, file: { ...block.data.file, url, localUri: undefined } } };
  }
  return null;
}

/** Resolves a displayable URL for a media ref, falling back to the locally queued blob. */
export async function resolveMediaUrl(media: MediaRef, blockId: string): Promise<string | null> {
  if (media.url) return media.url;
  if (media.localUri?.startsWith('blob:') || media.localUri?.startsWith('data:')) {
    try {
      // Object URLs die with the page; verify before using it.
      const res = await fetch(media.localUri);
      if (res.ok) return media.localUri;
    } catch {
      /* fall through to IndexedDB */
    }
  }
  const pending = await pendingUploads.get(blockId).catch(() => undefined);
  return pending ? URL.createObjectURL(pending.file) : null;
}
