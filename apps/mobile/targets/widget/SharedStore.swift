import Foundation

/// Shared App Group storage written by the app (`modules/snote-widgets`).
/// Keys and JSON shapes mirror `packages/core/src/widget.ts`.
enum SNoteShared {
  /// Must equal `APP_GROUP` in `apps/mobile/app.config.ts`.
  static let appGroup: String = {
    if let group = Bundle.main.object(forInfoDictionaryKey: "SNoteAppGroup") as? String { return group }
    // The extension's bundle id is "<app bundle id>.<target>"; the group is "group.<app bundle id>".
    if let id = Bundle.main.bundleIdentifier, let dot = id.lastIndex(of: ".") {
      return "group.\(id[..<dot])"
    }
    return "group.app.snote.mobile"
  }()
  static let snapshotKey = "snote.widget.snapshot"
  static let captureTargetKey = "snote.widget.captureTarget"

  static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

  static func pageKey(_ sourceId: String) -> String { "snote.widget.page.\(sourceId)" }
}

struct WidgetFolderOption: Codable, Hashable {
  let id: String
  let name: String
}

struct WidgetDriveOption: Codable, Hashable {
  let id: String
  let name: String
  let icon: String
  let folders: [WidgetFolderOption]
}

struct WidgetTarget: Codable, Hashable {
  let driveId: String
  let folderId: String
}

struct WidgetNoteCard: Codable, Hashable, Identifiable {
  let id: String
  let title: String
  let preview: String
  let driveId: String
  let driveName: String
  let driveIcon: String
  let folderId: String
  let folderName: String
  let pinned: Bool
  let updatedAt: Double
  let updatedAtLabel: String
  let deepLink: String

  var url: URL { URL(string: deepLink) ?? URL(string: "snote://")! }
  var updatedDate: Date { Date(timeIntervalSince1970: updatedAt / 1000) }
}

struct WidgetSnapshot: Codable {
  let version: Int
  let generatedAt: Double
  let signedIn: Bool
  let userName: String?
  let targets: [WidgetDriveOption]
  let defaultTarget: WidgetTarget?
  let notes: [WidgetNoteCard]

  static let empty = WidgetSnapshot(
    version: 1, generatedAt: 0, signedIn: false, userName: nil, targets: [], defaultTarget: nil, notes: [])

  static func load() -> WidgetSnapshot {
    guard
      let raw = SNoteShared.defaults.string(forKey: SNoteShared.snapshotKey),
      let data = raw.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    else { return .empty }
    return snapshot
  }

  /// Same filtering as `selectCarouselNotes` in @snote/core.
  func cards(for sourceId: String, limit: Int = 12) -> [WidgetNoteCard] {
    let filtered: [WidgetNoteCard]
    if sourceId == "pinned" {
      filtered = notes.filter { $0.pinned }
    } else if sourceId.hasPrefix("drive:") {
      let id = String(sourceId.dropFirst("drive:".count))
      filtered = notes.filter { $0.driveId == id }
    } else if sourceId.hasPrefix("folder:") {
      let id = String(sourceId.dropFirst("folder:".count))
      filtered = notes.filter { $0.folderId == id }
    } else {
      filtered = notes
    }
    return Array(filtered.prefix(limit))
  }

  func sourceTitle(_ sourceId: String) -> String {
    if sourceId == "pinned" { return "Pinned" }
    if sourceId.hasPrefix("drive:") {
      let id = String(sourceId.dropFirst("drive:".count))
      return targets.first { $0.id == id }.map { "\($0.icon) \($0.name)" } ?? "Drive"
    }
    if sourceId.hasPrefix("folder:") {
      let id = String(sourceId.dropFirst("folder:".count))
      for drive in targets {
        if let folder = drive.folders.first(where: { $0.id == id }) { return "\(drive.icon) \(folder.name)" }
      }
      return "Folder"
    }
    return "Recent"
  }

