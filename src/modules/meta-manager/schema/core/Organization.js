import { defineSchema } from '../utils.js';

export const OrganizationSchema = defineSchema('Organization', (input = {}) => ({
    name: input.name,
    url: input.url,
    logo: input.logo,
    sameAs: input.sameAs
}));
