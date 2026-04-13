import { describe, expect, it } from 'vitest';

import { activateContractPage, contractRequiresActivation, readRenderPayload } from '../library/runtime/pageActivation.js';

describe('pageActivation', () => {
  it('reads embedded render payloads', () => {
    document.body.innerHTML = '<script type="application/json" id="csma-render-bootstrap">{"contract":{"id":"auth-login","activation":{"required":false}}}</script>';

    expect(readRenderPayload()).toEqual({
      contract: {
        id: 'auth-login',
        activation: {
          required: false
        }
      }
    });
  });

  it('recognizes when a contract requires activation', () => {
    expect(contractRequiresActivation({ activation: { required: false } })).toBe(false);
    expect(contractRequiresActivation({ activation: { required: true } })).toBe(true);
  });

  it('no-ops when the contract does not require activation', async () => {
    document.body.innerHTML = '<script type="application/json" id="csma-render-bootstrap">{"contract":{"id":"auth-login","activation":{"required":false}}}</script>';

    const result = await activateContractPage({
      FEATURES: {},
      documentRef: document,
      windowRef: window
    });

    expect(result).toMatchObject({
      activated: false,
      reason: 'not-required'
    });
  });
});
