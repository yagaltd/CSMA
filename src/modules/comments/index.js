import { CommentsService } from './services/CommentsService.js';
import { CommentsContracts } from './contracts/comments-contracts.js';

export const manifest = { id: 'comments', name: 'Comments', version: '1.0.0', description: 'Comment list UI, optimistic submit/edit/delete states, and moderation labels', dependencies: [], services: ['comments'], contracts: Object.keys(CommentsContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { comments: CommentsService };
export const contracts = CommentsContracts;
export { CommentsService };
