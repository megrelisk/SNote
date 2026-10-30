import SwiftUI
import WidgetKit

@main
struct SNoteWidgetBundle: WidgetBundle {
  var body: some Widget {
    QuickCaptureWidget()
    NotesCarouselWidget()
  }
}
