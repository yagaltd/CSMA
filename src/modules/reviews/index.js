import { ReviewsService } from './services/ReviewsService.js';
import { ReviewsContracts } from './contracts/reviews-contracts.js';

export const manifest = { id: 'reviews', name: 'Reviews', version: '1.0.0', description: 'Rating summary UI state, review form state, and optimistic review submission', dependencies: [], services: ['reviews'], contracts: Object.keys(ReviewsContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { reviews: ReviewsService };
export const contracts = ReviewsContracts;
export { ReviewsService };
