import { scheduleLoadHydration } from './LoadHydrator.js';
import { scheduleVisibleHydration } from './VisibleHydrator.js';
import { scheduleIdleHydration } from './IdleHydrator.js';
import { scheduleManualHydration } from './ManualHydrator.js';

export function getHydrator(trigger) {
    switch (trigger) {
        case 'load':
            return (_element, callback) => scheduleLoadHydration(callback);
        case 'idle':
            return (_element, callback) => scheduleIdleHydration(callback);
        case 'manual':
            return (_element, callback) => scheduleManualHydration(callback);
        case 'visible':
        default:
            return (element, callback) => scheduleVisibleHydration(element, callback);
    }
}
