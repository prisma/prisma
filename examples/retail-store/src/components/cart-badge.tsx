'use client';

import { useCart } from './cart-provider';

export function CartBadge() {
  const { count } = useCart();
  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
      {count}
    </span>
  );
}
