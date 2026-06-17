import { AdminAuditLogService } from './services/AdminAuditLogService.js';
import { AdminAuditLogContracts } from './contracts/admin-audit-log-contracts.js';

export const manifest = { id: 'admin-audit-log', name: 'Admin Audit Log', version: '1.0.0', description: 'Audit table UI state, filters, and export affordances', dependencies: [], services: ['adminAuditLog'], contracts: Object.keys(AdminAuditLogContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { adminAuditLog: AdminAuditLogService };
export const contracts = AdminAuditLogContracts;
export { AdminAuditLogService };
