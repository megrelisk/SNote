'use client';

import { SessionProvider, useSession } from '@/lib/session';
import { SignIn } from './SignIn';
import { Workspace } from './Workspace';

function Shell() {
  const { ready, mode, service } = useSession();
  if (!ready) return <div className="splash"><span className="brand-mark">S</span></div>;
  if (!mode || !service) return <SignIn />;
  return <Workspace />;
}

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
