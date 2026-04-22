import { defineSchema } from '../utils.js';

export const BreadcrumbListSchema = defineSchema('BreadcrumbList', (input = {}) => ({
    itemListElement: input.itemListElement
}));
