'use client';

import { formatTimestamp, type Block, type BlockType } from '@snote/core';
import { memo, useState } from 'react';
import { BlockTypeMenu } from './BlockTypeMenu';
import { CodeBlock } from './blocks/CodeBlock';
import { FileBlock, ImageBlock } from './blocks/MediaBlocks';
import { TableBlock } from './blocks/TableBlock';
import { TextBlock } from './blocks/TextBlock';
import { useEditor } from './editorContext';
import { Icon } from './Icon';

export const BLOCK_DRAG_TYPE = 'application/x-snote-block';

export interface BlockRowProps {
  block: Block;
  index: number;
  menu: 'slash' | 'handle' | 'add' | null;
  menuQuery: string;
  selected: boolean;
  dropPosition: 'before' | 'after' | null;
  onSelect(id: string | null): void;
  onDragOverRow(id: string, position: 'before' | 'after'): void;
  onDropRow(e: React.DragEvent, id: string, position: 'before' | 'after'): void;
  onDragEnd(): void;
}

/**
 * One block in the editor: gutter (add / drag handle), the block body, and
 * its timestamp label — hidden until the block is hovered, focused or selected.
 */
export const BlockRow = memo(function BlockRow(props: BlockRowProps) {
  const { block, menu, selected, dropPosition } = props;
  const editor = useEditor();
  const [dragging, setDragging] = useState(false);

  const body = (() => {
    switch (block.type) {
      case 'code':
        return <CodeBlock block={block} />;
      case 'image':
        return <ImageBlock block={block} />;
      case 'file':
        return <FileBlock block={block} />;
      case 'table':
        return <TableBlock block={block} />;
      default:
        return <TextBlock block={block} menuOpen={menu === 'slash'} />;
    }
  })();

  const position = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  const pick = (type: BlockType) => {
    if (menu === 'add') {
      const created = editor.insertAfter(block, type);
      editor.focus({ blockId: created.id, offset: 'start' });
    } else {
      editor.convert(block, type, menu === 'slash' ? [] : undefined);
    }
    editor.openMenu('', 'slash');
  };

  const edited = block.updatedAt !== block.createdAt;

  return (
    <div
      className={[
        'block-row',
        `row-${block.type}`,
        selected && 'selected',
        dragging && 'dragging',
        dropPosition && `drop-${dropPosition}`,
      ]
        .filter(Boolean)
        .join(' ')}
      data-block-id={block.id}
      onDragOver={(e) => {
        const types = e.dataTransfer.types;
        if (!types.includes(BLOCK_DRAG_TYPE) && !types.includes('Files')) return;
        e.preventDefault();
        props.onDragOverRow(block.id, position(e));
      }}
      onDrop={(e) => props.onDropRow(e, block.id, position(e))}
      onFocus={() => props.onSelect(block.id)}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-editable], button, input, textarea, a, select')) {
          props.onSelect(block.id);
        }
      }}
    >
      <div className="block-gutter">
        <button
          className="gutter-btn"
          title="Add a block below"
          onClick={() => editor.openMenu(menu === 'add' ? '' : block.id, 'add')}
        >
          <Icon name="plus" />
        </button>
        <button
          className="gutter-btn handle"
          title="Drag to reorder · click for options"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(BLOCK_DRAG_TYPE, block.id);
            e.dataTransfer.effectAllowed = 'move';
            const row = e.currentTarget.closest('.block-row');
            if (row) e.dataTransfer.setDragImage(row, 20, 16);
            setDragging(true);
          }}
          onDragEnd={() => {
            setDragging(false);
            props.onDragEnd();
          }}
          onClick={() => {
            props.onSelect(block.id);
            editor.openMenu(menu === 'handle' ? '' : block.id, 'handle');
          }}
        >
          <Icon name="grip" />
        </button>
      </div>

      <div className="block-body">{body}</div>

      <div className="block-meta" aria-label="Block timestamps">
        <span>
          <em>Created</em> <time dateTime={new Date(block.createdAt).toISOString()}>{formatTimestamp(block.createdAt)}</time>
        </span>
        {edited && (
          <span>
            <em>Edited</em> <time dateTime={new Date(block.updatedAt).toISOString()}>{formatTimestamp(block.updatedAt)}</time>
          </span>
        )}
      </div>

      {menu && (
        <div className="block-menu-anchor">
          <BlockTypeMenu
            onPick={pick}
            onClose={() => editor.openMenu('', 'slash')}
            query={menu === 'slash' ? props.menuQuery : ''}
            extra={
              menu === 'handle'
                ? [
                    {
                      label: 'Duplicate',
                      icon: 'plus',
                      onClick: () => {
                        editor.insertAfter(block, block.type, block.data);
                        editor.openMenu('', 'slash');
                      },
                    },
                    {
                      label: 'Delete',
                      icon: 'trash',
                      danger: true,
                      onClick: () => {
                        editor.remove(block);
                        editor.openMenu('', 'slash');
                      },
                    },
                  ]
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
});
