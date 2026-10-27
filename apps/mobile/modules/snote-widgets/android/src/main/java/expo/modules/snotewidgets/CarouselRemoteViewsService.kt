package expo.modules.snotewidgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService

class CarouselRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    CarouselFactory(applicationContext, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID))
}

private class CarouselFactory(private val context: Context, private val widgetId: Int) : RemoteViewsService.RemoteViewsFactory {
  private var cards: List<WidgetStore.Card> = emptyList()

  override fun onCreate() {}

  override fun onDataSetChanged() {
    cards = WidgetStore.cardsFor(context, WidgetStore.carouselSource(context, widgetId), limit = 15)
  }

  override fun onDestroy() {
    cards = emptyList()
  }

  override fun getCount(): Int = cards.size

  override fun getViewAt(position: Int): RemoteViews {
    val card = cards.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.item_carousel_card)
    return RemoteViews(context.packageName, R.layout.item_carousel_card).apply {
      setTextViewText(R.id.card_title, (if (card.pinned) "📌 " else "") + card.title)
      setTextViewText(R.id.card_path, "${card.driveIcon} ${card.driveName} / ${card.folderName}")
      setTextViewText(R.id.card_preview, card.preview.ifBlank { "Empty note" })
      setTextViewText(R.id.card_updated, card.updatedAtLabel)
      setTextViewText(R.id.card_position, "${position + 1} / ${cards.size}")
      setOnClickFillInIntent(R.id.card_root, Intent().setData(Uri.parse(card.deepLink)))
    }
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long = cards.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds(): Boolean = true
}
