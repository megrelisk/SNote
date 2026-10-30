import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut } from '@react-native-firebase/auth';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import type { NotesService, SyncStatus, UserProfile } from '@snote/core';
import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { createService } from './firebase';

interface SessionValue {
  ready: boolean;
  user: UserProfile | null;
  service: NotesService | null;
  status: SyncStatus;
  error: string | null;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

let configured = false;
function configureGoogle() {
  if (configured) return;
  configured = true;
  GoogleSignin.configure({
    webClientId: (Constants.expoConfig?.extra?.googleWebClientId as string | undefined) || undefined,
  });
}

/**
 * Google sign-in → Firebase Auth. Firebase persists the session natively, so
 * the user stays signed in across launches, and signing in on a new device or
 * after reinstalling restores all data from Firestore.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ online: true, pendingWrites: false, error: null });

  useEffect(() => {
    configureGoogle();
    return onAuthStateChanged(getAuth(), (u) => {
      setUser(u ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } : null);
      setReady(true);
    });
  }, []);

  const service = useMemo(
    () => (user ? createService(user.uid, (e) => setError(e instanceof Error ? e.message : String(e))) : null),
    [user],
  );

  useEffect(() => service?.store.watchStatus(setStatus), [service]);

  // First sign-in: create starter Drives/Folders once the server confirms the account is empty.
  useEffect(() => {
    if (!service) return;
    return service.store.watch('drives', [], (drives, meta) => {
      if (drives.length === 0 && !meta.fromCache && !meta.hasPendingWrites) service.createStarterContent();
    });
  }, [service]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      configureGoogle();
      if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return;
      const idToken = result.data.idToken;
      if (!idToken) throw new Error('Google did not return an ID token. Check GOOGLE_WEB_CLIENT_ID.');
      await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
    } catch (e) {
      if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    await GoogleSignin.signOut().catch(() => {});
    await fbSignOut(getAuth());
  }, []);

  return (
    <SessionContext.Provider value={{ ready, user, service, status, error, signInWithGoogle, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function useService(): NotesService {
  const { service } = useSession();
  if (!service) throw new Error('Not signed in');
  return service;
}
