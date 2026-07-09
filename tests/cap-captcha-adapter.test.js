// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CapCaptchaAdapter } from '../src/modules/captcha/adapters/CapCaptchaAdapter.js';

function createContactForm() {
    document.body.replaceChildren();
    const form = document.createElement('form');
    form.id = 'contact';
    const captcha = document.createElement('div');
    captcha.id = 'captcha';
    form.appendChild(captcha);
    document.body.appendChild(form);
}

describe('CapCaptchaAdapter', () => {
    it('mounts a CAP widget and hidden captchaToken field', async () => {
        createContactForm();
        const adapter = new CapCaptchaAdapter();
        adapter.init({ apiEndpoint: '/cap' });

        const widget = await adapter.mount({
            formId: 'contact',
            formElement: document.querySelector('#contact'),
            container: document.querySelector('#captcha')
        });

        expect(widget.tagName.toLowerCase()).toBe('cap-widget');
        expect(widget.getAttribute('api-endpoint')).toBe('/cap');
        expect(document.querySelector('input[type="hidden"][name="captchaToken"]')).toBeTruthy();
    });

    it('captures solve event tokens and resets them', async () => {
        createContactForm();
        const adapter = new CapCaptchaAdapter();
        adapter.init({ hiddenFieldName: 'captchaToken' });
        const widget = await adapter.mount({
            formId: 'contact',
            formElement: document.querySelector('#contact'),
            container: document.querySelector('#captcha')
        });

        widget.dispatchEvent(new CustomEvent('solve', { detail: { token: 'token-123' } }));

        expect(adapter.getToken({ formId: 'contact' })).toBe('token-123');
        expect(document.querySelector('input[name="captchaToken"]').value).toBe('token-123');

        adapter.reset({ formId: 'contact' });

        expect(adapter.getToken({ formId: 'contact' })).toBe('');
        expect(document.querySelector('input[name="captchaToken"]').value).toBe('');
    });

    it('reports CAP adapter info', () => {
        const adapter = new CapCaptchaAdapter();
        expect(adapter.getAdapterInfo()).toEqual(expect.objectContaining({
            id: 'captcha.cap',
            provider: 'cap',
            capabilities: expect.arrayContaining(['self-hosted', 'proof-of-work'])
        }));
    });
});
