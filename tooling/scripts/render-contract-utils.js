#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const RENDER_CONTRACT_SCHEMA = path.join(ROOT, 'tooling', 'schemas', 'render-contract.schema.json');
export const RENDER_CONTRACTS_DIR = path.join(ROOT, 'tooling', 'references');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function validateRenderNode(node, relPath, findings, pathLabel = 'root') {
  if (!isObject(node)) {
    addFinding(findings, relPath, `Render node "${pathLabel}" must be an object.`);
    return;
  }

  if (!isKebab(node.component)) {
    addFinding(findings, relPath, `Render node "${pathLabel}".component must be a kebab-case component id.`);
  }

  if (!isObject(node.props)) {
    addFinding(findings, relPath, `Render node "${pathLabel}".props must be an object.`);
  }

  if ('slots' in node) {
    if (!isObject(node.slots)) {
      addFinding(findings, relPath, `Render node "${pathLabel}".slots must be an object when present.`);
      return;
    }

    Object.entries(node.slots).forEach(([slotName, children]) => {
      if (!Array.isArray(children)) {
        addFinding(findings, relPath, `Render node "${pathLabel}".slots.${slotName} must be an array.`);
        return;
      }

      children.forEach((child, index) => {
        validateRenderNode(child, relPath, findings, `${pathLabel}.slots.${slotName}[${index}]`);
      });
    });
  }
}

function validateRootAttrs(value, relPath, findings, label) {
  if (!isObject(value)) {
    addFinding(findings, relPath, `${label} must be an object.`);
    return;
  }

  if (!isObject(value.attrs)) {
    addFinding(findings, relPath, `${label}.attrs must be an object.`);
  }

  if (!Array.isArray(value.classes) || value.classes.some((entry) => !nonEmptyString(entry))) {
    addFinding(findings, relPath, `${label}.classes must be an array of non-empty strings.`);
  }

  if (!isObject(value.style)) {
    addFinding(findings, relPath, `${label}.style must be an object.`);
  }
}

function validateLayoutIntro(value, relPath, findings, label) {
  if (!isObject(value)) {
    addFinding(findings, relPath, `${label} must be an object.`);
    return;
  }

  ['eyebrow', 'headline', 'supportingText'].forEach((key) => {
    if (typeof value[key] !== 'string') {
      addFinding(findings, relPath, `${label}.${key} must be a string.`);
    }
  });
}

