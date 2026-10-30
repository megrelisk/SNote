import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { registerBackgroundSync } from '@/background';
import { useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { flushPendingUploads } from '@/lib/uploads';
import { drainCaptures, publishSnapshot } from '@/lib/widgets';

/**
 * Keeps home screen widgets in sync with the database while the app runs:
 * republishes the widget snapshot on every data change, ingests Quick Capture
 * notes saved by widgets, and retries queued uploads when back online.
 */
export function WidgetBridge() {
  const { service, user } = useSession();
  const drives = useDrives();
  const folders = useFolders();
  const notes = useNotes();

  useEffect(() => {
    const timer = setTimeout(() => {
      void publishSnapshot({ drives, folders, notes, user });
    }, 600);
    return () => clearTimeout(timer);
  }, [drives, folders, notes, user]);

  useEffect(() => {
    if (!service) return;
    const sync = () => {
      void drainCaptures(service);
      void flushPendingUploads(service);
    };
    sync();
    void registerBackgroundSync();
    const appState = AppState.addEventListener('change', (state) => state === 'active' && sync());
    const net = NetInfo.addEventListener((state) => state.isConnected && void flushPendingUploads(service));
    return () => {
      appState.remove();
      net();
    };
  }, [service]);

  return null;
}
