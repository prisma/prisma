import Link from 'next/link';
import { getAuthUser } from '../lib/auth';
import { CartBadge } from './cart-badge';
import { NavbarClient } from './navbar-client';

export async function Navbar() {
  const user = await getAuthUser();

  return (
    <nav className="bg-foreground text-background flex items-center px-6 h-14">
      <Link href="/" className="font-bold text-lg mr-8 text-background no-underline">
        Retail Store
      </Link>
      <div className="flex gap-1 items-center">
        <Link
          href="/"
          className="text-background/80 hover:text-background px-3 py-1.5 text-sm font-medium no-underline"
        >
          Products
        </Link>
        <Link
          href="/cart"
          className="text-background/80 hover:text-background px-3 py-1.5 text-sm font-medium no-underline relative"
        >
          Cart
          <CartBadge />
        </Link>
        <Link
          href="/orders"
          className="text-background/80 hover:text-background px-3 py-1.5 text-sm font-medium no-underline"
        >
          Orders
        </Link>
      </div>
      <div className="ml-auto">{user && <NavbarClient userName={user.name as string} />}</div>
    </nav>
  );
}
