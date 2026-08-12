'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface CartContextValue {
  count: number;
  invalidateCart: () => void;
}

const CartContext = createContext<CartContextValue>({ count: 0, invalidateCart: () => {} });

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    fetch('/api/cart/count')
      .then((res) => res.json())
      .then((data: { count: number }) => {
        if (mountedRef.current) setCount(data.count);
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const invalidateCart = useCallback(() => {
    fetch('/api/cart/count')
      .then((res) => res.json())
      .then((data: { count: number }) => {
        if (mountedRef.current) setCount(data.count);
      })
      .catch(() => {});
  }, []);

  return <CartContext value={{ count, invalidateCart }}>{children}</CartContext>;
}
