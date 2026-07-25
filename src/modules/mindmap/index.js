import { MindmapService } from './services/MindmapService.js';
import { MindmapContracts } from './contracts/mindmap-contracts.js';

/**
 * mindmap module — interactive local-first mindmap for CSMA.
 *
 * Contributes:
 *   - mindmap service: tree CRUD, undo/redo via history, search,
 *     markdown/ascii/json serialization for agent-context.
 *   - 8 EventBus contracts (MINDMAP_*).
 *   - contextSerializers contribution registering the three formats with
 *     agent-context on module load.
 *
 * Depends on: history (optional, for undo/redo), agent-context (optional,
 * for serializer registration), ai-ui (for component composition),
 * storage (for IDB persistence).
 */

export const manifest = {
  id: 'mindmap',
  name: 'Mindmap',
  version: '1.0.0',
  description: 'Interactive local-first mindmap with headless layout, history-backed undo/redo, and agent-context serializers',
  dependencies: ['history', 'agent-context'],
  services: ['mindmap'],
  contracts: Object.keys(MindmapContracts),
  contributes: {
    contextSerializers: [
      {
        store: 'map_nodes',
        format: 'markdown',
        fn: 'toMarkdown',
        label: 'Mindmap (markdown)',
        default: true
      },
      {
        store: 'map_nodes',
        format: 'ascii',
        fn: 'toAscii',
        label: 'Mindmap (ascii tree)'
      },
      {
        store: 'map_nodes',
        format: 'json',
        fn: 'toMinimalJson',
        label: 'Mindmap (minimal JSON)'
      }
    ]
  }
};

export const services = {
  mindmap: MindmapService
};

export const contracts = MindmapContracts;
