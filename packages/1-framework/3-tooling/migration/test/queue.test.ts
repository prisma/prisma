import { describe, expect, it } from 'vitest';
import { Queue } from '../src/queue';

describe('Queue', () => {
  it('is empty when created with no initial items', () => {
    const q = new Queue<string>();
    expect(q.isEmpty).toBe(true);
  });

  it('is empty after all items have been shifted', () => {
    const q = new Queue<number>([1, 2]);
    q.shift();
    q.shift();
    expect(q.isEmpty).toBe(true);
  });

  it('preserves FIFO order across pushes and shifts', () => {
    const q = new Queue<number>([1, 2]);
    q.push(3);
    q.push(4);
    expect(q.shift()).toBe(1);
    expect(q.shift()).toBe(2);
    expect(q.shift()).toBe(3);
    expect(q.shift()).toBe(4);
    expect(q.isEmpty).toBe(true);
  });

  it('accepts pushes after partial draining', () => {
    const q = new Queue<number>([1, 2]);
    expect(q.shift()).toBe(1);
    q.push(3);
    expect(q.shift()).toBe(2);
    expect(q.shift()).toBe(3);
    expect(q.isEmpty).toBe(true);
  });

  it('accepts any iterable as initial items', () => {
    const source = new Set(['a', 'b', 'c']);
    const q = new Queue<string>(source);
    expect(q.shift()).toBe('a');
    expect(q.shift()).toBe('b');
    expect(q.shift()).toBe('c');
  });

  it('throws when shift is called on an empty queue', () => {
    const q = new Queue<string>();
    expect(() => q.shift()).toThrow(/empty/i);
  });

  it('throws when shift is called after the queue has been drained', () => {
    const q = new Queue<number>([1]);
    q.shift();
    expect(() => q.shift()).toThrow(/empty/i);
  });
});
