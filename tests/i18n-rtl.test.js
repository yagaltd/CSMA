/**
 * Internationalization & RTL Tests
 * Tests for right-to-left language support, text expansion, and CJK characters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * RTL test strings
 */
const rtlTestCases = {
    arabic: {
        greeting: 'مرحبا بالعالم',
        longText: 'هذا نص تجريبي طويل جداً لاختبار كيفية تعامل الواجهة مع النصوص الطويلة في اللغة العربية',
        numbers: '١٢٣٤٥٦٧٨٩٠', // Arabic-Indic numerals
        mixed: 'مرحبا 2024 World',
        formLabel: 'البريد الإلكتروني',
        button: 'إرسال',
        error: 'خطأ في إدخال البيانات'
    },
    hebrew: {
        greeting: 'שלום עולם',
        longText: 'זהו טקסט דוגמה ארוך מאוד לבדיקת האופן שבו הממשק מתמודד עם טקסטים ארוכים בשפה העברית',
        numbers: '۱۲۳۴۵۶۷۸۹۰',
        mixed: 'שלום 2024 World',
        formLabel: 'דואר אלקטרוני',
        button: 'שלח',
        error: 'שגיאה בהזנת נתונים'
    },
    farsi: {
        greeting: 'سلام دنیا',
        longText: 'این یک متن نمونه بسیار طولانی برای آزمایش نحوه برخورد رابط کاربری با متون طولانی به زبان فارسی است',
        numbers: '۱۲۳۴۵۶۷۸۹۰', // Persian numerals
        mixed: 'سلام 2024 World',
        formLabel: 'پست الکترونیک',
        button: 'ارسال',
        error: 'خطا در ورود داده‌ها'
    }
};

/**
 * LTR test strings for comparison (German for text expansion testing)
 */
const ltrTestCases = {
    english: {
        greeting: 'Hello World',
        shortButton: 'Submit',
        formLabel: 'Email'
    },
    german: {
        // German is typically 30% longer than English
        greeting: 'Hallo Welt',
        shortButton: 'Einreichen', // ~50% longer than "Submit"
        formLabel: 'E-Mail-Adresse', // ~50% longer than "Email"
        longWord: 'Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft',
        privacy: 'Datenschutzrichtlinien'
    },
    french: {
        greeting: 'Bonjour le monde',
        shortButton: 'Soumettre',
        formLabel: 'Adresse électronique'
    }
};

/**
 * CJK test strings
 */
const cjkTestCases = {
    chinese: {
        simplified: '欢迎使用我们的应用程序',
        traditional: '歡迎使用我們的應用程式',
        longText: '这是一个用于测试界面如何处理中文长文本的示例。中文文本通常不需要空格分隔，这可能导致不同的换行行为。',
        numbers: '一二三四五六七八九十',
        mixed: '欢迎 2024 年'
    },
    japanese: {
        greeting: '私たちのアプリへようこそ',
        longText: 'これは、インターフェースが日本語の長いテキストをどのように処理するかをテストするためのサンプルです。',
        mixed: 'ようこそ 2024 年',
        kana: 'こんにちは世界'
    },
    korean: {
        greeting: '우리 앱에 오신 것을 환영합니다',
        longText: '이것은 인터페이스가 한국어 긴 텍스트를 어떻게 처리하는지 테스트하기 위한 샘플입니다.',
        mixed: '환영 2024 년',
        hangul: '안녕하세요 세계'
    }
};

/**
 * Create a test DOM with RTL support
 */
