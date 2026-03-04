const csma = window.csma || {};
const eventBus = csma.eventBus;

const form = document.querySelector('[data-otp-form]');
const inputs = Array.from(document.querySelectorAll('[data-otp-input]'));
const statusEl = document.querySelector('[data-otp-status]');
const resendEl = document.querySelector('[data-otp-resend]');

const OTP_LENGTH = inputs.length || 6;

function init() {
    if (!form || !inputs.length) return;

    inputs.forEach((input, index) => {
        input.addEventListener('input', () => handleInput(input, index));
        input.addEventListener('keydown', (event) => handleKeydown(event, index));
        input.addEventListener('paste', handlePaste);
    });

    form.addEventListener('submit', handleSubmit);

    if (resendEl) {
        resendEl.addEventListener('click', handleResend);
    }

    updateStatus('idle', 'Idle');

    if (eventBus?.subscribe) {
        eventBus.subscribe('OTP_STATE_UPDATED', ({ status, message }) => updateStatus(status, message));
    }
}

function sanitizeDigit(value) {
    return (value || '').replace(/\D/g, '').slice(-1);
}

function handleInput(input, index) {
    const digit = sanitizeDigit(input.value);
    input.value = digit;

    publishChange();
    updateStatus('idle', '');

    if (digit && index < inputs.length - 1) {
        inputs[index + 1].focus();
    }
}

function handleKeydown(event, index) {
    const key = event.key;

    if (key === 'Backspace' && !inputs[index].value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        publishChange();
    }

    if (key === 'ArrowLeft' && index > 0) {
        inputs[index - 1].focus();
    }

    if (key === 'ArrowRight' && index < inputs.length - 1) {
        inputs[index + 1].focus();
    }
}

function handlePaste(event) {
    event.preventDefault();
    const data = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!data) return;

    inputs.forEach((input, idx) => {
        input.value = data[idx] || '';
    });

    const targetIndex = Math.min(data.length, inputs.length) - 1;
    if (targetIndex >= 0) {
        inputs[targetIndex].focus();
    }

    publishChange();
    updateStatus('idle', '');
}

function getCode() {
    return inputs.map((input) => sanitizeDigit(input.value)).join('');
}

function handleSubmit(event) {
    event.preventDefault();
    const code = getCode();

    if (code.length < OTP_LENGTH) {
        updateStatus('error', `Enter ${OTP_LENGTH} digits`);
        return;
    }

    updateStatus('loading', 'Verifying...');

    if (eventBus?.publish) {
        eventBus.publish('INTENT_OTP_SUBMIT', {
            code,
            length: OTP_LENGTH,
            timestamp: Date.now()
        });
    }

    const otpClient = csma.otpClient || null;
    if (otpClient?.verify) {
        otpClient.verify({ code })
            .then(() => updateStatus('success', 'Code accepted'))
            .catch((error) => updateStatus('error', error?.message || 'Verification failed'));
        return;
    }

    setTimeout(() => updateStatus('success', 'Code submitted (mock)'), 500);
}

function handleResend(event) {
    event.preventDefault();
    clearInputs();
    updateStatus('loading', 'Requesting new code...');

    if (eventBus?.publish) {
        eventBus.publish('INTENT_OTP_RESEND', { timestamp: Date.now() });
    }

    setTimeout(() => updateStatus('success', 'New code sent'), 700);
}

function clearInputs() {
    inputs.forEach((input) => { input.value = ''; });
    if (inputs[0]) inputs[0].focus();
    publishChange();
}

function publishChange() {
    if (!eventBus?.publish) return;
    eventBus.publish('OTP_CODE_CHANGED', {
        code: getCode(),
        length: OTP_LENGTH,
        timestamp: Date.now()
    });
}

function updateStatus(state, message) {
    if (!statusEl) return;
    statusEl.dataset.state = state || 'idle';
    statusEl.textContent = message || 'Idle';
}

init();
