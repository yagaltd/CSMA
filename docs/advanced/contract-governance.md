# Advanced: Contract Governance with JSON Manifests

This guide describes an advanced contract governance system using JSON manifest files. This pattern is **optional** and recommended for:

- Production apps with 50+ contracts
- Multi-team development
- External partner integrations
- Regulatory compliance requirements

For smaller apps, the inline contract definitions in `src/runtime/Contracts.js` are sufficient and recommended.

---

## Overview

This governance system provides:
- Centralized contract registry
- Machine-readable JSON manifests
- Full ECCA/C-DAD compliance
- Automated validation and documentation generation

**Status**: This is an **advanced pattern** not currently implemented in the starter template. Use inline contracts in `Contracts.js` for most projects.

---

## Directory Structure

```
src/contracts/
├── registry.json              # Central catalog of all contracts
├── manifests/
│   ├── schema.json            # JSON Schema for manifest validation
│   ├── events/
│   │   ├── audio-stopped.json
│   │   ├── note-saved.json
│   │   └── media-processed.json
│   └── intents/
│       └── intent-upload-video.json
```

---

## Registry Format

**File**: `src/contracts/registry.json`

```json
{
    "version": "1.0.0",
    "generatedAt": "2025-12-02T10:00:00Z",
    "contracts": [
        {
            "id": "AUDIO_STOPPED",
            "path": "src/contracts/manifests/events/audio-stopped.json",
            "version": 1,
            "lifecycle": "active"
        },
        {
            "id": "OLD_AUDIO_STOPPED",
            "path": "src/contracts/manifests/events/old-audio-stopped.json",
            "version": 1,
            "lifecycle": "deprecated"
        }
    ]
}
```

**Purpose**:
- Single source of truth for all contracts
- Enables contract discovery and browsing
- Tracks lifecycle states across all contracts
- Machine-readable for tooling

---

## Manifest Format

**File**: `src/contracts/manifests/events/audio-stopped.json`

```json
{
    "id": "AUDIO_STOPPED",
    "version": 1,
    "type": "event",
    "description": "Emitted when audio recording completes.",
    "owner": "audio-service",
    "lifecycle": "active",
    "stability": "stable",
    "compliance": "public",
    "rationale": "Decouples recording UI from transcription service",
    "schema": {
        "type": "object",
        "properties": {
            "audioBlob": {
                "type": "object",
                "description": "Recorded audio as Blob"
            },
            "duration": {
                "type": "number",
                "description": "Recording duration in seconds"
            },
            "timestamp": {
                "type": "number",
                "description": "Unix timestamp"
            }
        },
        "required": ["audioBlob", "duration", "timestamp"]
    },
    "links": {
        "adr": "docs/adr/0001-event-driven-architecture.md"
    }
}
```

### Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Event/intent name (matches EventBus) |
| `version` | ✅ | Contract version (increment on breaking changes) |
| `type` | ✅ | `event` or `intent` |
| `description` | ✅ | Human-readable purpose |
| `owner` | ✅ | Service responsible for this contract |
| `lifecycle` | ✅ | `draft \| active \| deprecated \| retired` |
| `stability` | ✅ | `experimental \| stable` |
| `compliance` | ✅ | `public \| pii \| confidential` |
| `rationale` | Recommended | Design reasoning (C-DAD Principle 3) |
| `schema` | ✅ | JSON Schema for payload |
| `links.adr` | Optional | Link to Architecture Decision Record |
| `deprecation` | If deprecated | Deprecation metadata |

---

## Deprecation Workflow

When deprecating a contract:

**1. Update Manifest:**
```json
{
    "id": "OLD_AUDIO_STOPPED",
    "lifecycle": "deprecated",
    "deprecation": {
        "since": "2024-11-01",
        "removeBy": "2025-03-01",
        "reason": "Replaced with unified audio event format",
        "replacement": "AUDIO_STOPPED",
        "migrationGuide": "Update payload to include audioBlob instead of fileUrl"
    }
}
```

**2. Update Registry:**
```json
{
    "id": "OLD_AUDIO_STOPPED",
    "lifecycle": "deprecated"
}
```

**3. EventBus Warnings:**
EventBus automatically warns when deprecated contracts are published (if using `DeprecatedEvents` set).

---

## JSON Schema Validation

**File**: `src/contracts/manifests/schema.json`

