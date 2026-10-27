package expo.modules.snotewidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Quick Capture widget: Drive and Folder chips (tap to switch target right on
 * the home screen), a "Write a note…" field that opens the lightweight
 * [QuickCaptureActivity] dialog over the launcher, and a To-do shortcut.
 */
class QuickCaptureWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    render(context, manager, ids)
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    ids.forEach { WidgetStore.forgetWidget(context, it) }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
    when (intent.action) {
      ACTION_CYCLE_DRIVE -> WidgetStore.cycleDrive(context, id)
      ACTION_CYCLE_FOLDER -> WidgetStore.cycleFolder(context, id)
      else -> return
    }
    render(context, AppWidgetManager.getInstance(context), intArrayOf(id))
  }

  companion object {
    const val ACTION_CYCLE_DRIVE = "app.snote.widget.CYCLE_DRIVE"
    const val ACTION_CYCLE_FOLDER = "app.snote.widget.CYCLE_FOLDER"

    fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val snapshot = WidgetStore.snapshot(context)
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.widget_quick_capture)
        val target = WidgetStore.captureTarget(context, id)
        val (driveLabel, folderLabel) = WidgetStore.describe(context, target)

        if (!snapshot.signedIn || target == null) {
          views.setTextViewText(R.id.capture_drive_chip, "Open SNote")
          views.setTextViewText(R.id.capture_folder_chip, "to sign in")
          val open = openAppIntent(context, "snote://", id)
          views.setOnClickPendingIntent(R.id.capture_root, open)
          views.setOnClickPendingIntent(R.id.capture_input, open)
          manager.updateAppWidget(id, views)
          continue
        }

        views.setTextViewText(R.id.capture_drive_chip, "$driveLabel  ▾")
        views.setTextViewText(R.id.capture_folder_chip, "📁 $folderLabel  ▾")
        views.setOnClickPendingIntent(R.id.capture_drive_chip, broadcast(context, ACTION_CYCLE_DRIVE, id))
        views.setOnClickPendingIntent(R.id.capture_folder_chip, broadcast(context, ACTION_CYCLE_FOLDER, id))
        views.setOnClickPendingIntent(R.id.capture_input, captureIntent(context, id, prefill = null))
        views.setOnClickPendingIntent(R.id.capture_todo, captureIntent(context, id, prefill = "[ ] "))
        views.setOnClickPendingIntent(R.id.capture_open_app, openAppIntent(context, "snote://", id))
        manager.updateAppWidget(id, views)
      }
    }

    private fun broadcast(context: Context, action: String, id: Int): PendingIntent {
      val intent = Intent(context, QuickCaptureWidgetProvider::class.java)
        .setAction(action)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      return PendingIntent.getBroadcast(
        context,
        action.hashCode() * 31 + id,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun captureIntent(context: Context, id: Int, prefill: String?): PendingIntent {
      val intent = Intent(context, QuickCaptureActivity::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        .putExtra(QuickCaptureActivity.EXTRA_PREFILL, prefill)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      return PendingIntent.getActivity(
        context,
        id * 2 + if (prefill == null) 0 else 1,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    fun openAppIntent(context: Context, uri: String, requestCode: Int): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      return PendingIntent.getActivity(context, 10_000 + requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      render(context, manager, manager.getAppWidgetIds(ComponentName(context, QuickCaptureWidgetProvider::class.java)))
    }
  }
}
