import { MentionParser } from './services/MentionParser.js';
import { MentionResolver } from './services/MentionResolver.js';
import { MentionBridge } from './services/MentionBridge.js';
import { MentionsContracts } from './contracts/mentions-contracts.js';

export const manifest = {
    id: 'mentions',
    name: 'Mentions',
    version: '1.0.0',
    description: '@mention parsing, resolution, and AI bridge for comment bodies',
    dependencies: ['ai'],
    services: ['mentionParser', 'mentionResolver', 'mentionBridge'],
    contracts: Object.keys(MentionsContracts),
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    mentionParser: MentionParser,
    mentionResolver: MentionResolver,
    mentionBridge: MentionBridge
};
export const contracts = MentionsContracts;
export { MentionParser, MentionResolver, MentionBridge };
