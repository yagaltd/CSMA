import { describe, it, expect } from 'vitest';
import { TelemetryCollector } from '../src/modules/static-render/runtime/Telemetry.js';

describe('TelemetryCollector budgets', () => {
  it('flags violations when hydration-to-data duration exceeds budget', () => {
    let now = 0;
    const collector = new TelemetryCollector({
      budgets: { hydrationToDataMs: 5 },
      now: () => now
    });

    collector.recordHydrationStart('demo');
    now = 10;
    collector.recordDataReturned('demo');

    const metrics = collector.snapshot();
    expect(metrics.violations.length).toBe(1);
    expect(metrics.violations[0].type).toBe('hydrationToDataMs');
  });
});
