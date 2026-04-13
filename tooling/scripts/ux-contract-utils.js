#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const UX_CONTRACT_SCHEMA = path.join(ROOT, 'tooling', 'schemas', 'ux-contract.schema.json');
export const UX_CONTRACTS_DIR = path.join(ROOT, 'tooling', 'references');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isKebab(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function nonEmptyString(value, min = 1) {
  return typeof value === 'string' && value.trim().length >= min;
}

function stringArray(value, minLength = 1) {
  return Array.isArray(value) && value.length >= minLength && value.every((item) => nonEmptyString(item));
}

function addFinding(into, file, message) {
  into.push({ file, line: 1, message, sample: file });
}

export function collectUxContracts() {
  if (!existsSync(UX_CONTRACTS_DIR)) {
    return [];
  }

  return readdirSync(UX_CONTRACTS_DIR)
    .filter((entry) => entry.endsWith('.ux.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => {
      const fullPath = path.join(UX_CONTRACTS_DIR, entry);
      if (!statSync(fullPath).isFile()) {
        return null;
      }
      return {
        filePath: fullPath,
        relPath: path.relative(ROOT, fullPath).replaceAll(path.sep, '/'),
        contract: JSON.parse(readFileSync(fullPath, 'utf8'))
      };
    })
    .filter(Boolean);
}

export function validateUxContract(contract, relPath) {
  const findings = [];

  if (!isObject(contract)) {
    addFinding(findings, relPath, 'UX contract must be a JSON object.');
    return findings;
  }

  if (!isKebab(contract.id)) {
    addFinding(findings, relPath, 'UX contract id must be kebab-case.');
  }
  if (!nonEmptyString(contract.domain, 3)) {
    addFinding(findings, relPath, 'UX contract domain must be a descriptive string.');
  }
  if (!nonEmptyString(contract.summary, 10)) {
    addFinding(findings, relPath, 'UX contract summary must be a descriptive string.');
  }
  if (!Array.isArray(contract.userRoles) || contract.userRoles.length === 0) {
    addFinding(findings, relPath, 'UX contract userRoles must be a non-empty array.');
  } else {
    contract.userRoles.forEach((role, index) => {
      if (!isObject(role)) {
        addFinding(findings, relPath, `UX contract userRoles[${index}] must be an object.`);
        return;
      }
      if (!isKebab(role.id)) {
        addFinding(findings, relPath, `UX contract userRoles[${index}].id must be kebab-case.`);
      }
      if (!nonEmptyString(role.label)) {
        addFinding(findings, relPath, `UX contract userRoles[${index}].label is required.`);
      }
      if (!nonEmptyString(role.job, 5)) {
        addFinding(findings, relPath, `UX contract userRoles[${index}].job is required.`);
      }
    });
  }

  if (!stringArray(contract.navigationGroups)) {
    addFinding(findings, relPath, 'UX contract navigationGroups must be a non-empty array of strings.');
  }

  if (!Array.isArray(contract.screens) || contract.screens.length === 0) {
    addFinding(findings, relPath, 'UX contract screens must be a non-empty array.');
  } else {
    contract.screens.forEach((screen, index) => {
      if (!isObject(screen)) {
        addFinding(findings, relPath, `UX contract screens[${index}] must be an object.`);
        return;
      }
      if (!isKebab(screen.id)) addFinding(findings, relPath, `UX contract screens[${index}].id must be kebab-case.`);
      if (!nonEmptyString(screen.title)) addFinding(findings, relPath, `UX contract screens[${index}].title is required.`);
      if (!nonEmptyString(screen.group)) addFinding(findings, relPath, `UX contract screens[${index}].group is required.`);
      if (typeof screen.primaryForMvp !== 'boolean') addFinding(findings, relPath, `UX contract screens[${index}].primaryForMvp must be boolean.`);
    });
  }

  if (!Array.isArray(contract.flows) || contract.flows.length === 0) {
    addFinding(findings, relPath, 'UX contract flows must be a non-empty array.');
  } else {
    contract.flows.forEach((flow, index) => {
      if (!isObject(flow)) {
        addFinding(findings, relPath, `UX contract flows[${index}] must be an object.`);
        return;
      }
      if (!isKebab(flow.id)) addFinding(findings, relPath, `UX contract flows[${index}].id must be kebab-case.`);
      if (!nonEmptyString(flow.title)) addFinding(findings, relPath, `UX contract flows[${index}].title is required.`);
      if (!stringArray(flow.steps, 2)) addFinding(findings, relPath, `UX contract flows[${index}].steps must contain at least 2 steps.`);
    });
  }

  if (!isObject(contract.stateExpectations)) {
    addFinding(findings, relPath, 'UX contract stateExpectations must be an object.');
  } else {
    ['empty', 'loading', 'error', 'success'].forEach((stateName) => {
      if (!stringArray(contract.stateExpectations[stateName])) {
        addFinding(findings, relPath, `UX contract stateExpectations.${stateName} must be a non-empty array of strings.`);
      }
    });
  }

  if (!Array.isArray(contract.openQuestions)) {
    addFinding(findings, relPath, 'UX contract openQuestions must be an array.');
  }

  return findings;
}

export function validateUxContracts(contracts) {
  return contracts.flatMap(({ contract, relPath }) => validateUxContract(contract, relPath));
}
