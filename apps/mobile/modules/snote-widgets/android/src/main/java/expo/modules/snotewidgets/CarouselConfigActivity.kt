package expo.modules.snotewidgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView

/**
 * Lets the user pin what a carousel widget shows: recently modified notes,
 * pinned notes, a whole Drive, or a single Folder.
 */
class CarouselConfigActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_carousel_config)

    val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish()
      return
    }
    // If the user backs out, the widget is not added (unless reconfiguring an existing one).
    setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))

    val snapshot = WidgetStore.snapshot(this)
    val options = mutableListOf<Pair<String, WidgetStore.Source>>(
      "🕘  Recently modified" to WidgetStore.Source.Recent,
      "📌  Pinned notes" to WidgetStore.Source.Pinned,
    )
    for (drive in snapshot.targets) {
      options += "${drive.icon}  ${drive.name} — all folders" to WidgetStore.Source.Drive(drive.id)
      for (folder in drive.folders) options += "      📁  ${drive.name} / ${folder.name}" to WidgetStore.Source.Folder(folder.id)
    }

    val current = WidgetStore.carouselSource(this, widgetId).serialize()
    findViewById<TextView>(R.id.config_hint).text =
      if (snapshot.signedIn) "Choose what this widget cycles through." else "Open SNote and sign in to list your Drives and Folders."

    val list = findViewById<ListView>(R.id.config_list)
    list.choiceMode = ListView.CHOICE_MODE_SINGLE
    list.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_single_choice, options.map { it.first })
    options.indexOfFirst { it.second.serialize() == current }.takeIf { it >= 0 }?.let { list.setItemChecked(it, true) }
    list.setOnItemClickListener { _, _, position, _ ->
      WidgetStore.setCarouselSource(this, widgetId, options[position].second)
      val manager = AppWidgetManager.getInstance(this)
      NotesCarouselWidgetProvider.render(this, manager, intArrayOf(widgetId))
      manager.notifyAppWidgetViewDataChanged(intArrayOf(widgetId), R.id.carousel_stack)
      setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
      finish()
    }
  }
}
