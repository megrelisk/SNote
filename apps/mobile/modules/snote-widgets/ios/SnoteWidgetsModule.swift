import ExpoModulesCore
import WidgetKit

/// Bridges the React Native app and the WidgetKit extension through the shared
/// App Group container. Keys must match `targets/widget/SharedStore.swift` and
/// `WIDGET_*_KEY` in `@snote/core`.
public final class SnoteWidgetsModule: Module {
  private static let snapshotKey = "snote.widget.snapshot"
  private static let captureQueueKey = "snote.widget.captures"

  private var defaults: UserDefaults? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "SNoteAppGroup") as? String else {
      return nil
    }
    return UserDefaults(suiteName: group)
  }

  public func definition() -> ModuleDefinition {
    Name("SnoteWidgets")

    Function("setSnapshot") { (json: String) in
      self.defaults?.set(json, forKey: Self.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("getPendingCaptures") { () -> String in
      return self.defaults?.string(forKey: Self.captureQueueKey) ?? "[]"
    }

    Function("removeCaptures") { (ids: [String]) in
      self.mutateQueue { queue in
        queue.filter { item in !ids.contains(item["id"] as? String ?? "") }
      }
    }

    Function("enqueueCapture") { (json: String) in
      guard
        let data = json.data(using: .utf8),
        let item = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else { return }
      self.mutateQueue { queue in queue + [item] }
    }

    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  private func mutateQueue(_ transform: ([[String: Any]]) -> [[String: Any]]) {
    guard let defaults else { return }
    let raw = defaults.string(forKey: Self.captureQueueKey) ?? "[]"
    let queue = (try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]]) ?? []
    let next = transform(queue)
    if let data = try? JSONSerialization.data(withJSONObject: next), let text = String(data: data, encoding: .utf8) {
      defaults.set(text, forKey: Self.captureQueueKey)
    }
  }
}
