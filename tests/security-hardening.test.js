import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';

describe('security hardening regressions', () => {
  it('denies unknown events once contracts are active and emits a security violation', async () => {
    const eventBus = new EventBus();
    const unknownHandler = vi.fn();
    const securityHandler = vi.fn();

    eventBus.contracts = {
      KNOWN_EVENT: {}
    };
    eventBus.subscribe('UNREGISTERED_EVENT', unknownHandler);
    eventBus.subscribe('SECURITY_VIOLATION', securityHandler);

    const results = await eventBus.publish('UNREGISTERED_EVENT', {
      source: 'test',
      timestamp: 123
    });

    expect(results).toEqual([]);
    expect(unknownHandler).not.toHaveBeenCalled();
    expect(securityHandler).toHaveBeenCalledTimes(1);
    expect(securityHandler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'unknown-event',
      eventName: 'UNREGISTERED_EVENT'
    }));
  });
});
