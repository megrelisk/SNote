'use client';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from 'firebase/auth';
import * as fs from 'firebase/firestore';
import {
  FirestoreDocStore,
  MemoryDocStore,
  NotesService,
  COLLECTIONS,
  type MemoryData,
  type SyncStatus,
  type WriteOp,
  type UserProfile,
} from '@snote/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebase, firebaseConfigured } from './firebase';
import { flushPendingUploads } from './uploads';

const LOCAL_KEY = 'snote.local.v1';
const LOCAL_BACKUP_KEY = 'snote.local.v1.imported';
const MODE_KEY = 'snote.mode';

/** Notes written in local mode (this browser), if any are waiting to be moved to an account. */
function readLocalData(): MemoryData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const data = raw ? (JSON.parse(raw) as MemoryData) : null;
    return data && Object.keys(data.notes ?? {}).length > 0 ? data : null;
  } catch {
    return null;
  }
}

export type SessionMode = 'cloud' | 'local';

interface SessionValue {
  ready: boolean;
  mode: SessionMode | null;
  user: UserProfile | null;
  service: NotesService | null;
  status: SyncStatus;
  cloudAvailable: boolean;
  signInWithGoogle(): Promise<void>;
  continueLocally(): void;
  signOut(): Promise<void>;
  /** Number of notes saved in this browser's local mode that can be moved into the signed-in account. */
  localNotesToImport: number;
  importLocalNotes(): Promise<void>;
  dismissLocalImport(): void;
  error: string | null;
}

const SessionContext = createContext<SessionValue | null>(null);

function localStore(): MemoryDocStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return new MemoryDocStore({
    load: () => {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? (JSON.parse(raw) as MemoryData) : null;
      } catch {
        return null;
      }
    },
    save: (data) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
        } catch (error) {
          console.error('[snote] could not persist local data', error);
        }
      }, 250);
    },
  });
}

function browserConnectivity(onChange: (online: boolean) => void) {
  const update = () => onChange(navigator.onLine);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ online: true, pendingWrites: false, error: null });

  // Restore the previous session: Firebase Auth persists the signed-in user in
  // IndexedDB, local mode is remembered in localStorage.
  useEffect(() => {
    const fb = firebase();
    const remembered = localStorage.getItem(MODE_KEY) as SessionMode | null;
    if (!fb) {
      if (remembered === 'local') setMode('local');
      setReady(true);
      return;
    }
    return onAuthStateChanged(fb.auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL });
        setMode('cloud');
      } else {
        setUser(null);
        setMode(localStorage.getItem(MODE_KEY) === 'local' ? 'local' : null);
      }
      setReady(true);
    });
  }, []);

  const service = useMemo(() => {
    if (mode === 'local') return new NotesService(localStore(), (e) => setError(String(e)));
    if (mode === 'cloud' && user) {
      const fb = firebase();
      if (!fb) return null;
      const store = new FirestoreDocStore(fs, fb.db, user.uid, browserConnectivity);
      return new NotesService(store, (e) => setError(e instanceof Error ? e.message : String(e)));
    }
    return null;
  }, [mode, user]);

  useEffect(() => {
    if (!service) return;
    const unsubscribe = service.store.watchStatus(setStatus);
    const flush = () => void flushPendingUploads(service);
    flush();
    window.addEventListener('online', flush);
    return () => {
      unsubscribe();
      window.removeEventListener('online', flush);
    };
  }, [service]);

  // First run: create the starter Drives/Folders once the server confirms the
  // account is genuinely empty (never from a cold offline cache).
  useEffect(() => {
    if (!service) return;
    return service.store.watch('drives', [], (drives, meta) => {
      if (drives.length === 0 && !meta.fromCache && !meta.hasPendingWrites) service.createStarterContent();
    });
  }, [service]);

  // Local-mode notes waiting to be copied into the Google account after sign-in.
  const [localNotesToImport, setLocalNotesToImport] = useState(0);
  useEffect(() => {
    const data = mode === 'cloud' ? readLocalData() : null;
    setLocalNotesToImport(data ? Object.keys(data.notes).length : 0);
  }, [mode]);

  const importLocalNotes = useCallback(async () => {
    const data = readLocalData();
    if (!data || !service || mode !== 'cloud') return;
    const ops: WriteOp[] = [];
    for (const collection of COLLECTIONS) {
      for (const [id, item] of Object.entries(data[collection] ?? {})) {
        ops.push({ kind: 'set', collection, id, data: item as object });
      }
    }
    // Applied to the local Firestore cache at once and uploaded in the background (also offline).
    service.store.write(ops).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // Keep a backup copy instead of deleting, and never offer the import twice.
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(data));
    localStorage.removeItem(LOCAL_KEY);
    setLocalNotesToImport(0);
  }, [service, mode]);

  const dismissLocalImport = useCallback(() => setLocalNotesToImport(0), []);

  const signInWithGoogle = useCallback(async () => {
    const fb = firebase();
    if (!fb) return;
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(fb.auth, provider);
      localStorage.setItem(MODE_KEY, 'cloud');
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(fb.auth, provider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

  const continueLocally = useCallback(() => {
    localStorage.setItem(MODE_KEY, 'local');
    setMode('local');
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(MODE_KEY);
    const fb = firebase();
    if (fb && user) await fbSignOut(fb.auth);
    setUser(null);
    setMode(null);
  }, [user]);

  const value: SessionValue = {
    ready,
    mode,
    user,
    service,
    status,
    cloudAvailable: firebaseConfigured,
    signInWithGoogle,
    continueLocally,
    signOut,
    localNotesToImport,
    importLocalNotes,
    dismissLocalImport,
    error,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function useService(): NotesService {
  const { service } = useSession();
  if (!service) throw new Error('No active notes service');
  return service;
}