  func isValid(_ target: WidgetTarget) -> Bool {
    targets.contains { $0.id == target.driveId && $0.folders.contains { $0.id == target.folderId } }
  }
}

/// The Drive/Folder that Quick Capture saves into, switchable from the widget.
enum CaptureTargetStore {
  static func current(_ snapshot: WidgetSnapshot) -> WidgetTarget? {
    if let raw = SNoteShared.defaults.string(forKey: SNoteShared.captureTargetKey) {
      let parts = raw.split(separator: "/").map(String.init)
      if parts.count == 2 {
        let target = WidgetTarget(driveId: parts[0], folderId: parts[1])
        if snapshot.isValid(target) { return target }
      }
    }
    if let target = snapshot.defaultTarget, snapshot.isValid(target) { return target }
    guard let drive = snapshot.targets.first(where: { !$0.folders.isEmpty }) else { return nil }
    return WidgetTarget(driveId: drive.id, folderId: drive.folders[0].id)
  }

  static func set(_ target: WidgetTarget) {
    SNoteShared.defaults.set("\(target.driveId)/\(target.folderId)", forKey: SNoteShared.captureTargetKey)
  }

  static func cycleDrive() {
    let snapshot = WidgetSnapshot.load()
    let drives = snapshot.targets.filter { !$0.folders.isEmpty }
    guard !drives.isEmpty else { return }
    let index = drives.firstIndex { $0.id == current(snapshot)?.driveId } ?? -1
    let next = drives[(index + 1) % drives.count]
    set(WidgetTarget(driveId: next.id, folderId: next.folders[0].id))
  }

  static func cycleFolder() {
    let snapshot = WidgetSnapshot.load()
    guard
      let target = current(snapshot),
      let drive = snapshot.targets.first(where: { $0.id == target.driveId }),
      !drive.folders.isEmpty
    else { return }
    let index = drive.folders.firstIndex { $0.id == target.folderId } ?? -1
    set(WidgetTarget(driveId: drive.id, folderId: drive.folders[(index + 1) % drive.folders.count].id))
  }

  static func labels(_ snapshot: WidgetSnapshot, _ target: WidgetTarget?) -> (drive: String, folder: String) {
    let drive = snapshot.targets.first { $0.id == target?.driveId }
    let folder = drive?.folders.first { $0.id == target?.folderId }
    return (drive.map { "\($0.icon) \($0.name)" } ?? "No drive", folder?.name ?? "No folder")
  }

  static func captureURL(_ target: WidgetTarget?, prefill: String? = nil) -> URL {
    var components = URLComponents()
    components.scheme = "snote"
    components.host = "capture"
    var items: [URLQueryItem] = []
    if let target {
      items.append(URLQueryItem(name: "driveId", value: target.driveId))
      items.append(URLQueryItem(name: "folderId", value: target.folderId))
    }
    if let prefill { items.append(URLQueryItem(name: "prefill", value: prefill)) }
    components.queryItems = items.isEmpty ? nil : items
    return components.url ?? URL(string: "snote://capture")!
  }
}

extension WidgetNoteCard {
  static let samples: [WidgetNoteCard] = [
    WidgetNoteCard(
      id: "sample-1", title: "Weekly plan", preview: "☐ Finish the widget design · ☑ Book flights",
      driveId: "personal", driveName: "Personal Drive", driveIcon: "🏠", folderId: "personal-inbox",
      folderName: "Inbox", pinned: true, updatedAt: Date().timeIntervalSince1970 * 1000,
      updatedAtLabel: "2026-10-27 09:41:00", deepLink: "snote://note/sample-1"),
    WidgetNoteCard(
      id: "sample-2", title: "Standup notes", preview: "Shipping offline sync today, then date filters.",
      driveId: "work", driveName: "Work Drive", driveIcon: "💼", folderId: "work-meetings",
      folderName: "Meetings", pinned: false, updatedAt: Date().timeIntervalSince1970 * 1000,
      updatedAtLabel: "2026-10-27 09:15:12", deepLink: "snote://note/sample-2"),
  ]
}
