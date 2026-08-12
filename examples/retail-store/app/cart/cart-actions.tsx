'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '../../src/components/cart-provider';
import { Button } from '../../src/components/ui/button';

type CartActionsProps =
  | { mode: 'remove'; productId: string }
  | { mode: 'clear'; productId?: never };

export function CartActions({ productId, mode }: CartActionsProps) {
  const router = useRouter();
  const { invalidateCart } = useCart();
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    setLoading(true);
    try {
      const url =
        mode === 'remove'
          ? `/api/cart?${new URLSearchParams({ productId }).toString()}`
          : '/api/cart';
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Cart action failed (${res.status})`);
      invalidateCart();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'remove') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAction}
        disabled={loading}
        className="text-destructive"
      >
        Remove
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleAction} disabled={loading}>
      {loading ? 'Clearing...' : 'Clear Cart'}
    </Button>
  );
}
