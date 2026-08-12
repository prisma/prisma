'use client';

import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

export function NavbarClient({ userName }: { userName: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-background/70">{userName}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-background/70 hover:text-background"
      >
        Log out
      </Button>
    </div>
  );
}