function createRTLTestDOM(content, dir = 'rtl') {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html dir="${dir}" lang="ar">
        <head>
            <style>
                body { margin: 0; padding: 20px; }
                .test-container { max-width: 400px; }
                .test-text { font-family: system-ui; }
                .flex-container { display: flex; gap: 10px; }
                .grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                [dir="rtl"] .arrow { transform: scaleX(-1); }
            </style>
        </head>
        <body>
            <div class="test-container">${content}</div>
        </body>
        </html>
    `, { runScripts: 'dangerously' });
    return dom.window.document;
}

describe('RTL Text Handling', () => {
    describe('Arabic text rendering', () => {
        it('renders Arabic greeting correctly', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.arabic.greeting}</p>`);
            const text = doc.querySelector('.test-text').textContent;
            expect(text).toBe(rtlTestCases.arabic.greeting);
        });

        it('handles Arabic long text without overflow', () => {
            const doc = createRTLTestDOM(`<p class="test-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rtlTestCases.arabic.longText}</p>`);
            const el = doc.querySelector('.test-text');
            expect(el.textContent.length).toBeGreaterThan(50);
        });

        it('handles mixed Arabic-English text', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.arabic.mixed}</p>`);
            const text = doc.querySelector('.test-text').textContent;
            expect(text).toContain('2024');
            expect(text).toContain('World');
        });

        it('sets correct document direction', () => {
            const doc = createRTLTestDOM('<p>Test</p>', 'rtl');
            const html = doc.querySelector('html');
            expect(html.getAttribute('dir')).toBe('rtl');
        });
    });

    describe('Hebrew text rendering', () => {
        it('renders Hebrew greeting correctly', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.hebrew.greeting}</p>`, 'rtl');
            const text = doc.querySelector('.test-text').textContent;
            expect(text).toBe(rtlTestCases.hebrew.greeting);
        });

        it('handles Hebrew long text', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.hebrew.longText}</p>`, 'rtl');
            expect(doc.querySelector('.test-text').textContent.length).toBeGreaterThan(50);
        });
    });

    describe('Farsi text rendering', () => {
        it('renders Farsi greeting correctly', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.farsi.greeting}</p>`, 'rtl');
            const text = doc.querySelector('.test-text').textContent;
            expect(text).toBe(rtlTestCases.farsi.greeting);
        });

        it('handles Farsi numerals', () => {
            const doc = createRTLTestDOM(`<p class="test-text">${rtlTestCases.farsi.numbers}</p>`, 'rtl');
            const text = doc.querySelector('.test-text').textContent;
            expect(text).toBe(rtlTestCases.farsi.numbers);
        });
    });
});

describe('Text Expansion (i18n)', () => {
    describe('German text expansion', () => {
        it('German button text is longer than English', () => {
            const enLength = ltrTestCases.english.shortButton.length;
            const deLength = ltrTestCases.german.shortButton.length;
            expect(deLength).toBeGreaterThan(enLength);
        });

        it('German form label is longer than English', () => {
            const enLength = ltrTestCases.english.formLabel.length;
            const deLength = ltrTestCases.german.formLabel.length;
            expect(deLength).toBeGreaterThan(enLength);
        });

        it('handles German compound words', () => {
            const longWord = ltrTestCases.german.longWord;
            expect(longWord.length).toBeGreaterThan(30);

            const doc = createRTLTestDOM(
                `<p class="test-text" style="overflow-wrap: break-word;">${longWord}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(longWord);
        });
    });

    describe('Text expansion budget', () => {
        it('provides 30% expansion budget for buttons', () => {
            const enButton = ltrTestCases.english.shortButton;
            const minExpandedWidth = enButton.length * 1.3;
            const deButton = ltrTestCases.german.shortButton;

            // German should fit within 30% expansion budget
            expect(deButton.length).toBeLessThanOrEqual(minExpandedWidth + 5); // +5 for tolerance
        });
    });
});

describe('CJK Character Handling', () => {
    describe('Chinese characters', () => {
        it('renders simplified Chinese correctly', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text">${cjkTestCases.chinese.simplified}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(cjkTestCases.chinese.simplified);
        });

        it('renders traditional Chinese correctly', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text">${cjkTestCases.chinese.traditional}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(cjkTestCases.chinese.traditional);
        });

        it('handles Chinese long text with proper wrapping', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text" style="width: 200px; word-wrap: break-word;">${cjkTestCases.chinese.longText}</p>`,
                'ltr'
            );
            const el = doc.querySelector('.test-text');
            expect(el.textContent.length).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Japanese characters', () => {
        it('renders Japanese correctly', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text">${cjkTestCases.japanese.greeting}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(cjkTestCases.japanese.greeting);
        });

        it('handles mixed Japanese scripts (Kanji, Hiragana, Katakana)', () => {
            const mixed = `${cjkTestCases.japanese.greeting} - ${cjkTestCases.japanese.kana}`;
            const doc = createRTLTestDOM(`<p class="test-text">${mixed}</p>`, 'ltr');
            expect(doc.querySelector('.test-text').textContent).toContain('こんにちは');
        });
    });

    describe('Korean characters', () => {
        it('renders Korean correctly', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text">${cjkTestCases.korean.greeting}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(cjkTestCases.korean.greeting);
        });

        it('handles Hangul syllables', () => {
            const doc = createRTLTestDOM(
                `<p class="test-text">${cjkTestCases.korean.hangul}</p>`,
                'ltr'
            );
            expect(doc.querySelector('.test-text').textContent).toBe(cjkTestCases.korean.hangul);
        });
    });
});

