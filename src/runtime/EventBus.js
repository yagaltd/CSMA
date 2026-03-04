import { rateLimiter } from './RateLimiter.js';

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.contracts = null;
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

  async publish(eventName, payload) {
    // Validate payload if contracts are available
    if (this.contracts && this.contracts[eventName]) {
      const contract = this.contracts[eventName];

      // Check rate limits if defined
      if (contract.security?.rateLimits) {
        const userId = payload.userId || 'anonymous';
        const key = `${eventName}-${userId}`;

        for (const [limitType, limits] of Object.entries(contract.security.rateLimits)) {
          if (!rateLimiter.checkRateLimit(`${key}-${limitType}`, limits)) {
            console.warn(`[SECURITY] Rate limit exceeded for ${eventName} (${limitType})`);
            this._publishSecurityViolation({
              type: 'rate-limit',
              eventName,
              userId,
              limitType,
              payload: limits
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
        this._publishSecurityViolation({
          type: 'contract-violation',
          eventName,
          error: error.message,
          payload
        });
        return []; // Silently fail
      }
    }

    const handlers = this.listeners.get(eventName) || [];
    const results = [];

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
    // Apply same validation as async publish
    if (this.contracts && this.contracts[eventName]) {
      const contract = this.contracts[eventName];

      // Check rate limits
      if (contract.security?.rateLimits) {
        const userId = payload.userId || 'anonymous';
        const key = `${eventName}-${userId}`;

        for (const [limitType, limits] of Object.entries(contract.security.rateLimits)) {
          if (!rateLimiter.checkRateLimit(`${key}-${limitType}`, limits)) {
            console.warn(`[SECURITY] Rate limit exceeded for ${eventName} (${limitType})`);
            this._publishSecurityViolation({
              type: 'rate-limit',
              eventName,
              userId,
              limitType,
              payload: limits
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
        this._publishSecurityViolation({
          type: 'contract-violation',
          eventName,
          error: error.message,
          payload
        });
        return;
      }
    }

    const handlers = this.listeners.get(eventName) || [];

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
    if (payload && typeof payload === 'object') {
      // Prevent prototype pollution
      if (payload.__proto__ !== Object.prototype || payload.constructor !== Object) {
        throw new Error('Schema spoofing attempt detected (prototype pollution)');
      }

      // Prevent constructor.name spoofing
      if (payload.constructor && payload.constructor !== Object) {
        throw new Error('Schema spoofing attempt detected (constructor manipulation)');
      }
    }

    // Apply schema validation - returns [error, value] tuple
    const [error, validatedValue] = schema.validate(payload);
    
    if (error) {
      throw error;
    }
    
    return validatedValue;
  }

  _publishSecurityViolation(details) {
    // Publish security violation event (no validation to avoid infinite loop)
    const handlers = this.listeners.get('SECURITY_VIOLATION') || [];
    handlers.forEach(handler => {
      try {
        handler(details);
      } catch (error) {
        console.error('[EventBus] Security violation handler error:', error);
      }
    });
  }
}

export default EventBus;
