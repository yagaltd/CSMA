export const MODULE_CONTRIBUTION_TYPES = ['commands', 'routes', 'navigation', 'panels', 'adapters'];

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[ModuleManifest] ${label} must be a non-empty string`);
    }

    return value.trim();
}

function ensureStringArray(value, label) {
    if (value === undefined) {
        return [];
    }

    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
        throw new Error(`[ModuleManifest] ${label} must be an array of non-empty strings`);
    }

    return value.map((entry) => entry.trim());
}

function ensureServiceMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('[ModuleManifest] services must be an object');
    }

    const services = {};
    for (const [serviceName, ServiceClass] of Object.entries(value)) {
        if (typeof serviceName !== 'string' || serviceName.trim() === '') {
            throw new Error('[ModuleManifest] service names must be non-empty strings');
        }

        if (typeof ServiceClass !== 'function') {
            throw new Error(`[ModuleManifest] service "${serviceName}" must be a constructor/function`);
        }

        services[serviceName] = ServiceClass;
    }

    return services;
}

function ensureContributes(value) {
    if (value === undefined) {
        return {};
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('[ModuleManifest] contributes must be an object');
    }

    const unknownTypes = Object.keys(value).filter((type) => !MODULE_CONTRIBUTION_TYPES.includes(type));
    if (unknownTypes.length > 0) {
        throw new Error(`[ModuleManifest] Unknown contribution types: ${unknownTypes.join(', ')}`);
    }

    const contributes = {};
    MODULE_CONTRIBUTION_TYPES.forEach((type) => {
        const entries = value[type];
        if (entries === undefined) {
            return;
        }

        if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
            throw new Error(`[ModuleManifest] contributes.${type} must be an array of objects`);
        }

        contributes[type] = entries.map((entry) => ({ ...entry }));
    });

    return contributes;
}

export function validateModuleDefinition(moduleId, moduleDefinition) {
    if (!moduleDefinition || typeof moduleDefinition !== 'object') {
        throw new Error(`[ModuleManifest] Module "${moduleId}" must export an object`);
    }

    const manifest = moduleDefinition.manifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error(`[ModuleManifest] Module "${moduleId}" must export a manifest object`);
    }

    const normalizedId = ensureString(manifest.id || moduleId, 'manifest.id');
    if (normalizedId !== moduleId) {
        throw new Error(`[ModuleManifest] manifest.id "${normalizedId}" must match module path "${moduleId}"`);
    }

    const services = ensureServiceMap(moduleDefinition.services || {});
    const serviceNames = ensureStringArray(manifest.services, 'manifest.services');
    const definedServiceNames = Object.keys(services);

    const missingServices = serviceNames.filter((serviceName) => !(serviceName in services));
    if (missingServices.length > 0) {
        throw new Error(`[ModuleManifest] manifest.services references unknown services: ${missingServices.join(', ')}`);
    }

    const undocumentedServices = definedServiceNames.filter((serviceName) => !serviceNames.includes(serviceName));
    if (undocumentedServices.length > 0) {
        throw new Error(`[ModuleManifest] manifest.services is missing declared services: ${undocumentedServices.join(', ')}`);
    }

    return {
        manifest: {
            id: normalizedId,
            name: ensureString(manifest.name, 'manifest.name'),
            version: ensureString(manifest.version, 'manifest.version'),
            description: ensureString(manifest.description, 'manifest.description'),
            dependencies: ensureStringArray(manifest.dependencies, 'manifest.dependencies'),
            services: serviceNames,
            contracts: ensureStringArray(manifest.contracts, 'manifest.contracts'),
            contributes: ensureContributes(manifest.contributes)
        },
        services,
        contracts: moduleDefinition.contracts || {}
    };
}
