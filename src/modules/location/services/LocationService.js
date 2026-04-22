const DEFAULT_OPTIONS = {
    enablePersistence: true,
    storeKey: 'csma.location.history',
    historyLimit: 50
};

export class LocationService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.storage = options.storage || null;
        this.geoProvider = options.geoProvider || this.#defaultGeoProvider();
        this.watchId = null;
        this.geofences = new Map();
        this.history = [];
        this.subscriptions = [];
    }

    init({ storageService } = {}) {
        if (storageService) {
            this.storage = storageService;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_LOCATION_START', (payload = {}) => this.startTracking(payload).catch((e) => this.#handleError('start', e))),
                this.eventBus.subscribe('INTENT_LOCATION_STOP', () => this.stopTracking()),
                this.eventBus.subscribe('INTENT_GEOFENCE_ADD', (payload = {}) => this.addGeofence(payload)),
                this.eventBus.subscribe('INTENT_GEOFENCE_REMOVE', ({ id }) => this.removeGeofence(id))
            );
        }
    }

    async startTracking(options = {}) {
        if (!this.geoProvider?.watchPosition) {
            throw new Error('Geolocation unavailable');
        }
        if (this.watchId !== null) {
            return; // already tracking
        }
        this.watchId = this.geoProvider.watchPosition(
            (pos) => this.#handlePosition(pos, options),
            (error) => this.#handleError('watch', error),
            { enableHighAccuracy: options.highAccuracy ?? true, maximumAge: 1000, timeout: 10000 }
        );
    }

    stopTracking() {
        if (this.watchId !== null && this.geoProvider?.clearWatch) {
            this.geoProvider.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    addGeofence({ id, latitude, longitude, radius = 100 }) {
        if (!id) {
            id = this.#generateId();
        }
        this.geofences.set(id, { id, latitude, longitude, radius });
        return id;
    }

    removeGeofence(id) {
        this.geofences.delete(id);
    }

    destroy() {
        this.stopTracking();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
    }

    async #handlePosition(position, options) {
        const coords = position.coords;
        const payload = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            heading: coords.heading,
            speed: coords.speed,
            timestamp: position.timestamp
        };

        this.history.unshift(payload);
        this.history = this.history.slice(0, this.options.historyLimit);

        if (this.options.enablePersistence && this.storage?.setItem) {
            try {
                await this.storage.setItem(this.options.storeKey, JSON.stringify(this.history));
            } catch (err) {
                console.warn('[Location] Unable to persist history', err);
            }
        }

        this.#publish('LOCATION_UPDATED', payload);
        this.#checkGeofences(payload);
    }

    #checkGeofences(point) {
        for (const fence of this.geofences.values()) {
            const distance = this.#haversine(point.latitude, point.longitude, fence.latitude, fence.longitude);
            if (distance <= fence.radius) {
                this.#publish('GEOFENCE_TRIGGERED', {
                    id: fence.id,
                    latitude: point.latitude,
                    longitude: point.longitude,
                    radius: fence.radius,
                    distance,
                    timestamp: point.timestamp
                });
            }
        }
    }

    #haversine(lat1, lon1, lat2, lon2) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    #defaultGeoProvider() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return null;
        }
        return navigator.geolocation;
    }

    #handleError(operation, error) {
        console.warn('[Location]', operation, error);
        this.#publish('LOCATION_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `geo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
