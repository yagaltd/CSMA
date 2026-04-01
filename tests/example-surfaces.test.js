import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const todoHtml = fs.readFileSync('examples/todo-app/index.html', 'utf8');
const todoCss = fs.readFileSync('examples/todo-app/todo.css', 'utf8');
const todoJs = fs.readFileSync('examples/todo-app/todo-app.js', 'utf8');

describe('example surface quality', () => {
    it('keeps example controls accessible and aligned with shared semantics', () => {
        expect(todoHtml).not.toContain('role="button"');
        expect(todoHtml).toContain('todo-filter-group');
        expect(todoHtml).not.toContain('role="tablist"');
        expect(todoHtml).not.toContain('role="tab"');
    });

    it('normalizes example tone and shared chrome hooks', () => {
        expect(todoCss).toContain('.example-feature-badge');
    });

    it('avoids full todo list rebuilds during render updates', () => {
        expect(todoJs).toContain('syncTodoList(');
        expect(todoJs).not.toContain("list.innerHTML = '';");
        expect(todoJs).not.toContain('renderBoardList(');
    });
});
