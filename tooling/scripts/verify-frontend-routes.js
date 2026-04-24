#!/usr/bin/env node

import { verifyFrontendRoutes } from './frontend-route-utils.js';

const result = verifyFrontendRoutes(process.cwd());

if (result.skipped) {
    console.log('[verify:frontend-routes] No frontend/ directory found. Skipping.');
    process.exit(0);
}

if (!result.ok) {
    console.error('[verify:frontend-routes] Verification failed:');
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log('[verify:frontend-routes] OK');
if (result.expectedRoutes?.length) {
    console.log(`- Verified public routes: ${result.expectedRoutes.join(', ')}`);
}
