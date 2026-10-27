import { requireOptionalNativeModule } from 'expo';

/**
 * Native bridge to the widget shared storage.
 *
 * - iOS: `UserDefaults(suiteName: <App Group>)`, read by the WidgetKit extension.
 * - Android: `SharedPreferences("snote_widgets")`, read by the App Widget providers
 *   and written by the Quick Capture activity that ships in this module.
 *
 * Returns `null` where the native module is unavailable (Expo Go, web), so the
 * app keeps working without widgets.
 */
export interface SnoteWidgetsModule {
  /** Stores the serialized `WidgetSnapshot` and refreshes every widget. */
  setSnapshot(json: string): void;
  /** JSON array of `PendingCapture` items saved by widgets but not yet synced. */
  getPendingCaptures(): string;
  /** Removes captures that were written to the database. */
  removeCaptures(ids: string[]): void;
  /** Adds a capture to the queue (used when the app itself is offline-capturing for a widget). */
  enqueueCapture(json: string): void;
  /** Forces all widget timelines / RemoteViews to re-render. */
  reloadWidgets(): void;
}

export default requireOptionalNativeModule<SnoteWidgetsModule>('SnoteWidgets');
