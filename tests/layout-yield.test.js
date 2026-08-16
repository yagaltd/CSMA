import { describe, it, expect, vi } from 'vitest';
import { yieldToMain } from '../src/modules/layout/lib/yield.js';

describe('layout/lib/yield.js — yieldToMain', () => {
    it('is a function that returns a thenable', () => {
        expect(typeof yieldToMain).toBe('function');
        const p = yieldToMain();
        expect(typeof p.then).toBe('function');
        return p;
    });

    it('resolves (setTimeout fallback path in jsdom — no scheduler.yield)', async () => {
        // jsdom has no scheduler.yield; the fallback uses setTimeout(0).
        const t = vi.fn();
        const p = yieldToMain().then(t);
        await p;
        expect(t).toHaveBeenCalledTimes(1);
    });

    it('lets the microtask queue drain before continuing (macrotask boundary)', async () => {
        const order = [];
        Promise.resolve().then(() => order.push('microtask'));
        await yieldToMain();
        order.push('resumed');
        expect(order).toEqual(['microtask', 'resumed']);
    });
});
