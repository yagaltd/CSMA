import { describe, expect, it } from 'vitest';

import { collectUxContracts, validateUxContracts } from '../tooling/scripts/ux-contract-utils.js';

describe('ux-contract-utils', () => {
  it('validates the reference UX contract collection', () => {
    const contracts = collectUxContracts();
    const findings = validateUxContracts(contracts);

    expect(contracts.map(({ contract }) => contract.id)).toContain('membership-video-app');
    expect(findings).toEqual([]);
  });
});
