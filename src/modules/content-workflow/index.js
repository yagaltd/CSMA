import { ContentWorkflowService } from './services/ContentWorkflowService.js';
import { ContentWorkflowContracts } from './contracts/content-workflow-contracts.js';

export const manifest = { id: 'content-workflow', name: 'Content Workflow', version: '1.0.0', description: 'Draft, review, publish, and schedule UI states for content workflows', dependencies: [], services: ['contentWorkflow'], contracts: Object.keys(ContentWorkflowContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { contentWorkflow: ContentWorkflowService };
export const contracts = ContentWorkflowContracts;
export { ContentWorkflowService };