Defines the structure all manifest files must follow:

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["id", "version", "type", "description", "owner", "lifecycle", "schema"],
    "properties": {
        "id": {
            "type": "string",
            "pattern": "^[A-Z_]+$"
        },
        "version": {
            "type": "integer",
            "minimum": 1
        },
        "lifecycle": {
            "enum": ["draft", "active", "deprecated", "retired"]
        }
    }
}
```

**Usage**: Validate manifests in CI/CD:
```bash
npm run validate-contracts
```

---

## Benefits

### 1. **Discoverability**
- Developers can browse `registry.json` to find available contracts
- External partners can discover public contracts
- AI assistants can read contracts programmatically

### 2. **Governance**
- Lifecycle tracking prevents accidental use of deprecated contracts
- Ownership clarity (who maintains each contract)
- Compliance tags enable PII auditing

### 3. **Automation**
- Generate documentation from manifests
- Validate contracts in CI/CD
- Auto-generate TypeScript types
- Create OpenAPI specs for external APIs

### 4. **Versioning**
- Track breaking changes via version increments
- Multiple versions can coexist during migration
- Clear deprecation timeline

---

## Tooling Example

**scripts/generate-contract-docs.js**:
```javascript
import fs from 'fs';
import registry from '../src/contracts/registry.json';

// Generate markdown documentation
const docs = registry.contracts.map(contract => {
    const manifest = JSON.parse(fs.readFileSync(contract.path));
    return `## ${manifest.id}
**Owner**: ${manifest.owner}
**Status**: ${manifest.lifecycle}

${manifest.description}

**Payload**:
\`\`\`json
${JSON.stringify(manifest.schema, null, 2)}
\`\`\`
`;
}).join('\n---\n');

fs.writeFileSync('docs/CONTRACTS.md', docs);
```

---

## Migration from Inline Contracts

If you have inline contracts in `Contracts.js` and want to migrate:

**Step 1**: Create manifest files
```bash
mkdir -p src/contracts/manifests/{events,intents}
```

**Step 2**: Extract metadata
For each contract in `Contracts.js`, create a JSON file:
```javascript
// FROM:
export const ITEM_SAVED = {
    version: 1,
    type: 'event',
    owner: 'storage-service',
    // ...
    schema: object({ /* ... */ })
};

// TO: src/contracts/manifests/events/item-saved.json
{
    "id": "ITEM_SAVED",
    "version": 1,
    "type": "event",
    "owner": "storage-service",
    "schema": { /* JSON Schema representation */ }
}
```

**Step 3**: Update EventBus
Load contracts from JSON instead of importing `Contracts.js`:
```javascript
const registry = await fetch('/contracts/registry.json').then(r => r.json());
const contracts = {};

for (const contract of registry.contracts) {
    const manifest = await fetch(`/${contract.path}`).then(r => r.json());
    contracts[manifest.id] = manifest;
}

eventBus.contracts = contracts;
```

---

## When NOT to Use JSON Manifests

**Skip this pattern if:**
- You have < 50 contracts
- Single developer or small team
- No external partners
- No regulatory compliance needs
- Simplicity is more important than governance

**Inline contracts in `Contracts.js` are perfectly fine** for most CSMA apps.

---

## Production Deployment & CI/CD Integration

### Pre-Deployment Checklist

**Before deploying contracts to production:**

1. ✅ **Validation Check**: `npm run validate-contracts`
2. ✅ **Schema Integrity**: All schemas follow JSON Schema validation
3. ✅ **Lifecycle State**: Contract must be `active` or `deprecated` (not `draft`)
4. ✅ **Dependencies**: All `dependsOn` contracts exist and are `active`
5. ✅ **Test Coverage**: Unit tests for all contract validation paths
6. ✅ **Documentation**: Contract rationale documented (C-DAD Principle 3)
7. ✅ **Version Consistency**: Import paths match version numbers
8. ✅ **Deprecation Audit**: No newly published events depend on deprecated contracts

### CI/CD Pipeline

**GitHub Actions Example**:
```yaml
name: Contract Validation
on: [push, pull_request]

jobs:
  validate-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run validate-contracts
      - run: npm test
```

**What CI Checks**:
- ✅ JSON Schema validation of all manifests
- ✅ Lifecycle state transitions are valid
- ✅ No orphaned contracts (no owner)
- ✅ Schema properties match validation library capabilities
- ✅ All `links.adr` point to valid ADR files
- ✅ Dependencies exist and have compatible versions

### Production Monitoring

**Track These Metrics** (via LogAccumulator):

```javascript
// Monitor contract validation failures
const CONTRACT_VALIDATION_FAILURES = [];

// Track event publishing by contract lifecycle
const CONTRACT_LIFECYCLE_COUNT = {
    draft: 0,      // Should be 0 in production!
    active: 0,
    deprecated: 0, // Should be decreasing
    retired: 0     // Should be 0 in production!
};
```

**Log Usage Patterns**:
```javascript
// Log which contracts are published/published to
logContractUsage(contractId, lifecycle) {
    CONTRACT_LIFECYCLE_COUNT[lifecycle]++;
    
    if (lifecycle === 'draft') {
        console.error('DRAFT contract published in production!', contractId);
    }
    if (lifecycle === 'retired') {
        console.error('RETIRED contract used!', contractId);
    }
}
```

### Contract Version Rollbacks

**Safe Rollback Procedure**:

If new contract version causes issues:

1. **Change version reference** (no contract modification):
```javascript
// BEFORE (failing version)
import { NOTE_SAVED } from './contracts/v2.0.0';

