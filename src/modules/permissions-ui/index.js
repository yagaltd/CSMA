import { PermissionsUIService } from './services/PermissionsUIService.js';
import { PermissionsUIContracts } from './contracts/permissions-ui-contracts.js';

export const manifest = { id: 'permissions-ui', name: 'Permissions UI', version: '1.0.0', description: 'Role and capability-aware UI visibility and route affordances', dependencies: [], services: ['permissionsUI'], contracts: Object.keys(PermissionsUIContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { permissionsUI: PermissionsUIService };
export const contracts = PermissionsUIContracts;
export { PermissionsUIService };
