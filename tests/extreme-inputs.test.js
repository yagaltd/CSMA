/**
 * Extreme Input & Edge Case Tests
 * Tests for very long, very short, special characters, and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Test data generators
 */
function generateLongString(length, char = 'x') {
    return char.repeat(length);
}

function generateUnicodeString(length) {
    const chars = ['א', 'ب', 'ה', 'י', '你', '好', '🎉', '👨‍👩‍👧‍👦', 'Ä', 'ö', 'ß'];
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[i % chars.length];
    }
    return result;
}

function generateMixedContent(length) {
    const parts = ['Hello', 'مرحبا', '你好', '🎉', '123', '<script>', '&amp;'];
    let result = '';
    while (result.length < length) {
        result += parts[Math.floor(Math.random() * parts.length)] + ' ';
    }
    return result.slice(0, length);
}

/**
 * Create test document
 */
function createTestDocument(content) {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .truncate {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .break-words {
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                }
                .flex-item {
                    min-width: 0;
                    overflow: hidden;
                }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    return dom.window.document;
}

// ============================================
// VERY LONG TEXT TESTS
// ============================================

describe('Very Long Text Handling', () => {
    describe('Names and titles', () => {
        it('handles 100 character name', () => {
            const longName = generateLongString(100);
            const doc = createTestDocument(`
                <span class="truncate" style="max-width: 200px;">${longName}</span>
            `);
            const el = doc.querySelector('.truncate');
            expect(el.textContent).toBe(longName);
            expect(el.classList.contains('truncate')).toBe(true);
        });

        it('handles 1000 character title', () => {
            const longTitle = generateLongString(1000);
            const doc = createTestDocument(`
                <h1 class="line-clamp-2">${longTitle}</h1>
            `);
            const h1 = doc.querySelector('h1');
            expect(h1.textContent.length).toBe(1000);
        });

        it('handles 5000 character description', () => {
            const longDesc = generateMixedContent(5000);
            const doc = createTestDocument(`
                <div class="line-clamp-2">${longDesc}</div>
            `);
            const div = doc.querySelector('div');
            expect(div.textContent.length).toBeGreaterThanOrEqual(5000);
        });
    });

    describe('URLs and paths', () => {
        it('handles very long URLs', () => {
            const longUrl = `https://example.com/${'path/'.repeat(100)}?${'param=value&'.repeat(50)}`;
            const doc = createTestDocument(`
                <a href="${longUrl}" class="truncate break-words">${longUrl}</a>
            `);
            const a = doc.querySelector('a');
            expect(a.href.length).toBeGreaterThan(500);
        });

        it('handles file paths with no spaces', () => {
            const longPath = `/very/long/path/to/some/deeply/nested/directory/${'folder/'.repeat(50)}/file.txt`;
            const doc = createTestDocument(`
                <code class="break-words">${longPath}</code>
            `);
            const code = doc.querySelector('code');
            expect(code.textContent).toBe(longPath);
        });
    });

    describe('Numbers', () => {
        it('handles millions', () => {
            const millions = '1,234,567,890';
            const doc = createTestDocument(`<span>${millions}</span>`);
            expect(doc.querySelector('span').textContent).toBe(millions);
        });

        it('handles very precise decimals', () => {
            const precise = '3.14159265358979323846264338327950288419716939937510';
            const doc = createTestDocument(`<span>${precise}</span>`);
            expect(doc.querySelector('span').textContent).toBe(precise);
        });

        it('handles scientific notation', () => {
            const scientific = '1.23e+308';
            const doc = createTestDocument(`<span>${scientific}</span>`);
            expect(doc.querySelector('span').textContent).toBe(scientific);
        });

        it('handles negative infinity', () => {
            const negInfinity = '-Infinity';
            const doc = createTestDocument(`<span>${negInfinity}</span>`);
            expect(doc.querySelector('span').textContent).toBe(negInfinity);
        });
    });
});

// ============================================
// VERY SHORT TEXT TESTS
// ============================================

describe('Very Short Text Handling', () => {
    it('handles empty string', () => {
        const doc = createTestDocument(`<span class="truncate"></span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe('');
    });

    it('handles single character', () => {
        const doc = createTestDocument(`<span class="truncate">A</span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe('A');
    });

    it('handles single emoji', () => {
        const doc = createTestDocument(`<span class="truncate">🎉</span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe('🎉');
    });

    it('handles single space', () => {
        const doc = createTestDocument(`<span class="truncate"> </span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe(' ');
    });

    it('handles non-breaking space', () => {
        const doc = createTestDocument(`<span class="truncate">&nbsp;</span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe('\u00A0');
    });

    it('handles zero-width space', () => {
        const doc = createTestDocument(`<span class="truncate">\u200B</span>`);
        const span = doc.querySelector('span');
        expect(span.textContent).toBe('\u200B');
    });
});

// ============================================
// SPECIAL CHARACTERS TESTS
// ============================================

describe('Special Characters Handling', () => {
    describe('Emoji', () => {
        const emojiTests = [
            { emoji: '😀', name: 'Simple emoji', bytes: 4 },
            { emoji: '👨‍👩‍👧‍👦', name: 'Family ZWJ sequence', bytes: 25 },
            { emoji: '🏳️‍🌈', name: 'Rainbow flag ZWJ', bytes: 14 },
            { emoji: '👍🏼', name: 'Emoji with skin tone', bytes: 8 },
            { emoji: '👁️‍🗨️', name: 'Eye in speech bubble', bytes: 12 },
            { emoji: '🇺🇸', name: 'Flag (regional indicator)', bytes: 8 },
            { emoji: '©️', name: 'Copyright with variant', bytes: 4 },
            { emoji: '1️⃣', name: 'Keycap sequence', bytes: 6 }
        ];

        emojiTests.forEach(({ emoji, name }) => {
            it(`handles ${name}`, () => {
                const doc = createTestDocument(`<span>${emoji}</span>`);
                expect(doc.querySelector('span').textContent).toBe(emoji);
            });
        });

        it('handles multiple emojis together', () => {
            const emojis = '🎉🎊🎁🎈🎀🕯️🍰';
            const doc = createTestDocument(`<span>${emojis}</span>`);
            expect(doc.querySelector('span').textContent).toBe(emojis);
        });

        it('handles emoji only text in button', () => {
            const doc = createTestDocument(`
                <button class="button">👍</button>
            `);
            const button = doc.querySelector('button');
            expect(button.textContent).toBe('👍');
        });
    });

    describe('HTML entities', () => {
        const entityTests = [
            { entity: '&lt;', expected: '<', name: 'less than' },
            { entity: '&gt;', expected: '>', name: 'greater than' },
            { entity: '&amp;', expected: '&', name: 'ampersand' },
            { entity: '&quot;', expected: '"', name: 'quote' },
            { entity: '&#39;', expected: "'", name: 'apostrophe' },
            { entity: '&nbsp;', expected: '\u00A0', name: 'non-breaking space' },
            { entity: '&mdash;', expected: '—', name: 'em dash' },
            { entity: '&copy;', expected: '©', name: 'copyright' }
        ];

        entityTests.forEach(({ entity, expected, name }) => {
            it(`handles ${name} entity`, () => {
                const doc = createTestDocument(`<span>${entity}</span>`);
                expect(doc.querySelector('span').textContent).toBe(expected);
            });
        });
    });

    describe('Control characters', () => {
        it('handles tab character', () => {
            const doc = createTestDocument(`<span>Col1\tCol2</span>`);
            expect(doc.querySelector('span').textContent).toContain('\t');
        });

        it('handles newline character', () => {
            const doc = createTestDocument(`<span>Line1\nLine2</span>`);
            expect(doc.querySelector('span').textContent).toContain('\n');
        });

        it('handles carriage return', () => {
            const doc = createTestDocument(`<span>Text\r\nMore</span>`);
            expect(doc.querySelector('span').textContent).toBe('Text\nMore');
        });

        it('handles form feed', () => {
            const doc = createTestDocument(`<span>Page1\fPage2</span>`);
            expect(doc.querySelector('span').textContent).toContain('\f');
        });
    });

    describe('Unicode edge cases', () => {
        it('handles combining diacritical marks', () => {
            // e + combining acute accent
            const combined = 'e\u0301';
            const doc = createTestDocument(`<span>${combined}</span>`);
            expect(doc.querySelector('span').textContent).toBe(combined);
        });

        it('handles precomposed vs decomposed', () => {
            // é (precomposed) vs e + combining acute (decomposed)
            const precomposed = 'é';
            const decomposed = 'e\u0301';
            // They should display the same but have different lengths
            expect(precomposed.length).toBe(1);
            expect(decomposed.length).toBe(2);
        });

        it('handles variation selectors', () => {
            // ❤ with text variation selector
            const heartText = '\u2764\uFE0E';
            // ❤ with emoji variation selector
            const heartEmoji = '\u2764\uFE0F';
            const doc = createTestDocument(`
                <span>${heartText}</span>
                <span>${heartEmoji}</span>
            `);
            expect(doc.querySelectorAll('span').length).toBe(2);
        });

        it('handles zero-width joiner in sequences', () => {
            const zwj = '\u200D';
            const sequence = `👩${zwj}💻`; // Woman technologist
            const doc = createTestDocument(`<span>${sequence}</span>`);
            expect(doc.querySelector('span').textContent).toBe(sequence);
        });
    });

    describe('RTL characters', () => {
        it('handles RTL mark', () => {
            const rlm = '\u200F';
            const doc = createTestDocument(`<span>Hello${rlm}World</span>`);
            expect(doc.querySelector('span').textContent).toContain(rlm);
        });

        it('handles LTR mark', () => {
            const lrm = '\u200E';
            const doc = createTestDocument(`<span>مرحبا${lrm}World</span>`);
            expect(doc.querySelector('span').textContent).toContain(lrm);
        });

        it('handles bidirectional override', () => {
            const lro = '\u202D'; // Left-to-Right Override
            const pdf = '\u202C'; // Pop Directional Formatting
            const doc = createTestDocument(`<span>${lro}Hello${pdf}</span>`);
            expect(doc.querySelector('span').textContent).toContain(lro);
            expect(doc.querySelector('span').textContent).toContain(pdf);
        });
    });

    describe('Security-related characters', () => {
        it('handles potential XSS attempt (escaped)', () => {
            const malicious = '<script>alert("xss")</script>';
            const escaped = '&lt;script&gt;alert("xss")&lt;/script&gt;';
            const doc = createTestDocument(`<span>${escaped}</span>`);
            // Should display as text, not execute
            expect(doc.querySelector('span').textContent).toBe(malicious);
        });

        it('handles null byte', () => {
            const withNull = 'Hello\u0000World';
            const doc = createTestDocument(`<span>${withNull}</span>`);
            expect(doc.querySelector('span').textContent).toBe('HelloWorld');
        });

        it('handles unicode escape sequence', () => {
            const unicode = '\u0048\u0065\u006c\u006c\u006f'; // "Hello"
            const doc = createTestDocument(`<span>${unicode}</span>`);
            expect(doc.querySelector('span').textContent).toBe('Hello');
        });
    });
});

// ============================================
// MANY ITEMS TESTS
// ============================================

describe('Many Items Handling', () => {
    it('handles 1000 list items', () => {
        const items = Array.from({ length: 1000 }, (_, i) => `<li>Item ${i + 1}</li>`).join('');
        const doc = createTestDocument(`<ul>${items}</ul>`);
        const listItems = doc.querySelectorAll('li');
        expect(listItems.length).toBe(1000);
    });

    it('handles 100 select options', () => {
        const options = Array.from({ length: 100 }, (_, i) => `<option value="${i}">Option ${i + 1}</option>`).join('');
        const doc = createTestDocument(`<select>${options}</select>`);
        const selectOptions = doc.querySelectorAll('option');
        expect(selectOptions.length).toBe(100);
    });

    it('handles 500 table rows', () => {
        const rows = Array.from({ length: 500 }, (_, i) => `<tr><td>Row ${i + 1}</td></tr>`).join('');
        const doc = createTestDocument(`<table><tbody>${rows}</tbody></table>`);
        const tableRows = doc.querySelectorAll('tr');
        expect(tableRows.length).toBe(500);
    });

    it('handles deeply nested elements', () => {
        const depth = 50;
        let html = '<div>';
        for (let i = 0; i < depth; i++) {
            html += `<div data-level="${i}">`;
        }
        html += 'Content';
        for (let i = 0; i < depth; i++) {
            html += '</div>';
        }
        html += '</div>';

        const doc = createTestDocument(html);
        const divs = doc.querySelectorAll('div');
        expect(divs.length).toBe(depth + 1); // depth wrappers plus outer div
    });

    it('handles 100 checkboxes', () => {
        const checkboxes = Array.from({ length: 100 }, (_, i) => `
            <label class="checkbox-item">
                <input type="checkbox" class="checkbox-input" id="cb${i}">
                <span class="checkbox-label">Option ${i + 1}</span>
            </label>
        `).join('');
        const doc = createTestDocument(`<div>${checkboxes}</div>`);
        const inputs = doc.querySelectorAll('input[type="checkbox"]');
        expect(inputs.length).toBe(100);
    });
});

// ============================================
// NO DATA / EMPTY STATES
// ============================================

describe('Empty States', () => {
    it('handles empty list', () => {
        const doc = createTestDocument(`
            <ul class="list">
                <li class="empty-state" role="status">
                    <p>No items found</p>
                </li>
            </ul>
        `);
        const emptyState = doc.querySelector('.empty-state');
        expect(emptyState).toBeTruthy();
        expect(emptyState.getAttribute('role')).toBe('status');
    });

    it('handles no search results', () => {
        const doc = createTestDocument(`
            <div class="search-results">
                <div class="empty-state" role="status">
                    <p class="empty-state-title">No results</p>
                    <p class="empty-state-description">Try adjusting your search terms</p>
                </div>
            </div>
        `);
        expect(doc.querySelector('.empty-state-title').textContent).toBe('No results');
    });

    it('handles empty table', () => {
        const doc = createTestDocument(`
            <table class="table">
                <tbody>
                    <tr>
                        <td colspan="5" class="table-empty" role="status">
                            <p>No data available</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        `);
        const empty = doc.querySelector('.table-empty');
        expect(empty.getAttribute('role')).toBe('status');
    });

    it('handles empty dropdown', () => {
        const doc = createTestDocument(`
            <div class="dropdown-content" role="listbox">
                <div class="dropdown-empty" role="option">
                    No options available
                </div>
            </div>
        `);
        expect(doc.querySelector('.dropdown-empty')).toBeTruthy();
    });
});

// ============================================
// FLEX LAYOUT OVERFLOW TESTS
// ============================================

describe('Flex Layout Overflow', () => {
    it('flex item with min-width: 0 allows truncation', () => {
        const doc = createTestDocument(`
            <div style="display: flex; width: 200px;">
                <span class="flex-item truncate" style="min-width: 0;">
                    ${generateLongString(500)}
                </span>
            </div>
        `);
        const span = doc.querySelector('span');
        expect(span.classList.contains('flex-item')).toBe(true);
        expect(span.classList.contains('truncate')).toBe(true);
    });

    it('nested flex containers handle overflow', () => {
        const doc = createTestDocument(`
            <div style="display: flex; width: 300px;">
                <div style="display: flex; flex: 1; min-width: 0;">
                    <span class="truncate" style="min-width: 0;">
                        ${generateLongString(200)}
                    </span>
                </div>
            </div>
        `);
        const span = doc.querySelector('span');
        expect(span.textContent).toContain('x'.repeat(200));
    });

    it('grid items with min-width: 0 allow content to shrink', () => {
        const doc = createTestDocument(`
            <div style="display: grid; grid-template-columns: 1fr 1fr; width: 300px;">
                <div class="grid-min-0" style="min-width: 0; overflow: hidden;">
                    <span class="truncate">${generateLongString(200)}</span>
                </div>
                <div>Short</div>
            </div>
        `);
        const gridItem = doc.querySelector('.grid-min-0');
        expect(gridItem).toBeTruthy();
    });
});

// ============================================
// WHITESPACE HANDLING TESTS
// ============================================

describe('Whitespace Handling', () => {
    it('handles multiple spaces', () => {
        const multipleSpaces = 'Hello     World';
        const doc = createTestDocument(`<span>${multipleSpaces}</span>`);
        expect(doc.querySelector('span').textContent).toBe(multipleSpaces);
    });

    it('handles leading/trailing whitespace', () => {
        const withWhitespace = '   Hello World   ';
        const doc = createTestDocument(`<span>${withWhitespace}</span>`);
        expect(doc.querySelector('span').textContent).toBe(withWhitespace);
    });

    it('handles only whitespace', () => {
        const onlyWhitespace = '     ';
        const doc = createTestDocument(`<span>${onlyWhitespace}</span>`);
        expect(doc.querySelector('span').textContent).toBe(onlyWhitespace);
    });

        it('handles mixed whitespace types', () => {
            const mixed = 'Hello\t\n \rWorld';
            const doc = createTestDocument(`<span>${mixed}</span>`);
            expect(doc.querySelector('span').textContent).toBe('Hello\t\n \nWorld');
        });

    it('handles pre-formatted whitespace', () => {
        const preformatted = 'Line 1\n  Line 2 (indented)\n    Line 3 (more indented)';
        const doc = createTestDocument(`<pre>${preformatted}</pre>`);
        expect(doc.querySelector('pre').textContent).toBe(preformatted);
    });
});

// ============================================
// BOUNDARY VALUE TESTS
// ============================================

describe('Boundary Values', () => {
    it('handles minimum integer (Number.MIN_SAFE_INTEGER)', () => {
        const min = Number.MIN_SAFE_INTEGER.toString();
        const doc = createTestDocument(`<span>${min}</span>`);
        expect(doc.querySelector('span').textContent).toBe(min);
    });

    it('handles maximum integer (Number.MAX_SAFE_INTEGER)', () => {
        const max = Number.MAX_SAFE_INTEGER.toString();
        const doc = createTestDocument(`<span>${max}</span>`);
        expect(doc.querySelector('span').textContent).toBe(max);
    });

    it('handles zero', () => {
        const doc = createTestDocument(`<span>0</span>`);
        expect(doc.querySelector('span').textContent).toBe('0');
    });

    it('handles negative zero', () => {
        const negZero = (-0).toString(); // Returns "0"
        const doc = createTestDocument(`<span>${negZero}</span>`);
        expect(doc.querySelector('span').textContent).toBe('0');
    });

    it('handles NaN', () => {
        const nan = 'NaN';
        const doc = createTestDocument(`<span>${nan}</span>`);
        expect(doc.querySelector('span').textContent).toBe(nan);
    });

    it('handles very small positive number', () => {
        const small = Number.MIN_VALUE.toString();
        const doc = createTestDocument(`<span>${small}</span>`);
        expect(doc.querySelector('span').textContent).toBe(small);
    });
});