// AFTER (rollback)
import { NOTE_SAVED } from './contracts/v1.9.0';
```

2. **Marked as rollback in lockfile**:
```json
{
    "contract": "NOTE_SAVED",
    "selected": "1.9.0",
    "reason": "rollback due to field validation issue"
}
```

3. **Deprecated version kept for 30 days**:
```javascript
export const NOTE_SAVED = {
    version: "2.0.0",
    lifecycle: "deprecated",
    deprecation: {
        since: "2024-12-06",
        removeBy: "2025-01-06",  // 30 days
        reason: "Validation bug in blob field"
    }
};
```

4. **Notify consumers** via registry:
```javascript
// src/contracts/registry.json
{
    "id": "NOTE_SAVED",
    "v2.0.0": {
        "status": "deprecated",
        "rollbackTo": "1.9.0"
    }
}
```

### Schema Migration Pattern

**Example: Adding a required field (breaking change)**:

**V1 to V2 Migration**:
```json
{
    "id": "NOTE_SAVED",
    "v1": {
        "schema": {
            "properties": {
                "text": "string"
            }
        }
    },
    "v2": {
        "schema": {
            "properties": {
                "text": "string",
                "timestamp": "number"  // NEW required field
            },
            "required": ["text", "timestamp"]
        },
        "migration": {
            "fromV1": "Add timestamp: Date.now() if missing"
        }
    }
}
```

**Migration Script in CI**:
```javascript
// scripts/migrate-contracts.js
export async function migrateNotesToV2() {
    const notes = await storage.get('notes.*');
    
    for (const note of notes) {
        if (!note.timestamp) {
            note.timestamp = note.id.split('_')[1] || Date.now();
            await storage.put(note.id, note);
        }
    }
}
```

### Production Rollback Checklist

**Before Rolling Back Contracts**:

- [ ] Backup current data (to blob storage)
- [ ] Document rollback reason (incident report)
- [ ] Check if consumers need migration
- [ ] Verify old version doesn't have known vulnerabilities
- [ ] Update lockfile with justification
- [ ] Notify stakeholders
- [ ] Plan remediation timeline
- [ ] Schedule follow-up review

### Environment-Specific Contracts

**Development vs Production**:

```javascript
// src/config/contracts.js
export const getContracts = (env) => {
    const base = {
        'NOTE_SAVED': NOTE_SAVED_V1,
        'AUDIO_STOPPED': AUDIO_STOPPED_V2
    };
    
    if (env === 'development') {
        return {
            ...base,
            'EXPERIMENTAL_FEATURE': EXPERIMENTAL_V1,
            'MOCK_DATA': MOCK_V1
        };
    }
    
    // Production: Only stable contracts
    return base;
};
```

**Production Lockfile**:
```json
{
    "environment": "production",
    "contracts": {
        "NOTE_SAVED": {
            "version": "1.0.0",
            "status": "active"
        },
        "AUDIO_STOPPED": {
            "version": "2.0.0", 
            "status": "active"
        }
    },
    "lockedAt": "2025-12-06T18:00:00Z",
    "lockedBy": "CI/CD Pipeline #471"
}
```

### Tracking Contract Evolution

**Analytics Events**:

Track these in production analytics:

```javascript
analytics.track('contract_published', {
    contract: 'NOTE_SAVED',
    version: '2.0.0',
    lifecycle: 'active',
    timestamp: Date.now()
});

analytics.track('contract_deprecated', {
    contract: 'NOTE_SAVED_V1',
    replacement: 'NOTE_SAVED_V2',
    removedBy: '2025-01-01'
});

analytics.track('contract_rollback', {
    contract: 'NOTE_SAVED',
    fromVersion: '2.0.0',
    toVersion: '1.9.0',
    reason: 'validation_issue'
});
```

**Dashboard Metrics**:
- Active contracts by owner
- Deprecated contracts still in use
- Migration completion rate
- Time-to-upgrade (v1 → v2)

---

## Summary

**JSON Manifests** provide enterprise-grade contract governance but add complexity. Use them when:
- You need machine-readable contracts
- Multiple teams collaborate
- External partners integrate
- Compliance requires documentation

**For most CSMA apps, stick with inline contracts in `Contracts.js`** - it's simpler, more maintainable, and perfectly adequate.

---

## Further Reading

- [Complete CSMA Guide](../complete-csma-guide.md)
- [Contract Validation](../guides/validation.md)
- [Security Best Practices](../security/security-map.md)
