import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { MediaCaptureService } from '../src/modules/media-capture/services/MediaCaptureService.js';

class FakeRecorder {
    constructor(stream) {
        this.stream = stream;
        this.state = 'inactive';
    }

    start() {
        this.state = 'recording';
        this.onstart?.();
    }

    stop() {
        this.state = 'inactive';
        setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
            this.onstop?.();
        }, 0);
    }
}

describe('MediaCaptureService', () => {
    let eventBus;
    let fileSystem;
    let service;
    let events;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        events = [];
        eventBus.subscribe('MEDIA_CAPTURE_STOPPED', (payload) => {
            events.push(payload);
        });

        fileSystem = {
            store: vi.fn(async (blob, metadata) => ({
                id: `fs-${metadata.title}`,
                title: metadata.title,
                size: blob.size
            }))
        };

        service = new MediaCaptureService(eventBus, {
            recorderFactory: () => new FakeRecorder({ getTracks: () => [{ stop: vi.fn() }] }),
            streamGetter: async () => ({ getTracks: () => [{ stop: vi.fn() }] }),
            fileSystem
        });

        service.init({ fileSystemService: fileSystem });
    });

    it('records audio and persists via file system', async () => {
        const startInfo = await service.start({ title: 'Daily Note' });
        expect(startInfo.id).toBeDefined();

        const result = await service.stop();
        expect(result.mimeType).toBe('audio/webm;codecs=opus');
        expect(result.file).toBeTruthy();
        expect(fileSystem.store).toHaveBeenCalledTimes(1);
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe(result.id);
    });

    it('can cancel recordings without persisting', async () => {
        await service.start({ title: 'Temp' });
        service.cancel();
        expect(fileSystem.store).not.toHaveBeenCalled();
    });
});
