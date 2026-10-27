package expo.modules.snotewidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Samsung Notes–style carousel: a swipeable StackView of note cards (title,
 * Drive/Folder path, latest content preview). Tapping a card opens that exact
 * note in the editor via `snote://note/<id>`. Each widget instance shows the
 * source chosen in [CarouselConfigActivity] (recent, pinned, a Drive or a Folder).
 */
class NotesCarouselWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    render(context, manager, ids)
    manager.notifyAppWidgetViewDataChanged(ids, R.id.carousel_stack)
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    ids.forEach { WidgetStore.forgetWidget(context, it) }
  }

  companion object {
    fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      for (id in ids) manager.updateAppWidget(id, build(context, id))
    }

    fun build(context: Context, id: Int): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_carousel)
      val source = WidgetStore.carouselSource(context, id)
      views.setTextViewText(R.id.carousel_title, WidgetStore.sourceLabel(context, source))

      val serviceIntent = Intent(context, CarouselRemoteViewsService::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      // Unique data URI so each widget instance gets its own factory.
      serviceIntent.data = Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME))
      @Suppress("DEPRECATION")
      views.setRemoteAdapter(R.id.carousel_stack, serviceIntent)
      views.setEmptyView(R.id.carousel_stack, R.id.carousel_empty)

      // Card taps fill in the note deep link.
      val template = Intent(Intent.ACTION_VIEW).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      views.setPendingIntentTemplate(
        R.id.carousel_stack,
        PendingIntent.getActivity(context, 20_000 + id, template, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE),
      )

      views.setOnClickPendingIntent(R.id.carousel_header, QuickCaptureWidgetProvider.openAppIntent(context, "snote://", 30_000 + id))
      val add = Intent(context, QuickCaptureActivity::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      views.setOnClickPendingIntent(
        R.id.carousel_add,
        PendingIntent.getActivity(context, 40_000 + id, add, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
      )
      val configure = Intent(context, CarouselConfigActivity::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      views.setOnClickPendingIntent(
        R.id.carousel_configure,
        PendingIntent.getActivity(context, 50_000 + id, configure, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
      )
      return views
    }
  }
}
