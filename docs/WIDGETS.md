# Home Screen Widgets

SNote ships two widgets on each platform:

1. **Quick Note (Quick Capture).** Add a note to any Drive and Folder from the home screen.
2. **Notes (carousel).** Flip through note preview cards, then tap one to open that exact note in the editor.

Both render from data the app puts in shared storage, so they work while the app is closed and while offline.

## Data flow

```
App (React Native)                          Widgets (native)
──────────────────                          ────────────────
WidgetBridge ── buildWidgetSnapshot() ──▶  snote.widget.snapshot   (JSON)
                                           • Drive/Folder tree for the target picker
                                           • note cards: title, Drive/Folder path,
                                             latest block preview, updated time, deep link
drainCaptures() ◀── snote.widget.captures ◀── Quick Capture saves (JSON queue)
      │
      ▼
NotesService.ingestCapture() → Firestore local cache → cloud (when online)
```

* The contracts (`WidgetSnapshot`, `PendingCapture`, carousel sources, deep links) are defined once in `packages/core/src/widget.ts`. They're mirrored in Swift (`targets/widget/SharedStore.swift`) and Kotlin (`modules/snote-widgets/android/.../WidgetStore.kt`).
* Storage: iOS uses `UserDefaults(suiteName: "group.<bundle id>")`; Android uses the `SharedPreferences("snote_widgets")` file.
* A capture becomes a note whose id **is the capture id**. That makes ingestion idempotent: if the queue is drained twice, nothing is duplicated. All block timestamps use the moment of capture, not the moment of sync.
* Capture text format: the first line becomes the title. A line starting with `[ ] ` or `[x] ` becomes a to-do, a line starting with `- ` becomes a bullet, and anything else becomes a paragraph.
* Deep links: `snote://note/<noteId>` opens the editor; `snote://capture?driveId=…&folderId=…&prefill=…` opens the capture sheet.

## Android

| Widget | Behaviour |
| --- | --- |
| Quick Note | Two chips show the target **Drive ▾** and **📁 Folder ▾**; tapping a chip switches the target right on the home screen. Tapping **“Write a note…”** (or **☑ To-do**) opens `QuickCaptureActivity`. That is a floating dialog over the launcher with a text field and **Drive and Folder dropdowns (Spinners)**; the main app UI never opens. Save writes to the queue, adds an optimistic card to every carousel, and starts `CaptureSyncService`, a headless JS task that writes the note to Firestore in the background. Offline captures sync later. |
| Notes carousel | A `StackView` of cards you **swipe** through, Samsung Notes style. Tapping a card opens the note. The **⚙** button (and the widget's reconfigure option) opens `CarouselConfigActivity`, where you pin *Recently modified*, *Pinned notes*, a whole Drive or one Folder. **+** opens Quick Capture. |

All widget code lives inside the local Expo module, so `npx expo prebuild` merges its manifest entries, layouts and Kotlin classes automatically. There's no hand-edited `android/` folder.

## iOS (17+)

Apple limits what widgets can do, and those limits shape the iOS design:

* **Widgets can't contain text fields.** On the Quick Note widget, the **Drive and Folder chips are interactive buttons** (App Intents) that switch the target inside the widget without launching the app. Tapping **“Write a note…”** opens SNote straight into the minimal capture sheet, with the chosen Drive/Folder preselected and the keyboard up. **To-do** pre-fills `[ ] `.
* **Widgets can't scroll or swipe.** The Notes widget pages through cards with interactive **‹ ›** buttons (`PageCarouselIntent`): one card per page on medium, three on large. Tapping a card opens that note.
* To configure the carousel, long-press the widget and choose **Edit Widget → Show**. The options are *Recently modified*, *Pinned notes*, any Drive, or any Folder. They come from `CarouselConfigurationIntent` and `CarouselSourceEntity`.

The extension is generated from `targets/widget` by `@bacons/apple-targets` during `expo prebuild`. It shares the `group.<bundle id>` App Group with the app; set `APPLE_TEAM_ID` so Xcode / EAS can sign both targets.

## Background sync

* Whenever the app has data changes, `WidgetBridge` republishes the snapshot (debounced) and reloads every widget.
* Captures are drained in four places: on app start, whenever the app returns to the foreground, by the Android headless task straight after a widget save, and by a periodic `expo-background-task` job (both platforms, at least 15 minutes apart, scheduled by the OS).
* Pinned notes (📌 in the editor header or a long-press in lists) always appear in the snapshot, so a *Pinned* carousel is never empty because of the size limits (50 most recent notes overall + 20 per folder + all pinned, capped at 400).
