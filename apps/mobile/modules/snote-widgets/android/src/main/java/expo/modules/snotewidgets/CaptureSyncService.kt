package expo.modules.snotewidgets

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Boots the JS runtime without UI and runs the `SNoteCaptureSync` task
 * (registered in `src/background.ts`), which writes queued widget captures into
 * Firestore. Firestore persists them locally first, so captures made offline
 * are uploaded automatically once the device reconnects.
 */
class CaptureSyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(TASK_KEY, Arguments.createMap(), 60_000, true)

  companion object {
    const val TASK_KEY = "SNoteCaptureSync"

    fun start(context: Context) {
      try {
        context.startService(Intent(context, CaptureSyncService::class.java))
        HeadlessJsTaskService.acquireWakeLockNow(context)
      } catch (e: IllegalStateException) {
        // Background start not allowed: the queue is drained on the next app launch / background task.
      }
    }
  }
}
