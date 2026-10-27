package expo.modules.snotewidgets

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class SnoteWidgetsModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SnoteWidgets")

    Function("setSnapshot") { json: String ->
      WidgetStore.saveSnapshot(context, json)
      WidgetUpdater.updateAll(context)
    }

    Function("getPendingCaptures") {
      WidgetStore.pendingCaptures(context)
    }

    Function("removeCaptures") { ids: List<String> ->
      WidgetStore.removeCaptures(context, ids.toSet())
    }

    Function("enqueueCapture") { json: String ->
      WidgetStore.enqueueCapture(context, JSONObject(json))
    }

    Function("reloadWidgets") {
      WidgetUpdater.updateAll(context)
    }
  }
}
