import { CommentsService } from './services/CommentsService.js';
import { AnchorableCommentsService } from './services/AnchorableCommentsService.js';
import { AnchorResolver } from './services/AnchorResolver.js';
import { CommentsContracts } from './contracts/comments-contracts.js';

export const manifest = { id: 'comments', name: 'Comments', version: '1.1.0', description: 'Comment list UI, optimistic submit/edit/delete states, moderation labels, and anchorable (Phase 4) comments with IDB persistence', dependencies: ['storage'], services: ['comments', 'anchorableComments'], contracts: Object.keys(CommentsContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { comments: CommentsService, anchorableComments: AnchorableCommentsService };
export const contracts = CommentsContracts;
export { CommentsService, AnchorableCommentsService, AnchorResolver };
