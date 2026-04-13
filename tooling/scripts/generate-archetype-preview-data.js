#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildArchetypePreviewPayload, collectArchetypes, ROOT, validateArchetypeCollection } from './archetype-utils.js';
import { collectComponentCatalog } from './generate-ai-catalog.js';

const outputPath = path.join(ROOT, 'demo', 'examples', 'ui-preview', 'generated', 'login-form-preview-data.js');

export async function writeArchetypePreviewData(targetPath = outputPath, generatedAt = new Date().toISOString()) {
  const collection = collectArchetypes();
  const catalog = await collectComponentCatalog({ generatedAt });
  const knownComponents = catalog.components.map((component) => component.alias);
  const findings = validateArchetypeCollection(collection, { knownComponents });

  if (findings.length > 0) {
    throw new Error(findings.map((finding) => finding.message).join('\n'));
  }

  const payload = buildArchetypePreviewPayload(collection, generatedAt);
  const output = `window.CSMA_ARCHETYPE_PREVIEW = ${JSON.stringify(payload, null, 2)};\n`;
  await writeFile(targetPath, output, 'utf8');
  return payload;
}

async function main() {
  await writeArchetypePreviewData();
  console.log(`[generate-archetype-preview-data] Wrote ${path.relative(ROOT, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
