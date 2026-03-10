import IslandRuntime from './runtime/IslandRuntime.js';

export const manifest = {
    id: 'static-render',
    name: 'Static Render Module',
    version: '0.1.0',
    description: 'Loads static island registry and hydrates client-side islands',
    dependencies: ['network-status'],
    services: ['islandRuntime'],
    contracts: ['ISLAND_HYDRATION_INITIATED', 'ISLAND_DATA_REQUESTED', 'ISLAND_INVALIDATED']
};

export const services = {
    islandRuntime: IslandRuntime
};
