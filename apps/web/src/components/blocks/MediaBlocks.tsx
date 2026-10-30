'use client';

import type { BlockOf, MediaRef } from '@snote/core';
import { useEffect, useRef, useState } from 'react';
import { resolveMediaUrl, uploadAttachment } from '@/lib/uploads';
import { Icon } from '../Icon';
import { useEditor } from '../editorContext';

function useMediaUrl(media: MediaRef | null, blockId: string) {
  const [url, setUrl] = useState<string | null>(media?.url || null);
  useEffect(() => {
    let cancelled = false;
    if (!media) {
      setUrl(null);
      return;
    }
    if (media.url) {
      setUrl(media.url);
      return;
    }
    resolveMediaUrl(media, blockId).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [media, blockId]);
  return url;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Dropzone({
  accept,
  label,
  icon,
  onFile,
}: {
  accept?: string;
  label: string;
  icon: 'image' | 'file';
  onFile: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      data-editable
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void handle(e.dataTransfer.files[0]);
      }}
    >
      <Icon name={icon} size={22} />
      <span>{busy ? 'Uploading…' : label}</span>
      {error && <span className="error-text">{error}</span>}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => void handle(e.target.files?.[0])} />
    </div>
  );
}

export function ImageBlock({ block }: { block: BlockOf<'image'> }) {
  const editor = useEditor();
  const url = useMediaUrl(block.data.image, block.id);
  const [caption, setCaption] = useState(block.data.caption ?? '');
  useEffect(() => setCaption(block.data.caption ?? ''), [block.data.caption]);

  if (!block.data.image) {
    return (
      <Dropzone
        accept="image/*"
        icon="image"
        label="Click to upload or drag & drop an image"
        onFile={async (file) => {
          const image = await uploadAttachment(file, block.id, editor.uid);
          editor.save({ ...block, data: { ...block.data, image } });
        }}
      />
    );
  }
  return (
    <figure className="image-block">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={caption || block.data.image.name} />
      ) : (
        <div className="media-pending">
          <Icon name="sync" /> Waiting for upload to sync…
        </div>
      )}
      <input
        className="caption"
        data-editable
        placeholder="Add a caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={() => caption !== (block.data.caption ?? '') && editor.save({ ...block, data: { ...block.data, caption } })}
      />
    </figure>
  );
}

const PREVIEWABLE = /^(application\/pdf|image\/|text\/|video\/|audio\/)/;

export function FileBlock({ block }: { block: BlockOf<'file'> }) {
  const editor = useEditor();
  const file = block.data.file;
  const url = useMediaUrl(file, block.id);
  const [preview, setPreview] = useState(false);

  if (!file) {
    return (
      <Dropzone
        icon="file"
        label="Click to attach or drag & drop a file (PDF, DOC, ZIP…)"
        onFile={async (f) => {
          const uploaded = await uploadAttachment(f, block.id, editor.uid);
          editor.save({ ...block, data: { file: uploaded } });
        }}
      />
    );
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 4) : 'FILE';
  const canPreview = !!url && PREVIEWABLE.test(file.mimeType);
  return (
    <div className="file-block" data-editable tabIndex={0}>
      <div className="file-card">
        <span className="file-ext">{ext}</span>
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-size">
            {formatSize(file.size)}
            {!file.url && ' · pending upload'}
          </span>
        </div>
        {canPreview && (
          <button className="ghost small" onClick={() => setPreview((p) => !p)}>
            {preview ? 'Hide' : 'Preview'}
          </button>
        )}
        {url && (
          <a className="ghost small icon-btn" href={url} download={file.name} target="_blank" rel="noreferrer" title="Download">
            <Icon name="download" />
          </a>
        )}
      </div>
      {preview && url && (
        <div className="file-preview">
          {file.mimeType.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.name} />
          ) : file.mimeType.startsWith('video/') ? (
            <video src={url} controls />
          ) : file.mimeType.startsWith('audio/') ? (
            <audio src={url} controls />
          ) : (
            <iframe src={url} title={file.name} />
          )}
        </div>
      )}
    </div>
  );
}
