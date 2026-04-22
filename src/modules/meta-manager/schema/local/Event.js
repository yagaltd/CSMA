import { defineSchema } from '../utils.js';

export const EventSchema = defineSchema('Event', (input = {}) => ({
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    location: input.location,
    image: input.image,
    offers: input.offers
}));
