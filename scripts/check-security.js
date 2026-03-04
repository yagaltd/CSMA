/**
 * CSMA Security Policy Checker v1.0
 * Automated security audits for CSMA projects
 * 
 * Run: npm run security-check
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const securityChecks = {
    csp_headers: {
        file: 'index.html',
        check: (content) => {
            const hasCSP = content.includes('Content-Security-Policy');
            const hasUnsafeInline = content.includes("'unsafe-inline'");
            return {
                pass: hasCSP && !hasUnsafeInline,
                message: hasUnsafeInline
                    ? '❌ CSP contains unsafe-inline (SECURITY RISK)'
                    : hasCSP
                        ? '✅ CSP configured correctly'
                        : '❌ No CSP headers found (CRITICAL)'
            };
        }
    },

    contract_validation: {
        file: 'src/runtime/Contracts.js',
        check: (content) => {
            // Starter-template uses custom validation library at './validation/index.js'
            const hasValidation = content.includes("from './validation/index.js'") ||
                content.includes('from "./validation/index.js"') ||
                content.includes('from \'superstruct\'') ||
                content.includes('from "superstruct"');
            const hasSchemas = content.includes('.schema') || content.includes('object(');
            return {
                pass: hasValidation && hasSchemas,
                message: hasValidation && hasSchemas
                    ? '✅ Contracts use validation library (custom forked Superstruct)'
                    : '❌ Missing validation library imports (CRITICAL)'
            };
        }
    },

    rate_limiting: {
        file: 'src/runtime/EventBus.js',
        check: (content) => {
            const hasRateLimiting = content.includes('checkRateLimit');
            const hasSecurityViolation = content.includes('SECURITY_VIOLATION');
            const usesLocalStorage = content.includes('localStorage.getItem') &&
                content.includes('checkRateLimit');
            return {
                pass: hasRateLimiting && hasSecurityViolation && !usesLocalStorage,
                message: usesLocalStorage
                    ? '⚠️  Rate limiting uses localStorage (BYPASSABLE)'
                    : hasRateLimiting && hasSecurityViolation
                        ? '✅ Rate limiting implemented with secure storage'
                        : '❌ Missing rate limiting (HIGH RISK)'
            };
        }
    },

    sanitization: {
        file: 'src/utils/sanitize.js',
        check: (content) => {
            const hasSanitizeHTML = content.includes('function sanitizeHTML') ||
                content.includes('export function sanitizeHTML');
            const hasSanitizeURL = content.includes('function sanitizeURL') ||
                content.includes('export function sanitizeURL');
            const hasSanitizeLLM = content.includes('sanitizeLLMInput');
            return {
                pass: hasSanitizeHTML && hasSanitizeURL,
                message: `${hasSanitizeHTML ? '✅' : '❌'} sanitizeHTML, ` +
                    `${hasSanitizeURL ? '✅' : '❌'} sanitizeURL, ` +
                    `${hasSanitizeLLM ? '✅' : '⚠️ '} sanitizeLLMInput (optional)`
            };
        }
    },

    schema_spoofing_protection: {
        file: 'src/runtime/EventBus.js',
        check: (content) => {
            const hasPrototypePollutionCheck = content.includes('__proto__');
            const hasConstructorCheck = content.includes('constructor.name');
            return {
                pass: hasPrototypePollutionCheck && hasConstructorCheck,
                message: hasPrototypePollutionCheck && hasConstructorCheck
                    ? '✅ Schema spoofing protection implemented'
                    : '❌ Missing schema spoofing protection (CRITICAL)'
            };
        }
    },

    rate_limiter_exists: {
        file: 'src/runtime/RateLimiter.js',
        check: (content) => {
            const hasMapStorage = content.includes('new Map()');
            const hasSessionId = content.includes('sessionStorage');
            return {
                pass: hasMapStorage && hasSessionId,
                message: hasMapStorage && hasSessionId
                    ? '✅ RateLimiter uses in-memory Map with session ID'
                    : '⚠️  RateLimiter implementation incomplete'
            };
        }
    },

    sanitize_classname: {
        file: 'src/utils/sanitize.js',
        check: (content) => {
            const hasSanitizeClassName = content.includes('function sanitizeClassName') ||
                content.includes('export function sanitizeClassName');
            return {
                pass: hasSanitizeClassName,
                message: hasSanitizeClassName
                    ? '✅ sanitizeClassName function implemented'
                    : '❌ Missing sanitizeClassName (CSS injection risk)'
            };
        }
    },

    env_file_security: {
        file: '.gitignore',
        check: (content) => {
            const hasEnvIgnore = content.includes('.env');
            const hasEnvExample = fs.existsSync(join(projectRoot, '.env.example'));
            const hasEnvInGit = fs.existsSync(join(projectRoot, '.env'));

            return {
                pass: hasEnvIgnore && hasEnvExample && !hasEnvInGit,
                message: !hasEnvIgnore
                    ? '❌ .env not in .gitignore (CRITICAL SECURITY RISK)'
                    : !hasEnvExample
                        ? '⚠️  .env.example missing (developers need template)'
                        : hasEnvInGit
                            ? '❌ .env file exists in project (should be gitignored)'
                            : '✅ Environment variable security configured'
            };
        }
    }
};

// Run checks
let allPassed = true;
let criticalFailures = 0;
console.log('\n🛡️  CSMA Security Policy Checker v1.0\n');
console.log('═'.repeat(60));

for (const [name, check] of Object.entries(securityChecks)) {
    const filePath = join(projectRoot, check.file);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const result = check.check(content);

        console.log(`\n${result.pass ? '✅' : '❌'} ${name.replace(/_/g, ' ').toUpperCase()}`);
        console.log(`   ${result.message}`);
        console.log(`   File: ${check.file}`);

        if (!result.pass) {
            allPassed = false;
            if (result.message.includes('CRITICAL')) {
                criticalFailures++;
            }
        }
    } catch (error) {
        console.log(`\n❌ ${name.replace(/_/g, ' ').toUpperCase()}`);
        console.log(`   ⚠️  File not found: ${check.file}`);
        console.log(`   Error: ${error.message}`);
        allPassed = false;
        criticalFailures++;
    }
}

console.log('\n' + '═'.repeat(60));

if (allPassed) {
    console.log('\n✅ All security checks PASSED!\n');
    console.log('Your CSMA application meets security standards.\n');
} else {
    console.log(`\n❌ Security issues found!`);
    console.log(`   Critical failures: ${criticalFailures}`);
    console.log(`   Please fix before deploying to production.\n`);
}

process.exit(allPassed ? 0 : 1);
