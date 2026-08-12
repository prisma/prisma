import type { CartItemInput } from '../contract';
import type { Db } from '../db';

export function getCartByUserId(db: Db, userId: string) {
  return db.orm.carts.where({ userId }).first();
}

export function getCartWithUser(db: Db, userId: string) {
  return db.orm.carts.include('user').where({ userId }).first();
}

export function upsertCart(db: Db, userId: string, items: ReadonlyArray<CartItemInput>) {
  return db.orm.carts.where({ userId }).upsert({
    create: { userId, items: [...items] },
    update: { items: [...items] },
  });
}

export function clearCart(db: Db, userId: string) {
  return db.orm.carts.where({ userId }).update({ items: [] });
}

export function addToCart(db: Db, userId: string, item: CartItemInput) {
  return db.orm.carts.where({ userId }).upsert({
    create: { userId, items: [item] },
    update: (u) => [u.items.push(item)],
  });
}

export function removeFromCart(db: Db, userId: string, productId: string) {
  return db.orm.carts.where({ userId }).update((u) => [u.items.pull({ productId })]);
}
