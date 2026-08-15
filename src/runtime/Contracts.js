/**
 * CSMA Contracts
 * All event/intent schemas with validation
 *
 * Contract groups live in src/runtime/contracts/*.js (one file per runtime
 * owner: channels, cache, api wrapper, form validation, UI components, …).
 * This file is the merge facade — it re-exports the shared helpers and the
 * merged `Contracts` map so `eventBus.contracts = Contracts` keeps working.
 * The contract-drift check (tooling/scripts/check-security.js) collects names
 * from this file and from every src/runtime/contracts/*-contracts.js via
 * loadContractCollections().
 */
import { ThemeContracts } from './contracts/theme-contracts.js';
import { FileUploadContracts } from './contracts/file-upload-contracts.js';
import { CacheContracts } from './contracts/cache-contracts.js';
import { DatepickerContracts } from './contracts/datepicker-contracts.js';
import { InputContracts } from './contracts/input-contracts.js';
import { OverlayContracts } from './contracts/overlay-contracts.js';
import { ToastContracts } from './contracts/toast-contracts.js';
import { PageContracts } from './contracts/page-contracts.js';
import { AuthContracts } from './contracts/auth-contracts.js';
import { HmacContracts } from './contracts/hmac-contracts.js';
import { LogContracts } from './contracts/log-contracts.js';
import { PaginationContracts } from './contracts/pagination-contracts.js';
import { SecurityContracts } from './contracts/security-contracts.js';
import { TabsContracts } from './contracts/tabs-contracts.js';
import { AccordionContracts } from './contracts/accordion-contracts.js';
import { ProgressContracts } from './contracts/progress-contracts.js';
import { TooltipContracts } from './contracts/tooltip-contracts.js';
import { PopoverContracts } from './contracts/popover-contracts.js';
import { SliderContracts } from './contracts/slider-contracts.js';
import { CommandContracts } from './contracts/command-contracts.js';
import { ModuleContracts } from './contracts/module-contracts.js';
import { ChannelContracts } from './contracts/channel-contracts.js';
import { ApiWrapperContracts } from './contracts/api-contracts.js';
import { FormValidationContracts } from './contracts/validation-contracts.js';
import { DataAggregationContracts } from './contracts/aggregation-contracts.js';
import { LeaderContracts } from './contracts/leader-contracts.js';

export { contract, DeprecatedEvents } from './contracts/helpers.js';

const CoreContracts = {
    ...ThemeContracts,
    ...FileUploadContracts,
    ...CacheContracts,
    ...DatepickerContracts,
    ...InputContracts,
    ...OverlayContracts,
    ...ToastContracts,
    ...PageContracts,
    ...AuthContracts,
    ...HmacContracts,
    ...LogContracts,
    ...PaginationContracts,
    ...SecurityContracts,
    ...TabsContracts,
    ...AccordionContracts,
    ...ProgressContracts,
    ...TooltipContracts,
    ...PopoverContracts,
    ...SliderContracts,
    ...CommandContracts,
    ...ModuleContracts,
    ...ChannelContracts,
    ...ApiWrapperContracts,
    ...FormValidationContracts,
    ...DataAggregationContracts,
    ...LeaderContracts,
};

function normalizeRateLimits(rateLimits) {
    if (!rateLimits) return null;
    if (Number.isFinite(rateLimits.requests)) {
        return {
            requests: rateLimits.requests,
            windowMs: rateLimits.windowMs ?? rateLimits.window,
            scope: rateLimits.scope || 'session'
        };
    }
    return Object.fromEntries(Object.entries(rateLimits).map(([name, limits]) => [
        name,
        {
            requests: limits.requests,
            windowMs: limits.windowMs ?? limits.window,
            scope: limits.scope || name.replace(/^per/, '').toLowerCase() || 'session'
        }
    ]));
}

/**
 * Core contracts only. Feature modules register their own contracts via
 * ModuleManager.registerContracts when loaded (module index `contracts` export).
 */
export const Contracts = Object.fromEntries(Object.entries(CoreContracts).map(([name, contractValue]) => {
    if (contractValue?.type !== 'intent') {
        return [name, contractValue];
    }

    const security = {
        ...(contractValue.security || {}),
        rateLimits: normalizeRateLimits(contractValue.security?.rateLimits) || { requests: 60, windowMs: 60000, scope: 'session' }
    };
    return [name, { ...contractValue, security }];
}));
