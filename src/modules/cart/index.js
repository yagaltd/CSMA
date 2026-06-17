import { CartService } from './services/CartService.js';
import { CartContracts } from './contracts/cart-contracts.js';

export const manifest = { id: 'cart', name: 'Cart', version: '1.0.0', description: 'Client cart state, quantity changes, local persistence, and optimistic totals preview', dependencies: [], services: ['cart'], contracts: Object.keys(CartContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { cart: CartService };
export const contracts = CartContracts;
export { CartService };
