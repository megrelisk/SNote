'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/** Latest signed APK, published by .github/workflows/android.yml. */
export const ANDROID_APK_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL || 'https://github.com/megrelisk/SNote/releases/latest/download/snote.apk';

function useQrSvg(text: string) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [text]);
  return svg;
}

const LATEST_RELEASE_API = process.env.NEXT_PUBLIC_ANDROID_RELEASE_API || 'https://api.github.com/repos/megrelisk/SNote/releases/latest';

/** Whether an APK has been published yet (null while checking). */
function useApkAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((release: { assets?: { name: string }[] } | null) => {
        if (!cancelled) setAvailable(!!release?.assets?.some((a) => a.name.endsWith('.apk')));
      })
      // If GitHub can't be reached, keep showing the link rather than hiding a working download.
      .catch(() => !cancelled && setAvailable(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/** "Get the Android app": a direct download button plus a QR code to scan from the phone. */
export function AppDownload({ compact = false }: { compact?: boolean }) {
  const svg = useQrSvg(ANDROID_APK_URL);
  const available = useApkAvailable();
  if (available === null) return null;
  if (!available) {
    return (
      <div className={`app-download${compact ? ' compact' : ''}`}>
        <div className="app-download-text">
          <strong>SNote for Android</strong>
          <span>The Android app is on its way. A download link and QR code will appear here as soon as it is ready.</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`app-download${compact ? ' compact' : ''}`}>
      {svg && <div className="qr" role="img" aria-label="QR code to download the Android app" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div className="app-download-text">
        <strong>SNote for Android</strong>
        <span>Scan with your phone camera, or download directly. Sign in with the same Google account to sync live.</span>
        <a className="primary small" href={ANDROID_APK_URL}>
          <Icon name="download" size={14} /> Download APK
        </a>
      </div>
    </div>
  );
}

/** Sidebar button that opens the download card in a popover. */
export function AppDownloadButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-download-anchor">
      <button className="nav-item" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="download" /> Get the mobile app
      </button>
      {open && (
        <div className="menu app-download-popover" onMouseLeave={() => setOpen(false)}>
          <AppDownload compact />
        </div>
      )}
    </div>
  );
}
