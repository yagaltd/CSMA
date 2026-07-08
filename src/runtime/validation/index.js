/**
 * CSMA Validation - Main Export
 * Forked from Superstruct v2.0.2 + CSMA enhancements
 */

// Core
export { Struct, assert, is, validate } from './struct.js';
export { StructError } from './error.js';

// Primitive types
export {
    string,
    number,
    boolean,
    date,
    enums,
    array,
    object,
    optional,
    nullable,
    any,
    literal,
    record,
    looseObject,
    configSchema,
    validateConfig
} from './types/primitives.js';

// Refinements
export {
    refine,
    size,
    pattern,
    integer
} from './types/refinements.js';

// CSMA Contract Helper
export {
    contract,
    eventContract,
    intentContract
} from './contract.js';

// Semantic Validators
export {
    email,
    url,
    uuid,
    phone,
    hexColor,
    isoDate
} from './validators/semantic.js';

// Security Validators
export {
    llmInput,
    sanitizedHTML,
    sanitizedURL,
    sqlSafe,
    strongPassword
} from './validators/security.js';

// Tile Manifest Parser
export { parseManifest, ErrorCode } from '../tile-manifest-parser.js';
