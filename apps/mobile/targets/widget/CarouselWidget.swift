import AppIntents
import SwiftUI
import WidgetKit

struct CarouselEntry: TimelineEntry {
  let date: Date
  let signedIn: Bool
  let sourceId: String
  let sourceTitle: String
  /// Cards visible on the current page.
  let cards: [WidgetNoteCard]
  let page: Int
  let pageCount: Int
  let total: Int
}

struct CarouselProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> CarouselEntry {
    CarouselEntry(
      date: .now, signedIn: true, sourceId: "recent", sourceTitle: "Recent",
      cards: Array(WidgetNoteCard.samples.prefix(pageSize(context.family))), page: 0, pageCount: 2, total: 2)
  }

  func snapshot(for configuration: CarouselConfigurationIntent, in context: Context) async -> CarouselEntry {
    context.isPreview ? placeholder(in: context) : entry(configuration, context)
  }

  func timeline(for configuration: CarouselConfigurationIntent, in context: Context) async -> Timeline<CarouselEntry> {
    // The app reloads timelines whenever notes change; the fallback keeps relative labels fresh.
    Timeline(entries: [entry(configuration, context)], policy: .after(.now.addingTimeInterval(30 * 60)))
  }

  private func pageSize(_ family: WidgetFamily) -> Int {
    family == .systemLarge ? 3 : 1
  }

  private func entry(_ configuration: CarouselConfigurationIntent, _ context: Context) -> CarouselEntry {
    let snapshot = WidgetSnapshot.load()
    let sourceId = configuration.source?.id ?? "recent"
    let all = snapshot.cards(for: sourceId)
    let size = pageSize(context.family)
    let pageCount = max(1, Int((Double(all.count) / Double(size)).rounded(.up)))
    let raw = SNoteShared.defaults.integer(forKey: SNoteShared.pageKey(sourceId))
    let page = ((raw % pageCount) + pageCount) % pageCount
    let start = page * size
    let cards = start < all.count ? Array(all[start..<min(all.count, start + size)]) : []
    return CarouselEntry(
      date: .now, signedIn: snapshot.signedIn, sourceId: sourceId, sourceTitle: snapshot.sourceTitle(sourceId),
      cards: cards, page: page, pageCount: pageCount, total: all.count)
  }
}

/// Note carousel: flip through notes with the arrows, tap a card to open that
/// exact note. Long-press → Edit Widget to pin a Drive, Folder, pinned or
/// recent notes.
struct NotesCarouselWidget: Widget {
  let kind = "SNoteCarousel"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: CarouselConfigurationIntent.self, provider: CarouselProvider()) { entry in
      CarouselView(entry: entry)
        .containerBackground(Color("$widgetBackground"), for: .widget)
    }
    .configurationDisplayName("Notes")
    .description("Flip through recent, pinned, Drive or Folder notes and open one with a tap.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct CarouselView: View {
  let entry: CarouselEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      header
      if !entry.signedIn {
        message("Open SNote to sign in.")
      } else if entry.cards.isEmpty {
        message("No notes here yet.")
      } else if family == .systemSmall {
        CardView(card: entry.cards[0], compact: true)
      } else {
        ForEach(entry.cards) { card in
          Link(destination: card.url) { CardView(card: card, compact: false) }
        }
        if family == .systemLarge && entry.cards.count < 3 { Spacer(minLength: 0) }
      }
    }
    .widgetURL(family == .systemSmall ? (entry.cards.first?.url ?? URL(string: "snote://")) : nil)
  }

  private var header: some View {
    HStack(spacing: 6) {
      Text(entry.sourceTitle)
        .font(.caption.weight(.semibold))
        .foregroundStyle(Color.accentColor)
        .lineLimit(1)
      Spacer(minLength: 4)
      if entry.pageCount > 1 {
        Button(intent: PageCarouselIntent(sourceId: entry.sourceId, step: -1)) {
          Image(systemName: "chevron.left")
        }
        .buttonStyle(.plain)
        Text("\(entry.page + 1)/\(entry.pageCount)")
          .font(.caption2.monospacedDigit())
          .foregroundStyle(.secondary)
        Button(intent: PageCarouselIntent(sourceId: entry.sourceId, step: 1)) {
          Image(systemName: "chevron.right")
        }
        .buttonStyle(.plain)
      }
    }
    .font(.caption.weight(.semibold))
  }

  private func message(_ text: String) -> some View {
    Text(text)
      .font(.caption)
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct CardView: View {
  let card: WidgetNoteCard
  let compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text("\(card.driveIcon) \(card.driveName) / \(card.folderName)")
        .font(.caption2)
        .foregroundStyle(Color.accentColor)
        .lineLimit(1)
      Text((card.pinned ? "📌 " : "") + card.title)
        .font(compact ? .subheadline.weight(.semibold) : .headline)
        .foregroundStyle(.primary)
        .lineLimit(1)
      Text(card.preview.isEmpty ? "Empty note" : card.preview)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(compact ? 3 : 2)
      Spacer(minLength: 0)
      Text(card.updatedDate, style: .relative)
        .font(.caption2)
        .foregroundStyle(.tertiary)
    }
    .padding(10)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}
