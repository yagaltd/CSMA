#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const ARCHETYPE_SCHEMA = path.join(ROOT, 'tooling', 'schemas', 'archetype.schema.json');
export const LAYOUT_ARCHETYPES_DIR = path.join(ROOT, 'library', 'ui', 'archetypes', 'layouts');
export const CONTENT_ARCHETYPES_DIR = path.join(ROOT, 'library', 'ui', 'archetypes', 'content');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isSemver(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function isKebabCase(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function addFinding(into, file, message) {
  into.push({ file, line: 1, message, sample: file });
}

function validateArchetypeNode(node, file, pathLabel, findings, knownComponents) {
  if (!isObject(node)) {
    addFinding(findings, file, `Archetype node "${pathLabel}" must be an object.`);
    return;
  }

  if (!isKebabCase(node.component)) {
    addFinding(findings, file, `Archetype node "${pathLabel}" must declare a kebab-case component id.`);
  } else if (knownComponents.size > 0 && !knownComponents.has(node.component)) {
    addFinding(findings, file, `Archetype node "${pathLabel}" references unknown component "${node.component}".`);
  }

  if ('props' in node && !isObject(node.props)) {
    addFinding(findings, file, `Archetype node "${pathLabel}".props must be an object when present.`);
  }

  if ('slots' in node) {
    if (!isObject(node.slots)) {
      addFinding(findings, file, `Archetype node "${pathLabel}".slots must be an object when present.`);
      return;
    }

    Object.entries(node.slots).forEach(([slotName, children]) => {
      if (!Array.isArray(children) || children.length === 0) {
        addFinding(findings, file, `Archetype node "${pathLabel}".slots.${slotName} must be a non-empty array.`);
        return;
      }
      children.forEach((child, index) => {
        validateArchetypeNode(child, file, `${pathLabel}.slots.${slotName}[${index}]`, findings, knownComponents);
      });
    });
  }
}

function validateLayoutArchetype(archetype, file, findings) {
  if (!isObject(archetype.regions) || Object.keys(archetype.regions).length === 0) {
    addFinding(findings, file, 'Layout archetypes must define a non-empty regions object.');
  } else {
    Object.entries(archetype.regions).forEach(([regionName, region]) => {
      if (!isKebabCase(regionName) && !/^[a-z]+(?:-[a-z0-9]+)*$/.test(regionName)) {
        addFinding(findings, file, `Layout region "${regionName}" must use a stable identifier.`);
      }
      if (!isObject(region)) {
        addFinding(findings, file, `Layout region "${regionName}" must be an object.`);
        return;
      }
      if (typeof region.required !== 'boolean') {
        addFinding(findings, file, `Layout region "${regionName}" must declare required as boolean.`);
      }
      if (typeof region.description !== 'string' || region.description.trim() === '') {
        addFinding(findings, file, `Layout region "${regionName}" must declare a description.`);
      }
    });
  }

  if ('contentSchema' in archetype && !isObject(archetype.contentSchema)) {
    addFinding(findings, file, 'Layout archetype contentSchema must be an object when present.');
  }
  if ('defaults' in archetype && !isObject(archetype.defaults)) {
    addFinding(findings, file, 'Layout archetype defaults must be an object when present.');
  }
  if ('layoutRules' in archetype && !isObject(archetype.layoutRules)) {
    addFinding(findings, file, 'Layout archetype layoutRules must be an object when present.');
  }
  if ('structure' in archetype) {
    if (!isObject(archetype.structure)) {
      addFinding(findings, file, 'Layout archetype structure must be an object when present.');
    } else {
      if (typeof archetype.structure.type !== 'string' || archetype.structure.type.trim() === '') {
        addFinding(findings, file, 'Layout archetype structure.type is required.');
      }
      if ('regions' in archetype.structure && !Array.isArray(archetype.structure.regions)) {
        addFinding(findings, file, 'Layout archetype structure.regions must be an array when present.');
      }
    }
  }
}

function validateContentArchetype(archetype, file, findings, knownComponents) {
  if (!isKebabCase(archetype.layout)) {
    addFinding(findings, file, 'Content archetypes must declare a kebab-case layout id.');
  }
  if (typeof archetype.targetRegion !== 'string' || archetype.targetRegion.trim() === '') {
    addFinding(findings, file, 'Content archetypes must declare a targetRegion.');
  }
  if (!isObject(archetype.contentSchema) || Object.keys(archetype.contentSchema).length === 0) {
    addFinding(findings, file, 'Content archetypes must define a non-empty contentSchema object.');
  }
  if (!isObject(archetype.defaults)) {
    addFinding(findings, file, 'Content archetypes must define defaults as an object.');
  }
  if (!isObject(archetype.regions) || Object.keys(archetype.regions).length === 0) {
    addFinding(findings, file, 'Content archetypes must define a non-empty regions object.');
    return;
  }

  Object.entries(archetype.regions).forEach(([regionName, nodes]) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      addFinding(findings, file, `Content archetype region "${regionName}" must be a non-empty array.`);
      return;
    }
    nodes.forEach((node, index) => {
      validateArchetypeNode(node, file, `regions.${regionName}[${index}]`, findings, knownComponents);
    });
  });
}

