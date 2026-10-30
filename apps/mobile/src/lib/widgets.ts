import { buildWidgetSnapshot, type Drive, type Folder, type Note, type NotesService, type PendingCapture } from '@snote/core';
import SnoteWidgets from '../../modules/snote-widgets';
import { prefs } from './prefs';

/**
 * App side of the widget system:
 *  - `publishSnapshot` writes the data widgets render (Drive/Folder targets +
 *    note cards) into shared storage and refreshes the widgets.
 *  - `drainCaptures` moves Quick Capture notes saved by widgets into the
 *    database (Firestore caches them locally and syncs when online).
 */

export const widgetsAvailable = SnoteWidgets != null;

export async function publishSnapshot(input: {
  drives: Drive[];
  folders: Folder[];
  notes: Note[];
  user: { displayName: string | null } | null;
}): Promise<void> {
  if (!SnoteWidgets) return;
  const snapshot = buildWidgetSnapshot({ ...input, defaultTarget: await prefs.lastTarget() });
  SnoteWidgets.setSnapshot(JSON.stringify(snapshot));
}

export function clearSnapshot(): void {
  SnoteWidgets?.setSnapshot(JSON.stringify(buildWidgetSnapshot({ drives: [], folders: [], notes: [], user: null })));
}

let draining: Promise<number> | null = null;

/** Ingests queued widget captures. Returns how many were written. */
export function drainCaptures(service: NotesService): Promise<number> {
  if (!SnoteWidgets) return Promise.resolve(0);
  draining ??= (async () => {
    let captures: PendingCapture[] = [];
    try {
      captures = JSON.parse(SnoteWidgets.getPendingCaptures()) as PendingCapture[];
    } catch {
      captures = [];
    }
    const done: string[] = [];
    for (const capture of captures) {
      try {
        await service.ingestCapture(capture);
        done.push(capture.id);
      } catch (error) {
        console.warn('[snote] could not ingest capture', capture.id, error);
      }
    }
    if (done.length) SnoteWidgets.removeCaptures(done);
    return done.length;
  })().finally(() => {
    draining = null;
  });
  return draining;
}
