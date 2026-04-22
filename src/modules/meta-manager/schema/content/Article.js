import { defineSchema } from '../utils.js';

export const ArticleSchema = defineSchema('Article', (input = {}) => ({
    headline: input.headline || input.title,
    description: input.description,
    image: input.image,
    author: input.author,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    mainEntityOfPage: input.mainEntityOfPage,
    publisher: input.publisher
}));
