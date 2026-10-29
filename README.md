# SNote — Smart Block-Based Notes

Offline-first, real-time synced notes organised as **Drive → Folder → Note → Block**, with per-block timestamps, a calendar date filter, and interactive home screen widgets (Quick Capture + note carousel).

| Platform | Tech | Location |
| --- | --- | --- |
| Web (desktop browsers) | Next.js 16 + React 19 + TypeScript, Firebase JS SDK | `apps/web` |
| Mobile (iOS & Android) | Expo SDK 58 / React Native 0.88, React Native Firebase | `apps/mobile` |
| Android widgets | Kotlin App Widgets (inside a local Expo module) | `apps/mobile/modules/snote-widgets/android` |
| iOS widgets | SwiftUI WidgetKit extension + App Intents | `apps/mobile/targets/widget` |
| Shared domain logic | TypeScript, no runtime deps | `packages/core` |
| Backend | Firebase Auth (Google), Cloud Firestore, Firebase Storage | `firebase/` |

## Architecture in one page

```
            ┌──────────────── @snote/core (shared) ────────────────┐
            │ types · rich text ops · block model · date filter    │
            │ NotesService (domain ops) · DocStore abstraction     │
            │ FirestoreDocStore · widget snapshot/capture contract │
            └──────────────────────────────────────────────────────┘
                 ▲                                        ▲
   apps/web (Firebase JS SDK,               apps/mobile (React Native Firebase,
   IndexedDB persistent cache)              native on-device cache)
                                                          │ snote-widgets module
                                         App Group (iOS) / SharedPreferences (Android)
                                                          │
                                         WidgetKit extension / Android App Widgets
```

* **Data model** (`packages/core/src/types.ts`). Each Drive, Folder, Note and Block is its own Firestore document under `users/{uid}/…`. Two devices editing different blocks of the same note never conflict. Every block stores `createdAt`, `updatedAt` and `activityDays`, the list of every local day it was created or edited on.
* **Offline-first sync.** Writes go to the local Firestore cache immediately: IndexedDB on the web, the native cache on mobile. The UI updates at once. The SDK queues writes while offline and pushes them when the connection returns. The sidebar and Settings show *Synced / Syncing… / Offline*.
* **Data recovery.** Everything lives in the user's cloud account. Signing in with the same Google account on a new device or after reinstalling streams all data back. Starter Drives are created only after the server confirms the account is really empty, so a fresh install never duplicates data.
* **Granular timestamps.** `formatTimestamp()` gives `YYYY-MM-DD HH:mm:ss`. Timestamps stay hidden until a block is hovered, focused or selected on the web, or tapped on mobile.
* **Date filter.** A single `array-contains` query on `activityDays` finds every block created *or edited* on a day, including blocks edited again later. `filterByDate()` then groups the results Drive → Folder → Note and applies the *created / edited / either* option and the global, drive or folder scope.
* **Attachments.** Files go to Firebase Storage at `users/{uid}/attachments/{blockId}/…`. If an upload fails or the device is offline, the file is queued: IndexedDB on the web, the app's document directory on mobile. It's retried on reconnect, and the block is then patched with the download URL.

## Feature checklist (acceptance criteria)

| Requirement | Where |
| --- | --- |
| 1-click Google auth on all platforms | web `src/lib/session.tsx` (popup, redirect fallback) · mobile `src/lib/session.tsx` (native Google Sign-In → Firebase credential) |
| Widget: Quick Add with Drive/Folder selection | Android `QuickCaptureWidgetProvider` + `QuickCaptureActivity` · iOS `QuickCaptureWidget.swift` (see [docs/WIDGETS.md](docs/WIDGETS.md)) |
| Widget: swipeable note previews, tap to open note | Android `NotesCarouselWidgetProvider` (StackView) · iOS `CarouselWidget.swift` |
| Widget configuration (pin Drive / Folder / pinned / recent) | Android `CarouselConfigActivity` · iOS `CarouselConfigurationIntent` |
| Full offline mode + auto-sync | Firestore persistent caches + `FirestoreDocStore` status · upload queues |
| 100% restoration on reinstall | all data in `users/{uid}` (rules in `firebase/firestore.rules`) |
| Tap a block → timestamp to the second | web `BlockRow.tsx` · mobile `BlockItem.tsx` |
| Date filter shows only blocks/notes touched that day | `packages/core/src/dateFilter.ts` · web `DateFilter.tsx` · mobile `(tabs)/calendar.tsx` |
| Block editor: H1–H3, bold/italic/underline/strike/code, lists, to-dos with strike-through, code blocks, images, files with previews, dynamic tables | web `src/components/blocks/*` · mobile `src/components/editor/*` |
| Drag-and-drop block reordering | web HTML5 DnD (`BlockRow.tsx`) · mobile `react-native-draggable-flatlist` |
| Web 3-column layout, dark/light themes | `apps/web/src/components/Workspace.tsx`, `app/globals.css` |
| Mobile bottom navigation + keyboard extension bar | `src/app/(tabs)/_layout.tsx`, `src/components/editor/KeyboardToolbar.tsx` |

