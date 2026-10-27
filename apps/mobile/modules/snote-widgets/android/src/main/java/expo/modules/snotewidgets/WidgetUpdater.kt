package expo.modules.snotewidgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context

object WidgetUpdater {
  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val captureIds = manager.getAppWidgetIds(ComponentName(context, QuickCaptureWidgetProvider::class.java))
    QuickCaptureWidgetProvider.render(context, manager, captureIds)
    val carouselIds = manager.getAppWidgetIds(ComponentName(context, NotesCarouselWidgetProvider::class.java))
    NotesCarouselWidgetProvider.render(context, manager, carouselIds)
    manager.notifyAppWidgetViewDataChanged(carouselIds, R.id.carousel_stack)
  }
}
