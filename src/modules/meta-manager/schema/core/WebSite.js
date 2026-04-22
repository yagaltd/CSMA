import { defineSchema } from '../utils.js';

export const WebSiteSchema = defineSchema('WebSite', (input = {}) => ({
    name: input.name,
    url: input.url,
    description: input.description,
    inLanguage: input.inLanguage
}));
