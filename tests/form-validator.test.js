import { describe, expect, it, vi } from 'vitest';
import { FormValidator } from '../src/services/core/FormValidator.js';

describe('FormValidator', () => {
    it('renders validation errors as text instead of executable HTML', () => {
        const eventBus = { publish: vi.fn() };
        const validator = new FormValidator(eventBus);
        const formElement = document.createElement('form');
        const wrapper = document.createElement('label');
        const input = document.createElement('input');

        input.name = 'email';
        wrapper.appendChild(input);
        formElement.appendChild(wrapper);
        document.body.appendChild(formElement);

        validator.fieldErrors.set('contact', new Map([
            ['email', ['<img src=x onerror="window.__xss = true">Required']]
        ]));

        validator.updateFormUI(formElement, 'contact');

        const errorContainer = formElement.querySelector('.field-errors');
        expect(errorContainer.textContent).toBe('<img src=x onerror="window.__xss = true">Required');
        expect(errorContainer.querySelector('img')).toBeNull();
    });
});
