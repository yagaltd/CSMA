import { defineSchema } from '../utils.js';

export const HowToSchema = defineSchema('HowTo', (input = {}) => ({
    name: input.name || input.title,
    description: input.description,
    totalTime: input.totalTime,
    supply: input.supply,
    tool: input.tool,
    step: input.step
}));
