import { DataTableService } from './services/DataTableService.js';

export const manifest = {
    name: 'Data Table Module',
    version: '1.0.0',
    description: 'Remote table loading, sorting, filtering',
    dependencies: [],
    bundleSize: '+5KB',
    contracts: [
        'INTENT_DATA_TABLE_LOAD',
        'INTENT_DATA_TABLE_SORT',
        'INTENT_DATA_TABLE_FILTER',
        'DATA_TABLE_UPDATED',
        'DATA_TABLE_ERROR'
    ]
};

export const services = {
    dataTable: DataTableService
};

export function createDataTable(eventBus, options = {}) {
    const service = new DataTableService(eventBus, options);
    service.init(options);
    return service;
}
