import { describe, expect, it } from 'vitest';
import { byOrder, MemoryDocStore, newCapture, NotesService, plainTextOf } from './serviceHelpers';

describe('NotesService on MemoryDocStore', () => {
  const setup = () => {
    let now = new Date(2026, 9, 1, 9).getTime();
    const store = new MemoryDocStore();
    const service = new NotesService(store, (e) => { throw e; }, () => (now += 1000));
    return { store, service };
  };

  it('creates starter content idempotently', async () => {
    const { service } = setup();
    service.createStarterContent();
    service.createStarterContent();
    expect(await service.once('drives')).toHaveLength(3);
    expect(await service.once('folders')).toHaveLength(6);
  });

  it('inserts, edits, reorders and deletes blocks while maintaining note preview', async () => {
    const { service } = setup();
    const drive = service.createDrive('Work');
    const folder = service.createFolder(drive.id, 'Inbox');
    const { note, firstBlock } = service.createNote({ driveId: drive.id, folderId: folder.id }, 'Plan');
    const second = service.insertBlock(note, [firstBlock], 'todo', { afterId: firstBlock.id });
    let blocks = (await service.once('blocks', [{ field: 'noteId', op: '==', value: note.id }])).sort(byOrder);
    expect(blocks.map((b) => b.id)).toEqual([firstBlock.id, second.id]);

    const edited = service.saveBlock({ ...second, data: { text: [{ text: 'ship it' }], checked: true } }, blocks);
    expect(edited.updatedAt).toBeGreaterThan(second.updatedAt);
    expect((await service.store.get('notes', note.id))!.preview).toBe('☑ ship it');

    blocks = (await service.once('blocks', [{ field: 'noteId', op: '==', value: note.id }])).sort(byOrder);
    service.moveBlock(blocks[1]!, blocks, 0);
    blocks = (await service.once('blocks', [{ field: 'noteId', op: '==', value: note.id }])).sort(byOrder);
    expect(blocks.map((b) => b.id)).toEqual([second.id, firstBlock.id]);
    // Reordering does not count as an edit.
    expect(blocks[0]!.updatedAt).toBe(edited.updatedAt);

    service.deleteBlock(blocks[0]!, blocks);
    expect(await service.once('blocks', [{ field: 'noteId', op: '==', value: note.id }])).toHaveLength(1);
    expect((await service.store.get('notes', note.id))!.preview).toBe('');
  });

  it('cascades deletes and moves', async () => {
    const { service } = setup();
    const d = service.createDrive('A');
    const f1 = service.createFolder(d.id, 'one');
    const f2 = service.createFolder(d.id, 'two');
    const { note } = service.createNote({ driveId: d.id, folderId: f1.id });
    await service.moveNote(note, { driveId: d.id, folderId: f2.id });
    const blocks = await service.once('blocks', [{ field: 'folderId', op: '==', value: f2.id }]);
    expect(blocks).toHaveLength(1);
    await service.deleteDrive(d.id);
    for (const c of ['drives', 'folders', 'notes', 'blocks'] as const) expect(await service.once(c)).toHaveLength(0);
  });

  it('ingests captures exactly once', async () => {
    const { service } = setup();
    const capture = newCapture('Idea\nbody text', { driveId: 'personal', folderId: 'personal-inbox' }, 'widget');
    await service.ingestCapture(capture);
    service.updateNote(capture.id, { title: 'Renamed' });
    await service.ingestCapture(capture);
    const note = await service.store.get('notes', capture.id);
    expect(note!.title).toBe('Renamed');
    const blocks = await service.once('blocks', [{ field: 'noteId', op: '==', value: capture.id }]);
    expect(blocks.map((b) => (b.type === 'paragraph' ? plainTextOf(b.data.text) : ''))).toEqual(['body text']);
  });
});