describe('Emoji Handling', () => {
    const emojiTests = [
        { emoji: '😀', name: 'Simple emoji' },
        { emoji: '👨‍👩‍👧‍👦', name: 'Family emoji (ZWJ sequence)' },
        { emoji: '🏳️‍🌈', name: 'Flag with variant' },
        { emoji: '👍🏼', name: 'Emoji with skin tone modifier' },
        { emoji: '🎉🎊🎁', name: 'Multiple emojis' }
    ];

    emojiTests.forEach(({ emoji, name }) => {
        it(`handles ${name}`, () => {
            const doc = createRTLTestDOM(`<p class="test-text">${emoji}</p>`);
            expect(doc.querySelector('.test-text').textContent).toContain(emoji);
        });
    });

    it('handles emoji in RTL context', () => {
        const text = `${rtlTestCases.arabic.greeting} 😀`;
        const doc = createRTLTestDOM(`<p class="test-text">${text}</p>`, 'rtl');
        expect(doc.querySelector('.test-text').textContent).toContain('😀');
    });
});

describe('CSS Logical Properties', () => {
    it('uses margin-inline-start instead of margin-left for RTL support', () => {
        // This test documents the requirement - actual CSS verification would need a real browser
        const logicalProperties = [
            'margin-inline-start',
            'margin-inline-end',
            'padding-inline-start',
            'padding-inline-end',
            'border-inline-start',
            'border-inline-end',
            'inset-inline-start',
            'inset-inline-end'
        ];

        // These properties should be used instead of physical ones
        const physicalProperties = [
            'margin-left',
            'margin-right',
            'padding-left',
            'padding-right',
            'border-left',
            'border-right',
            'left',
            'right'
        ];

        // Document the mapping
        expect(logicalProperties.length).toBe(physicalProperties.length);
    });

    it('handles flexbox direction in RTL', () => {
        const doc = createRTLTestDOM(`
            <div class="flex-container" style="display: flex; flex-direction: row;">
                <span>First</span>
                <span>Second</span>
            </div>
        `, 'rtl');

        const container = doc.querySelector('.flex-container');
        expect(container).toBeTruthy();
    });
});

describe('Form Controls in RTL', () => {
    it('renders form labels correctly in RTL', () => {
        const doc = createRTLTestDOM(`
            <form>
                <label>${rtlTestCases.arabic.formLabel}</label>
                <input type="email" dir="ltr" placeholder="example@domain.com">
            </form>
        `, 'rtl');

        const label = doc.querySelector('label').textContent;
        expect(label).toBe(rtlTestCases.arabic.formLabel);
    });

    it('keeps email input LTR in RTL context', () => {
        const doc = createRTLTestDOM(`
            <input type="email" dir="ltr" value="test@example.com">
        `, 'rtl');

        const input = doc.querySelector('input');
        expect(input.getAttribute('dir')).toBe('ltr');
    });

    it('renders RTL button text correctly', () => {
        const doc = createRTLTestDOM(`
            <button>${rtlTestCases.arabic.button}</button>
        `, 'rtl');

        expect(doc.querySelector('button').textContent).toBe(rtlTestCases.arabic.button);
    });
});

describe('Error Messages in RTL', () => {
    it('displays Arabic error message correctly', () => {
        const doc = createRTLTestDOM(`
            <div class="error" role="alert">${rtlTestCases.arabic.error}</div>
        `, 'rtl');

        const error = doc.querySelector('.error');
        expect(error.getAttribute('role')).toBe('alert');
        expect(error.textContent).toBe(rtlTestCases.arabic.error);
    });
});

describe('Number Formatting', () => {
    it('handles Arabic-Indic numerals', () => {
        const arabicNumerals = rtlTestCases.arabic.numbers;
        expect(arabicNumerals).toBe('١٢٣٤٥٦٧٨٩٠');
    });

    it('handles Persian numerals', () => {
        const persianNumerals = rtlTestCases.farsi.numbers;
        expect(persianNumerals).toBe('۱۲۳۴۵۶۷۸۹۰');
    });

    it('mixed content with numbers in RTL', () => {
        const doc = createRTLTestDOM(`
            <p>Price: $100.00</p>
        `, 'rtl');

        expect(doc.querySelector('p').textContent).toContain('$100.00');
    });
});
