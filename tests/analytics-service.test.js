import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { AnalyticsService } from '../src/modules/analytics/services/AnalyticsService.js';

describe('AnalyticsService', () => {
  let eventBus;
  let service;

  beforeEach(() => {
    eventBus = new EventBus();
    eventBus.contracts = Contracts;
    sessionStorage.clear();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    service = new AnalyticsService(eventBus, { endpoint: '/logs/batch' });
  });

  afterEach(() => {
    service?.destroy?.();
    vi.restoreAllMocks();
    delete globalThis.fetchLater;
  });

  it('does not bridge LOG_ENTRY events unless runtime log collection is explicitly enabled', () => {
    service.init({ endpoint: '/logs/batch', collectRuntimeLogs: false });

    eventBus.publish('LOG_ENTRY', {
      type: 'error',
      data: { message: 'Boom' },
      sessionId: 'local-session',
      timestamp: Date.now()
    });

    expect(service.sessionEvents).toHaveLength(0);
    expect(service.analyticsQueue).toHaveLength(0);
  });

  it('bridges selected LOG_ENTRY events when explicitly enabled and redacts payloads by default', () => {
    service.init({ endpoint: '/logs/batch', collectRuntimeLogs: true });

    eventBus.publish('LOG_ENTRY', {
      type: 'error',
      data: {
        message: 'Cannot read property of undefined',
        stack: 'secret stack',
        payload: { token: 'secret' }
      },
      sessionId: 'local-session',
      timestamp: Date.now()
    });

    expect(service.sessionEvents).toHaveLength(1);
    expect(service.sessionEvents[0].category).toBe('error');
    expect(service.sessionEvents[0].data.message).toContain('Cannot read');
    expect(service.sessionEvents[0].data.stack).toBeUndefined();
    expect(service.sessionEvents[0].data.payload).toBeUndefined();
  });

  it('uses fetchLater for lifecycle flushes when available', async () => {
    const fetchLater = vi.fn();
    globalThis.fetchLater = fetchLater;

    service.init({ endpoint: '/logs/batch' });
    service.track('queued_event', { value: 'ok' });

    service.flush({ preferDeferred: true });

    expect(fetchLater).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(service.analyticsQueue).toHaveLength(0);
  });

  it('falls back to sendBeacon for lifecycle flushes before fetch keepalive', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon, userAgent: 'test', language: 'en' });

    service.init({ endpoint: '/logs/batch' });
    service.track('queued_event', { value: 'ok' });

    service.flush({ preferDeferred: true });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(service.analyticsQueue).toHaveLength(0);
  });
});
