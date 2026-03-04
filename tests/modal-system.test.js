import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { ModalService } from '../src/modules/modal-system/services/ModalService.js';

describe('ModalService', () => {
    let eventBus;
    let service;
    let stacks;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        stacks = [];
        eventBus.subscribe('MODAL_STACK_UPDATED', (payload) => stacks.push(payload));
        service = new ModalService(eventBus, { maxStack: 2 });
        service.init();
    });

    it('opens and closes modals with stack publishing', async () => {
        await service.open({ title: 'First' });
        await service.open({ title: 'Second' });
        expect(stacks.at(-1).stack).toHaveLength(2);

        await service.close();
        expect(stacks.at(-1).stack).toHaveLength(1);

        service.closeAll();
        expect(stacks.at(-1).stack).toHaveLength(0);
    });
});
