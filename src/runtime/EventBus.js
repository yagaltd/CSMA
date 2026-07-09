import { rateLimiter } from './RateLimiter.js';

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_PUBLIC_STRING_LENGTH = 16000;
const MAX_PUBLIC_ARRAY_LENGTH = 1000;
const INTERNAL_SECURITY_EVENTS = new Set(['SECURITY_VIOLATION', 'CONTRACT_VIOLATION', 'SECURITY_RATE_LIMITED']);

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.contracts = null;
    this.observers = new Set();
  }

  subscribe(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(handler);

    return () => {
      const handlers = this.listeners.get(eventName);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  observe(handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }

    this.observers.add(handler);
    return () => {
      this.observers.delete(handler);
    };
  }

  async publish(eventName, payload) {
    const contract = this.contracts?.[eventName];
    if (this.contracts && !contract && !INTERNAL_SECURITY_EVENTS.has(eventName)) {
      this._publishSecurityViolation({
        type: 'unknown-event',
        eventName,
        timestamp: Date.now()
      });
      return [];
    }

    if (contract) {

      // Check rate limits if defined
      const rateLimits = this._normalizeRateLimits(contract.security?.rateLimits);
      if (rateLimits.length > 0) {
        const userId = payload?.userId || 'anonymous';
        for (const limits of rateLimits) {
          const scope = limits.scope || 'session';
          const scopeValue = scope === 'user' ? userId : scope;
          const key = `${eventName}-${scopeValue}`;

          if (!rateLimiter.checkRateLimit(key, limits)) {
            console.warn(`[SECURITY] Rate limit exceeded for ${eventName} (${scope})`);
            this._publishSecurityViolation({
              type: 'rate-limit',
              eventName,
              userId,
              limit: { requests: limits.requests, windowMs: limits.windowMs, scope }
            });
            return []; // Silently fail
          }
        }
      }

      // Validate payload schema
      try {
        const validatedPayload = this._validatePayload(payload, contract.schema);
        payload = validatedPayload;
      } catch (error) {
        console.error(`[SECURITY] Contract violation for ${eventName}:`, error);
        const details = {
          type: 'contract-violation',
          eventName,
          error: error.message,
          payload
        };
        this._publishContractViolation(details);
        this._publishSecurityViolation(details);
        return []; // Silently fail
      }
    }

    const handlers = this.listeners.get(eventName) || [];
    const results = [];

    this._notifyObservers(eventName, payload);

    for (const handler of handlers) {
      try {
        const result = await handler(payload);
        results.push(result);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventName}:`, error);
      }
    }

    return results;
  }

  publishSync(eventName, payload) {
    const contract = this.contracts?.[eventName];
    if (this.contracts && !contract && !INTERNAL_SECURITY_EVENTS.has(eventName)) {
      this._publishSecurityViolation({
        type: 'unknown-event',
        eventName,
        timestamp: Date.now()
      });
      return;
    }

    if (contract) {

      // Check rate limits
      const rateLimits = this._normalizeRateLimits(contract.security?.rateLimits);
      if (rateLimits.length > 0) {
        const userId = payload?.userId || 'anonymous';
        for (const limits of rateLimits) {
          const scope = limits.scope || 'session';
          const scopeValue = scope === 'user' ? userId : scope;
          const key = `${eventName}-${scopeValue}`;

          if (!rateLimiter.checkRateLimit(key, limits)) {
            console.warn(`[SECURITY] Rate limit exceeded for ${eventName} (${scope})`);
            this._publishSecurityViolation({
              type: 'rate-limit',
              eventName,
              userId,
              limit: { requests: limits.requests, windowMs: limits.windowMs, scope }
            });
            return;
          }
        }
      }

      // Validate payload
      try {
        const validatedPayload = this._validatePayload(payload, contract.schema);
        payload = validatedPayload;
      } catch (error) {
        console.error(`[SECURITY] Contract violation for ${eventName}:`, error);
        const details = {
          type: 'contract-violation',
          eventName,
          error: error.message,
          payload
        };
        this._publishContractViolation(details);
        this._publishSecurityViolation(details);
        return;
      }
    }

    const handlers = this.listeners.get(eventName) || [];

    this._notifyObservers(eventName, payload);

    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventName}:`, error);
      }
    });
  }

  _validatePayload(payload, schema) {
    // Schema spoofing protection
    this._scanPayloadSecurity(payload);

    // Apply schema validation - returns [error, value] tuple
    const [error, validatedValue] = schema.validate(payload);
    
    if (error) {
      throw error;
    }
    
    return validatedValue;
  }

  _scanPayloadSecurity(value, path = []) {
    if (typeof value === 'string' && value.length > MAX_PUBLIC_STRING_LENGTH) {
      throw new Error(`Oversized string at ${path.join('.') || 'payload'}`);
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_PUBLIC_ARRAY_LENGTH) {
        throw new Error(`Oversized array at ${path.join('.') || 'payload'}`);
      }
      for (let index = 0; index < value.length; index++) {
        path.push(index);
        try {
          this._scanPayloadSecurity(value[index], path);
        } finally {
          path.pop();
        }
      }
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Schema spoofing attempt detected (prototype pollution)');
    }

    for (const key of Object.keys(value)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        throw new Error(`Prototype pollution key rejected: ${key}`);
      }
      if (/url$/i.test(key) && typeof value[key] === 'string' && !this._isSafeUrl(value[key])) {
        path.push(key);
        const location = path.join('.');
        path.pop();
        throw new Error(`Unsafe URL rejected at ${location}`);
      }
      path.push(key);
      try {
        this._scanPayloadSecurity(value[key], path);
      } finally {
        path.pop();
      }
    }
  }

  _isSafeUrl(value) {
    try {
      const url = new URL(value, globalThis.location?.origin || 'http://localhost');
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  _normalizeRateLimits(rateLimits) {
    if (!rateLimits) {
      return [];
    }
    if (Number.isFinite(rateLimits.requests)) {
      return [{ ...rateLimits, windowMs: rateLimits.windowMs ?? rateLimits.window, scope: rateLimits.scope || 'session' }];
    }
    return Object.values(rateLimits).map((limits) => ({
      ...limits,
      windowMs: limits.windowMs ?? limits.window,
      scope: limits.scope || 'session'
    }));
  }

  _publishSecurityViolation(details) {
    this._emitDirect('SECURITY_VIOLATION', details);
  }

  _publishContractViolation(details) {
    const eventName = details.eventName || details.event || 'unknown';
    this._emitDirect('CONTRACT_VIOLATION', {
      type: 'contract-violation',
      eventName,
      event: eventName,
      error: details.error || 'Contract violation',
      payload: details.payload,
      timestamp: Date.now()
    });
  }

  _emitDirect(eventName, payload) {
    this._notifyObservers(eventName, payload);
    const handlers = this.listeners.get(eventName) || [];
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] ${eventName} handler error:`, error);
      }
    });
  }

  _notifyObservers(eventName, payload) {
    this.observers.forEach((observer) => {
      try {
        observer(eventName, payload);
      } catch (error) {
        console.error(`[EventBus] Observer error for ${eventName}:`, error);
      }
    });
  }
}

export default EventBus;
