export { byOrder, MemoryDocStore, newCapture, NotesService } from '../src';
import { richText, type RichText } from '../src';
export const plainTextOf = (v: RichText) => richText.plainText(v);
