import { JSDOM } from 'jsdom';
import { renderContractPage } from './renderPageDom.js';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003C');
}

function renderHeadTags(snapshot) {
  const tags = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
  ];

  (snapshot.tags || []).forEach((tag) => {
    if (tag.tag === 'script' && tag.json !== undefined) {
      tags.push(`<script type="application/ld+json">${escapeJson(tag.json)}</script>`);
      return;
    }

    const props = Object.entries(tag.props || {})
      .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
      .join('');

    tags.push(`<${tag.tag}${props}></${tag.tag}>`);
  });

  return tags.join('\n');
}

function attrsToString(record = {}) {
  const attrs = [];

  Object.entries(record.attrs || {}).forEach(([key, value]) => {
    attrs.push(` ${key}="${escapeHtml(value)}"`);
  });

  if ((record.classes || []).length > 0) {
    attrs.push(` class="${escapeHtml(record.classes.join(' '))}"`);
  }

  const styleEntries = Object.entries(record.style || {});
  if (styleEntries.length > 0) {
    const styleValue = styleEntries.map(([key, value]) => `${key}: ${value}`).join('; ');
    attrs.push(` style="${escapeHtml(styleValue)}"`);
  }

  return attrs.join('');
}

export function renderStaticDocument({
  contract,
  metaSnapshot,
  catalog,
  assetUrls = { css: [], js: [] },
  payloadScriptId = 'csma-render-bootstrap',
  payload
}) {
  if (!isObject(contract)) {
    throw new Error('Static document render requires a render contract.');
  }

  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  const { document } = dom.window;
  const body = document.body;
  body.appendChild(renderContractPage(document, contract, catalog));

  if (payload !== undefined) {
    const payloadNode = document.createElement('script');
    payloadNode.type = 'application/json';
    payloadNode.id = payloadScriptId;
    payloadNode.textContent = escapeJson(payload);
    body.appendChild(payloadNode);
  }

  const cssLinks = (assetUrls.css || []).map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`).join('\n');
  const jsScripts = (assetUrls.js || []).map((src) => `<script type="module" src="${escapeHtml(src)}"></script>`).join('\n');

  return [
    '<!doctype html>',
    `<html${attrsToString(metaSnapshot.htmlAttrs)}>`,
    '<head>',
    `<title>${escapeHtml(metaSnapshot.title || contract.head.title || contract.page.title)}</title>`,
    renderHeadTags(metaSnapshot),
    cssLinks,
    '</head>',
    `<body${attrsToString(metaSnapshot.bodyAttrs)}>`,
    body.innerHTML,
    jsScripts,
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');
}
