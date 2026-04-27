import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const todoHtml = fs.readFileSync('demo/index.html', 'utf8');
const todoCss = fs.readFileSync('demo/app.css', 'utf8');
const todoJs = fs.readFileSync('demo/todo-app.js', 'utf8');

describe('demo surface quality', () => {
  it('uses semantic controls without ARIA misuse', () => {
    expect(todoHtml).not.toContain('role="button"');
    expect(todoHtml).not.toContain('role="tablist"');
    expect(todoHtml).not.toContain('role="tab"');
  });

  it('includes interactive Phase 1 module examples', () => {
    expect(todoHtml).toContain('data-auth-ui-demo');
    expect(todoHtml).toContain('data-notifications-center-shell');
    expect(todoHtml).toContain('data-share-trigger');
    expect(todoHtml).toContain('data-upload-dropzone');
  });

  it('uses token-driven CSS', () => {
    expect(todoCss).toContain('var(--');
    expect(todoCss).not.toContain('#fff');
    expect(todoCss).not.toContain('#000');
  });

  it('avoids full list rebuilds during render updates', () => {
    expect(todoJs).toContain('syncTodoList(');
    expect(todoJs).not.toContain("list.innerHTML = '';");
  });

  it('uses textContent for user data', () => {
    expect(todoJs).toContain('.textContent');
    expect(todoJs).not.toContain('.innerHTML');
  });
});