export function validateArchetypeShape(archetype, file, { knownComponents = [] } = {}) {
  const findings = [];
  const knownComponentSet = new Set(knownComponents);

  if (!isObject(archetype)) {
    addFinding(findings, file, 'Archetype file must contain a JSON object.');
    return findings;
  }

  if (!isKebabCase(archetype.id)) {
    addFinding(findings, file, 'Archetype id must be kebab-case.');
  }
  if (!['layout-archetype', 'content-archetype'].includes(archetype.kind)) {
    addFinding(findings, file, 'Archetype kind must be "layout-archetype" or "content-archetype".');
  }
  if ('version' in archetype && !isSemver(archetype.version)) {
    addFinding(findings, file, 'Archetype version must be a semver string when present.');
  }
  if (typeof archetype.description !== 'string' || archetype.description.trim().length < 10) {
    addFinding(findings, file, 'Archetype description must be a descriptive string.');
  }
  if (!isStringArray(archetype.uses)) {
    addFinding(findings, file, 'Archetype uses must be a non-empty array of component ids.');
  } else if (knownComponentSet.size > 0) {
    archetype.uses.forEach((componentId) => {
      if (!knownComponentSet.has(componentId)) {
        addFinding(findings, file, `Archetype uses references unknown component "${componentId}".`);
      }
    });
  }

  if (archetype.kind === 'layout-archetype') {
    validateLayoutArchetype(archetype, file, findings);
  }
  if (archetype.kind === 'content-archetype') {
    validateContentArchetype(archetype, file, findings, knownComponentSet);
  }

  return findings;
}

function collectArchetypesFromDir(dirPath, kind) {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry);
      if (!statSync(fullPath).isFile()) {
        return null;
      }
      const source = readFileSync(fullPath, 'utf8');
      return {
        kind,
        filePath: fullPath,
        relPath: path.relative(ROOT, fullPath).replaceAll(path.sep, '/'),
        archetype: JSON.parse(source)
      };
    })
    .filter(Boolean);
}

export function collectArchetypes() {
  const layouts = collectArchetypesFromDir(LAYOUT_ARCHETYPES_DIR, 'layout-archetype');
  const content = collectArchetypesFromDir(CONTENT_ARCHETYPES_DIR, 'content-archetype');

  return { layouts, content };
}

export function validateArchetypeCollection(collection, { knownComponents = [] } = {}) {
  const findings = [];
  const layoutIds = new Map(collection.layouts.map(({ archetype, relPath }) => [archetype.id, { archetype, relPath }]));

  collection.layouts.forEach(({ archetype, relPath }) => {
    findings.push(...validateArchetypeShape(archetype, relPath, { knownComponents }));
  });

  collection.content.forEach(({ archetype, relPath }) => {
    findings.push(...validateArchetypeShape(archetype, relPath, { knownComponents }));

    const layoutEntry = layoutIds.get(archetype.layout);
    if (!layoutEntry) {
      addFinding(findings, relPath, `Content archetype references unknown layout "${archetype.layout}".`);
      return;
    }

    if (!isObject(layoutEntry.archetype.regions) || !(archetype.targetRegion in layoutEntry.archetype.regions)) {
      addFinding(findings, relPath, `Content archetype targetRegion "${archetype.targetRegion}" is not defined on layout "${archetype.layout}".`);
    }

    Object.keys(archetype.regions || {}).forEach((regionName) => {
      if (!isObject(layoutEntry.archetype.regions) || !(regionName in layoutEntry.archetype.regions)) {
        addFinding(findings, relPath, `Content archetype region "${regionName}" is not defined on layout "${archetype.layout}".`);
      }
    });
  });

  return findings;
}

export function buildArchetypePreviewPayload(collection, generatedAt = new Date().toISOString()) {
  const layouts = Object.fromEntries(
    collection.layouts.map(({ archetype }) => [archetype.id, archetype])
  );
  const contentArchetypes = Object.fromEntries(
    collection.content.map(({ archetype }) => [archetype.id, archetype])
  );

  return {
    generatedAt,
    layout: collection.layouts[0]?.archetype || null,
    layouts,
    contentArchetypes
  };
}
