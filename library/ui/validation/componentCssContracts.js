function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isInteractiveManifest(manifest) {
  const aiUi = manifest?.aiUi;
  if (!isObject(aiUi)) {
    return false;
  }

  const role = aiUi.behavior?.role;
  const renderKind = aiUi.render?.kind;

  return role === 'field' ||
    role === 'trigger' ||
    renderKind === 'button';
}

export function validateInteractiveComponentCss(manifest, cssSource, relPath) {
  const findings = [];

  if (!isInteractiveManifest(manifest) || typeof cssSource !== 'string' || cssSource.trim() === '') {
    return findings;
  }

  if (!cssSource.includes(':focus-visible')) {
    findings.push({
      file: relPath,
      line: 1,
      message: 'Interactive components must define :focus-visible styles.',
      sample: 'Missing :focus-visible selector'
    });
  }

  const hasDisabledState =
    cssSource.includes('[disabled]') ||
    cssSource.includes('[aria-disabled="true"]') ||
    cssSource.includes('[data-disabled="true"]');

  if (!hasDisabledState) {
    findings.push({
      file: relPath,
      line: 1,
      message: 'Interactive components must define a disabled state.',
      sample: 'Missing [disabled], [aria-disabled="true"], or [data-disabled="true"] selector'
    });
  }

  return findings;
}
