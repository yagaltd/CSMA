import { defineSchema } from '../utils.js';

export const SoftwareApplicationSchema = defineSchema('SoftwareApplication', (input = {}) => ({
    name: input.name,
    applicationCategory: input.applicationCategory,
    operatingSystem: input.operatingSystem,
    offers: input.offers,
    description: input.description
}));