Editor shortcuts on both platforms: `# ` / `## ` / `### ` headings, `- ` bullets, `1. ` numbered, `[] ` to-do, ```` ``` ```` code, `/` block menu. On the web, Ctrl/⌘+B / I / U / E (code) and Ctrl/⌘+Shift+S (strikethrough) also work.

## Getting started

Requirements: Node 20+ and npm 10+.

### 1. Firebase project

1. Create a Firebase project and enable **Authentication → Google**, **Cloud Firestore** and **Storage**.
2. Deploy the rules: `npx firebase-tools deploy --only firestore:rules,storage` (uses `firebase.json`).
3. Register the apps you need:
   * **Web app.** Copy the config values into `apps/web/.env.local` (see `apps/web/.env.example`), and add your domain to *Authentication → Settings → Authorized domains*.
   * **Android app** (package `app.snote.mobile`, or set `SNOTE_BUNDLE_ID`). Add your SHA-1 fingerprint and download `google-services.json` into `apps/mobile/`.
   * **iOS app** (bundle `app.snote.mobile`). Download `GoogleService-Info.plist` into `apps/mobile/`.
4. In `apps/mobile/.env`, set `GOOGLE_WEB_CLIENT_ID` (the *Web client* OAuth ID that Firebase creates) and `GOOGLE_IOS_URL_SCHEME` (the `REVERSED_CLIENT_ID` from the plist). For iOS widget signing, also set `APPLE_TEAM_ID`.

### 2. Web

```bash
npm install            # installs packages/core + apps/web
npm run dev:web        # http://localhost:3000
npm run build:web
```

**Live site:** https://snote.sosokartozia.com. On every push, `.github/workflows/pages.yml` builds the site and publishes it to the `gh-pages` branch, which GitHub Pages serves under the custom domain.

One-time setup:
* GitHub: *Settings → Pages → Source: Deploy from a branch → `gh-pages` / (root)*.
* DNS: a `CNAME` record with host `snote` pointing to `megrelisk.github.io`.
* Google sign-in: add the `NEXT_PUBLIC_FIREBASE_*` values as repository secrets, and add `snote.sosokartozia.com` to Firebase's authorized domains.

Without Firebase keys, the web app offers **“Continue without an account”**, a local-only mode stored in the browser. It's handy for trying the editor.

### 3. Mobile

The widgets and Firebase need native code, so use a development build. Expo Go won't work.

```bash
cd apps/mobile
npm install
npx expo prebuild --clean      # generates ios/ and android/ (never edit them by hand)
npx expo run:android           # or: npx expo run:ios
# or in the cloud: npx eas-cli build --profile development
```

### 4. Checks

```bash
npm test                       # @snote/core unit tests (vitest)
npm run typecheck              # core + web
npm run typecheck:mobile       # mobile (tsc)
```

## Repository layout

```
packages/core/          shared model + logic (tests in packages/core/test)
apps/web/               Next.js app (app/, src/components, src/lib)
apps/mobile/            Expo app
  src/app/              Expo Router screens: (tabs), note/[id], folder/[id], capture
  src/components/       editor, calendar, pickers, UI primitives
  src/lib/              Firebase session, hooks, uploads, widget bridge
  src/background.ts     headless + periodic capture sync tasks
  modules/snote-widgets native bridge (Swift/Kotlin) + Android widgets
  targets/widget/       iOS WidgetKit extension (@bacons/apple-targets)
firebase/               Firestore + Storage security rules
docs/WIDGETS.md         widget behaviour, data contracts and platform notes
```
