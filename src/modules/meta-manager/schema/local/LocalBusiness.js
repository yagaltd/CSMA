import { defineSchema } from '../utils.js';

export const LocalBusinessSchema = defineSchema('LocalBusiness', (input = {}) => ({
    name: input.name,
    image: input.image,
    address: input.address,
    telephone: input.telephone,
    openingHours: input.openingHours,
    url: input.url
}));
