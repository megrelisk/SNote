import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppRegistry } from 'react-native';
import { createService, flushWrites } from './lib/firebase';
import { drainCaptures } from './lib/widgets';

/**
 * Background sync for widget captures, running without the app UI:
 *  - Android: the Quick Capture dialog starts `CaptureSyncService`, a headless
 *    JS task, immediately after saving.
 *  - Both platforms: a periodic OS background task drains anything left over
 *    (e.g. captures saved while offline).
 */

export const CAPTURE_SYNC_TASK = 'snote-capture-sync';

/** Waits for Firebase Auth to restore the persisted session; resolves the uid (or null). */
function currentUid(): Promise<string | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      unsubscribe();
      resolve(user?.uid ?? null);
    });
  });
}

export async function syncCapturesHeadless(): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const written = await drainCaptures(createService(uid));
  if (written > 0) await flushWrites();
}

AppRegistry.registerHeadlessTask('SNoteCaptureSync', () => syncCapturesHeadless);

TaskManager.defineTask(CAPTURE_SYNC_TASK, async () => {
  try {
    await syncCapturesHeadless();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(CAPTURE_SYNC_TASK))) {
      await BackgroundTask.registerTaskAsync(CAPTURE_SYNC_TASK, { minimumInterval: 15 });
    }
  } catch (error) {
    console.warn('[snote] background sync unavailable', error);
  }
}
