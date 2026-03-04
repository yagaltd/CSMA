import { LocationService } from './services/LocationService.js';

export const manifest = {
    name: 'Location Module',
    version: '1.0.0',
    description: 'Geolocation tracking with optional geofencing and persistence',
    dependencies: [],
    bundleSize: '+3KB',
    contracts: [
        'INTENT_LOCATION_START',
        'INTENT_LOCATION_STOP',
        'INTENT_GEOFENCE_ADD',
        'INTENT_GEOFENCE_REMOVE',
        'LOCATION_UPDATED',
        'GEOFENCE_TRIGGERED',
        'LOCATION_ERROR'
    ]
};

export const services = {
    location: LocationService
};

export function createLocation(eventBus, options = {}) {
    const service = new LocationService(eventBus, options);
    service.init(options);
    return service;
}
