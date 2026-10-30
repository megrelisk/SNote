'use client';

import { useSession } from '@/lib/session';
import { AppDownload } from './AppDownload';

export function SignIn() {
  const { cloudAvailable, signInWithGoogle, continueLocally, error } = useSession();
  return (
    <div className="signin">
      <div className="signin-card">
        <div className="brand large">
          <span className="brand-mark">S</span> SNote
        </div>
        <p className="tagline">Block-based notes organised in Drives and Folders. Works offline, syncs everywhere, remembers when every block was written.</p>
        {cloudAvailable ? (
          <button className="google-btn" onClick={() => void signInWithGoogle()}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        ) : (
          <button className="primary signin-start" onClick={continueLocally}>
            Start writing
          </button>
        )}
        {cloudAvailable && (
          <button className="ghost" onClick={continueLocally}>
            Continue without an account
          </button>
        )}
        <p className="hint small">
          {cloudAvailable
            ? 'Without an account, notes stay in this browser only.'
            : 'Notes are saved in this browser. Google sign-in and live sync between your devices are coming soon.'}
        </p>
        {error && <p className="error-text">{error}</p>}
        <AppDownload />
      </div>
    </div>
  );
}
