import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { CameraService } from '../src/modules/camera/services/CameraService.js';

const fakeBlob = new Blob(['binary'], { type: 'image/webp' });

describe('CameraService', () => {
    let eventBus;
    let fileSystem;
    let camera;
    let events;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        events = [];
        eventBus.subscribe('CAMERA_CAPTURE_COMPLETED', (payload) => {
            events.push(payload);
        });

        fileSystem = {
            store: vi.fn(async (blob, metadata) => ({
                id: `fs-${metadata.title}`,
                title: metadata.title,
                size: blob.size
            }))
        };

        const adapter = {
            capturePhoto: vi.fn(async () => fakeBlob),
            startVideo: vi.fn(async () => ({
                stream: { getTracks: () => [{ stop: vi.fn() }] },
                recorder: {
                    state: 'inactive',
                    start: vi.fn(),
                    stop: vi.fn(),
                    ondataavailable: null,
                    onstop: null
                }
            }))
        };

        camera = new CameraService(eventBus, {
            platformAdapter: adapter,
            fileSystem,
            persistCaptures: true
        });
        camera.init({ fileSystemService: fileSystem });
    });

    it('captures photos and persists via file system', async () => {
        const { blob, file } = await camera.capturePhoto({ title: 'Sample Photo' });
        expect(blob).toBeInstanceOf(Blob);
        expect(file).toBeTruthy();
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('photo');
    });
});
