import { defineSchema } from '../utils.js';

export const WebPageSchema = defineSchema('WebPage', (input = {}) => ({
    name: input.name || input.title,
    url: input.url,
    description: input.description,
    inLanguage: input.inLanguage,
    isPartOf: input.isPartOf
}));
