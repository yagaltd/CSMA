import { PaymentAdaptersService } from './services/PaymentAdaptersService.js';
import { PaymentAdaptersContracts } from './contracts/payment-adapters-contracts.js';

export const manifest = { id: 'payment-adapters', name: 'Payment Adapters', version: '1.0.0', description: 'Client payment adapter registry and safe payment intent UI state', dependencies: [], services: ['paymentAdapters'], contracts: Object.keys(PaymentAdaptersContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { paymentAdapters: PaymentAdaptersService };
export const contracts = PaymentAdaptersContracts;
export { PaymentAdaptersService };
