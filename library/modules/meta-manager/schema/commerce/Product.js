import { defineSchema } from '../utils.js';

export const ProductSchema = defineSchema('Product', (input = {}) => ({
    name: input.name,
    description: input.description,
    image: input.image,
    sku: input.sku,
    brand: input.brand,
    offers: input.offers
}));
