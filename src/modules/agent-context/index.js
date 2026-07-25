import { AgentContextService } from './services/AgentContextService.js';
import { AgentContextContracts } from './contracts/agent-context-contracts.js';

export const manifest = {
    id: 'agent-context',
    name: 'Agent Context',
    version: '1.0.0',
    description: 'Generic in-browser LLM context API with format negotiation and per-module serializer dispatch',
    dependencies: [],
    services: ['agentContext'],
    contracts: Object.keys(AgentContextContracts),
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: [],
        // agent-context OWNS the serializer registry (wired in bootstrap);
        // it does not contribute serializers to itself.
        contextSerializers: []
    }
};

export const services = {
    agentContext: AgentContextService
};

export const contracts = AgentContextContracts;

export { AgentContextService };
export { SerializerRegistry } from '../../runtime/SerializerRegistry.js';
