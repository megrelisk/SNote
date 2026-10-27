import NetInfo from '@react-native-community/netinfo';
import * as firestoreModule from '@react-native-firebase/firestore';
import { FirestoreDocStore, NotesService, type FirestoreModularApi } from '@snote/core';

/**
 * React Native Firebase keeps a persistent on-device Firestore cache (enabled
 * by default), so reads work offline, writes are queued locally and pushed to
 * the cloud automatically when the connection returns. Data lives under
 * `users/{uid}` and is restored on any device after signing in again.
 */
const api = firestoreModule as unknown as FirestoreModularApi;

function connectivity(onChange: (online: boolean) => void) {
  return NetInfo.addEventListener((state) => onChange(state.isConnected !== false));
}

export function createService(uid: string, onWriteError?: (e: unknown) => void): NotesService {
  const db = firestoreModule.getFirestore();
  return new NotesService(new FirestoreDocStore(api, db, uid, connectivity), onWriteError);
}

/** Resolves once queued writes reach the server (or after `timeoutMs`). */
export async function flushWrites(timeoutMs = 20_000): Promise<void> {
  const db = firestoreModule.getFirestore();
  await Promise.race([
    firestoreModule.waitForPendingWrites(db),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
