import { defineSchema } from '../utils.js';

export const PersonSchema = defineSchema('Person', (input = {}) => ({
    name: input.name,
    url: input.url,
    image: input.image,
    sameAs: input.sameAs,
    jobTitle: input.jobTitle
}));
