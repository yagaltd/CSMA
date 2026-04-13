import { defineSchema } from '../utils.js';

export const FAQPageSchema = defineSchema('FAQPage', (input = {}) => ({
    mainEntity: input.mainEntity
}));