export function collectRenderContracts() {
  if (!existsSync(RENDER_CONTRACTS_DIR)) {
    return [];
  }

  return readdirSync(RENDER_CONTRACTS_DIR)
    .filter((entry) => entry.endsWith('.render.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => {
      const fullPath = path.join(RENDER_CONTRACTS_DIR, entry);
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

export function validateRenderContract(contract, relPath) {
  const findings = [];

  if (!isObject(contract)) {
    addFinding(findings, relPath, 'Render contract must be a JSON object.');
    return findings;
  }

  if (!isKebab(contract.id)) {
    addFinding(findings, relPath, 'Render contract id must be kebab-case.');
  }

  if (contract.kind !== 'render-contract') {
    addFinding(findings, relPath, 'Render contract kind must be "render-contract".');
  }

  if (!nonEmptyString(contract.version, 5)) {
    addFinding(findings, relPath, 'Render contract version must be a semver string.');
  }

  if (!isObject(contract.page)) {
    addFinding(findings, relPath, 'Render contract page must be an object.');
  } else {
    if (!isKebab(contract.page.id)) addFinding(findings, relPath, 'Render contract page.id must be kebab-case.');
    if (!nonEmptyString(contract.page.viewId)) addFinding(findings, relPath, 'Render contract page.viewId is required.');
    if (!isKebab(contract.page.contentArchetypeId)) addFinding(findings, relPath, 'Render contract page.contentArchetypeId must be kebab-case.');
    if (!isKebab(contract.page.layoutArchetypeId)) addFinding(findings, relPath, 'Render contract page.layoutArchetypeId must be kebab-case.');
    if (!nonEmptyString(contract.page.routePath)) addFinding(findings, relPath, 'Render contract page.routePath is required.');
    if (!nonEmptyString(contract.page.title)) addFinding(findings, relPath, 'Render contract page.title is required.');
  }

  if (!isObject(contract.layout)) {
    addFinding(findings, relPath, 'Render contract layout must be an object.');
  } else {
    if (!isKebab(contract.layout.id)) addFinding(findings, relPath, 'Render contract layout.id must be kebab-case.');
    if (!stringArray(contract.layout.regions)) addFinding(findings, relPath, 'Render contract layout.regions must be a non-empty array of strings.');
    if (!isObject(contract.layout.rules)) addFinding(findings, relPath, 'Render contract layout.rules must be an object.');
    validateLayoutIntro(contract.layout.intro, relPath, findings, 'Render contract layout.intro');
  }

  if (!isObject(contract.head)) {
    addFinding(findings, relPath, 'Render contract head must be an object.');
  } else {
    if (typeof contract.head.title !== 'string') addFinding(findings, relPath, 'Render contract head.title must be a string.');
    if (!Array.isArray(contract.head.tags)) {
      addFinding(findings, relPath, 'Render contract head.tags must be an array.');
    } else {
      contract.head.tags.forEach((tag, index) => {
        if (!isObject(tag)) {
          addFinding(findings, relPath, `Render contract head.tags[${index}] must be an object.`);
          return;
        }
        if (!nonEmptyString(tag.tag)) addFinding(findings, relPath, `Render contract head.tags[${index}].tag is required.`);
        if (!nonEmptyString(tag.key)) addFinding(findings, relPath, `Render contract head.tags[${index}].key is required.`);
        if (!isObject(tag.props)) addFinding(findings, relPath, `Render contract head.tags[${index}].props must be an object.`);
      });
    }
    validateRootAttrs(contract.head.htmlAttrs, relPath, findings, 'Render contract head.htmlAttrs');
    validateRootAttrs(contract.head.bodyAttrs, relPath, findings, 'Render contract head.bodyAttrs');
  }

  if (!isObject(contract.regions)) {
    addFinding(findings, relPath, 'Render contract regions must be an object.');
  } else {
    ['hero', 'main', 'aside'].forEach((regionName) => {
      const nodes = contract.regions[regionName];
      if (!Array.isArray(nodes)) {
        addFinding(findings, relPath, `Render contract regions.${regionName} must be an array.`);
        return;
      }

      nodes.forEach((node, index) => validateRenderNode(node, relPath, findings, `regions.${regionName}[${index}]`));
    });

    Object.entries(contract.regions).forEach(([regionName, nodes]) => {
      if (!Array.isArray(nodes)) {
        addFinding(findings, relPath, `Render contract regions.${regionName} must be an array.`);
        return;
      }

      if (!['hero', 'main', 'aside'].includes(regionName)) {
        nodes.forEach((node, index) => validateRenderNode(node, relPath, findings, `regions.${regionName}[${index}]`));
      }
    });
  }

  if (!isObject(contract.activation)) {
    addFinding(findings, relPath, 'Render contract activation must be an object.');
  } else {
    if (contract.activation.bootstrap !== 'full-runtime') {
      addFinding(findings, relPath, 'Render contract activation.bootstrap must be "full-runtime".');
    }

    if (contract.activation.mode !== 'page') {
      addFinding(findings, relPath, 'Render contract activation.mode must be "page".');
    }

    if (typeof contract.activation.required !== 'boolean') {
      addFinding(findings, relPath, 'Render contract activation.required must be a boolean.');
    }

    if (!Array.isArray(contract.activation.runtimeDependencies) || contract.activation.runtimeDependencies.some((entry) => !nonEmptyString(entry))) {
      addFinding(findings, relPath, 'Render contract activation.runtimeDependencies must be an array of non-empty strings.');
    }

    if ('initialState' in contract.activation && !isObject(contract.activation.initialState)) {
      addFinding(findings, relPath, 'Render contract activation.initialState must be an object when present.');
    }

    if (!Array.isArray(contract.activation.typeIComponents) || contract.activation.typeIComponents.some((entry) => !isKebab(entry))) {
      addFinding(findings, relPath, 'Render contract activation.typeIComponents must be an array of kebab-case component ids.');
    }

    if (!Array.isArray(contract.activation.typeIIComponents) || contract.activation.typeIIComponents.some((entry) => !isKebab(entry))) {
      addFinding(findings, relPath, 'Render contract activation.typeIIComponents must be an array of kebab-case component ids.');
    }
  }

  if (!stringArray(contract.componentsUsed) || contract.componentsUsed.some((entry) => !isKebab(entry))) {
    addFinding(findings, relPath, 'Render contract componentsUsed must be a non-empty array of kebab-case component ids.');
  }

  return findings;
}

export function validateRenderContracts(contracts) {
  return contracts.flatMap(({ contract, relPath }) => validateRenderContract(contract, relPath));
}
