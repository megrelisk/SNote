import AppIntents
import WidgetKit

// MARK: - Quick Capture target switching (runs inside the widget, no app launch)

struct CycleCaptureDriveIntent: AppIntent {
  static let title: LocalizedStringResource = "Switch Quick Note drive"
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult {
    CaptureTargetStore.cycleDrive()
    return .result()
  }
}

struct CycleCaptureFolderIntent: AppIntent {
  static let title: LocalizedStringResource = "Switch Quick Note folder"
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult {
    CaptureTargetStore.cycleFolder()
    return .result()
  }
}

// MARK: - Carousel paging

struct PageCarouselIntent: AppIntent {
  static let title: LocalizedStringResource = "Show another note"
  static let isDiscoverable = false

  @Parameter(title: "Source")
  var sourceId: String

  @Parameter(title: "Step")
  var step: Int

  init() {}

  init(sourceId: String, step: Int) {
    self.sourceId = sourceId
    self.step = step
  }

  func perform() async throws -> some IntentResult {
    let key = SNoteShared.pageKey(sourceId)
    SNoteShared.defaults.set(SNoteShared.defaults.integer(forKey: key) + step, forKey: key)
    return .result()
  }
}

// MARK: - Carousel configuration ("pin" a Drive, Folder, pinned or recent notes)

struct CarouselSourceEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Notes"
  static let defaultQuery = CarouselSourceQuery()

  /// "recent", "pinned", "drive:<id>" or "folder:<id>".
  let id: String
  let title: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

  static let recent = CarouselSourceEntity(id: "recent", title: "Recently modified")
  static let pinned = CarouselSourceEntity(id: "pinned", title: "Pinned notes")

  static func all() -> [CarouselSourceEntity] {
    let snapshot = WidgetSnapshot.load()
    var result = [recent, pinned]
    for drive in snapshot.targets {
      result.append(CarouselSourceEntity(id: "drive:\(drive.id)", title: "\(drive.icon) \(drive.name)"))
      for folder in drive.folders {
        result.append(CarouselSourceEntity(id: "folder:\(folder.id)", title: "\(drive.icon) \(drive.name) / \(folder.name)"))
      }
    }
    return result
  }
}

struct CarouselSourceQuery: EntityQuery {
  func entities(for identifiers: [CarouselSourceEntity.ID]) async throws -> [CarouselSourceEntity] {
    CarouselSourceEntity.all().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [CarouselSourceEntity] {
    CarouselSourceEntity.all()
  }

  func defaultResult() async -> CarouselSourceEntity? {
    .recent
  }
}

struct CarouselConfigurationIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "Choose notes"
  static let description = IntentDescription("Pick which notes the widget cycles through.")

  @Parameter(title: "Show")
  var source: CarouselSourceEntity?

  init() {}
}
