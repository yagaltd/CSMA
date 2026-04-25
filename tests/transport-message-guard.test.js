import { describe, expect, it } from 'vitest';
import { TransportMessageGuard } from '../src/modules/optimistic-sync/services/TransportMessageGuard.js';

describe('TransportMessageGuard', () => {
    it('accepts valid server messages', () => {
        const guard = new TransportMessageGuard();
        const message = guard.parse(JSON.stringify({
            type: 'channel.snapshot',
            channel: 'todos',
            intents: [],
            cursor: 1
        }));

        expect(message.type).toBe('channel.snapshot');
    });

    it('rejects unknown types, oversized arrays, and cursor replay anomalies', () => {
        const guard = new TransportMessageGuard({ maxArrayLength: 1 });

        expect(() => guard.parse(JSON.stringify({ type: 'unknown' }))).toThrow(/type rejected/);
        expect(() => guard.parse(JSON.stringify({ type: 'replay', intents: [{}, {}] }))).toThrow(/array length/);

        guard.parse(JSON.stringify({ type: 'channel.replay', channel: 'todos', cursor: 3, intents: [] }));
        expect(() => guard.parse(JSON.stringify({
            type: 'channel.replay',
            channel: 'todos',
            cursor: 2,
            intents: []
        }))).toThrow(/cursor/);
    });
});
