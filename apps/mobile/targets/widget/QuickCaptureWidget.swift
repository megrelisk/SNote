import AppIntents
import SwiftUI
import WidgetKit

struct CaptureEntry: TimelineEntry {
  let date: Date
  let signedIn: Bool
  let target: WidgetTarget?
  let driveLabel: String
  let folderLabel: String
}

struct CaptureProvider: TimelineProvider {
  func placeholder(in context: Context) -> CaptureEntry {
    CaptureEntry(date: .now, signedIn: true, target: nil, driveLabel: "🏠 Personal Drive", folderLabel: "Inbox")
  }

  func getSnapshot(in context: Context, completion: @escaping (CaptureEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : makeEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CaptureEntry>) -> Void) {
    // Refreshed whenever the app publishes a new snapshot or a chip is tapped.
    completion(Timeline(entries: [makeEntry()], policy: .never))
  }

  private func makeEntry() -> CaptureEntry {
    let snapshot = WidgetSnapshot.load()
    let target = CaptureTargetStore.current(snapshot)
    let labels = CaptureTargetStore.labels(snapshot, target)
    return CaptureEntry(date: .now, signedIn: snapshot.signedIn, target: target, driveLabel: labels.drive, folderLabel: labels.folder)
  }
}

/// Quick Capture: switch Drive/Folder right in the widget, then tap to write.
/// (iOS widgets cannot host text fields, so writing happens in SNote's minimal
/// capture sheet, opened directly with the chosen target.)
struct QuickCaptureWidget: Widget {
  let kind = "SNoteQuickCapture"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: CaptureProvider()) { entry in
      QuickCaptureView(entry: entry)
        .containerBackground(Color("$widgetBackground"), for: .widget)
    }
    .configurationDisplayName("Quick Note")
    .description("Add a note to any Drive and Folder from your Home Screen.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct QuickCaptureView: View {
  let entry: CaptureEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    if !entry.signedIn {
      VStack(alignment: .leading, spacing: 6) {
        Label("SNote", systemImage: "square.and.pencil").font(.headline).foregroundStyle(Color.accentColor)
        Text("Open SNote to sign in and sync your Drives.").font(.caption).foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .widgetURL(URL(string: "snote://"))
    } else if family == .systemSmall {
      VStack(alignment: .leading, spacing: 6) {
        chip(entry.driveLabel, intent: CycleCaptureDriveIntent())
        chip("📁 \(entry.folderLabel)", intent: CycleCaptureFolderIntent())
        Spacer(minLength: 0)
        Label("Write…", systemImage: "square.and.pencil")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Color.accentColor)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .widgetURL(CaptureTargetStore.captureURL(entry.target))
    } else {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 6) {
          chip(entry.driveLabel, intent: CycleCaptureDriveIntent())
          chip("📁 \(entry.folderLabel)", intent: CycleCaptureFolderIntent())
        }
        Link(destination: CaptureTargetStore.captureURL(entry.target)) {
          HStack {
            Image(systemName: "square.and.pencil")
            Text("Write a note…")
            Spacer()
          }
          .font(.body)
          .foregroundStyle(.secondary)
          .padding(10)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          .background(Color("cardBackground"), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        HStack {
          Link(destination: CaptureTargetStore.captureURL(entry.target, prefill: "[ ] ")) {
            Label("To-do", systemImage: "checklist").font(.caption.weight(.medium))
          }
          Spacer()
          Link(destination: URL(string: "snote://")!) {
            Text("SNote ↗").font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    }
  }

  private func chip<I: AppIntent>(_ title: String, intent: I) -> some View {
    Button(intent: intent) {
      HStack(spacing: 4) {
        Text(title).lineLimit(1)
        Image(systemName: "chevron.up.chevron.down").font(.system(size: 9, weight: .semibold))
      }
      .font(.caption.weight(.medium))
      .padding(.horizontal, 8)
      .padding(.vertical, 5)
      .foregroundStyle(Color.accentColor)
      .background(Color.accentColor.opacity(0.14), in: Capsule())
    }
    .buttonStyle(.plain)
  }
}
