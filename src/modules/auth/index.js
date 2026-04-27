import { AuthService, createAuthService } from './services/AuthService.js';
import { AuthContracts } from './contracts/auth-contracts.js';

export const manifest = {
    id: 'auth',
    name: 'Auth Module',
    version: '1.0.0',
    description: 'Hybrid session, JWT, and backend-mediated OAuth authentication',
    dependencies: [],
    services: ['auth'],
    bundleSize: '+10KB',
    contracts: [
        'INTENT_AUTH_LOGIN',
        'INTENT_AUTH_REGISTER',
        'INTENT_AUTH_LOGOUT',
        'INTENT_AUTH_FORGOT_PASSWORD',
        'INTENT_AUTH_RESET_PASSWORD',
        'INTENT_AUTH_VERIFY_EMAIL',
        'INTENT_AUTH_RESEND_VERIFICATION',
        'INTENT_AUTH_REFRESH_SESSION',
        'INTENT_AUTH_START_OAUTH',
        'INTENT_AUTH_HANDLE_OAUTH_CALLBACK',
        'AUTH_SESSION_UPDATED',
        'AUTH_LOGIN_SUCCEEDED',
        'AUTH_LOGIN_FAILED',
        'USER_LOGGED_IN',
        'USER_LOGGED_OUT',
        'USER_REGISTERED',
        'AUTH_ERROR',
        'TOKEN_REFRESHED',
        'SESSION_EXPIRED',
        'AUTH_OAUTH_STARTED',
        'AUTH_OAUTH_COMPLETED',
        'AUTH_OAUTH_FAILED',
        'AUTH_PASSWORD_RESET_REQUESTED',
        'AUTH_PASSWORD_RESET_COMPLETED',
        'AUTH_EMAIL_VERIFIED',
        'AUTH_VERIFICATION_RESENT',
        'AUTH_ACCOUNT_ACTION_FAILED'
    ]
};

export const services = {
    auth: AuthService
};

export { AuthService, createAuthService };
export const contracts = AuthContracts;
