import { ImportExportService } from './services/ImportExportService.js';
import { ImportExportContracts } from './contracts/import-export-contracts.js';

export const manifest = { id: 'import-export', name: 'Import Export', version: '1.0.0', description: 'CSV/JSON import preview, client validation, and export downloads', dependencies: [], services: ['importExport'], contracts: Object.keys(ImportExportContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { importExport: ImportExportService };
export const contracts = ImportExportContracts;
export { ImportExportService };
