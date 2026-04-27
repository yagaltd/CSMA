/**
 * Media contracts validation test.
 */
import { describe, it, expect } from 'vitest';
import { MediaContracts } from '../src/modules/media/contracts/media-contracts.js';

describe('MediaContracts', () => {
    it('has all active capture intents', () => {
        const names = Object.keys(MediaContracts);
        expect(names).toContain('INTENT_MEDIA_CAPTURE_PHOTO');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_VIDEO_START');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_VIDEO_STOP');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_AUDIO_START');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_AUDIO_STOP');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_SCREEN_START');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_SCREEN_STOP');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_CANCEL');
    });

    it('has all active capture events', () => {
        const names = Object.keys(MediaContracts);
        expect(names).toContain('MEDIA_CAPTURE_STARTED');
        expect(names).toContain('MEDIA_CAPTURE_COMPLETED');
        expect(names).toContain('MEDIA_CAPTURE_ERROR');
    });

    it('has all transform intents', () => {
        const names = Object.keys(MediaContracts);
        expect(names).toContain('INTENT_MEDIA_TRANSFORM');
        expect(names).toContain('INTENT_MEDIA_OPTIMIZE');
        expect(names).toContain('INTENT_MEDIA_RESIZE');
    });

    it('has all transform events', () => {
        const names = Object.keys(MediaContracts);
        expect(names).toContain('MEDIA_TRANSFORM_COMPLETED');
        expect(names).toContain('MEDIA_OPTIMIZE_COMPLETED');
        expect(names).toContain('MEDIA_RESIZE_COMPLETED');
        expect(names).toContain('MEDIA_TRANSFORM_ERROR');
    });

    it('has all deprecated aliases', () => {
        const names = Object.keys(MediaContracts);
        expect(names).toContain('INTENT_CAMERA_CAPTURE_PHOTO');
        expect(names).toContain('INTENT_CAMERA_CAPTURE_VIDEO_START');
        expect(names).toContain('INTENT_CAMERA_CAPTURE_VIDEO_STOP');
        expect(names).toContain('CAMERA_CAPTURE_COMPLETED');
        expect(names).toContain('CAMERA_CAPTURE_ERROR');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_START');
        expect(names).toContain('INTENT_MEDIA_CAPTURE_STOP');
        expect(names).toContain('MEDIA_CAPTURE_STOPPED');
        expect(names).toContain('INTENT_IMAGE_OPTIMIZE');
        expect(names).toContain('IMAGE_OPTIMIZE_COMPLETED');
        expect(names).toContain('IMAGE_OPTIMIZE_ERROR');
    });

    it('all active contracts have required metadata', () => {
        for (const [name, contract] of Object.entries(MediaContracts)) {
            if (contract.lifecycle === 'deprecated') continue;
            expect(contract.version, `${name} missing version`).toBeTypeOf('number');
            expect(contract.type, `${name} missing type`).toMatch(/^(intent|event)$/);
            expect(contract.owner, `${name} missing owner`).toBe('media-module');
            expect(contract.lifecycle, `${name} missing lifecycle`).toBe('active');
            expect(contract.schema, `${name} missing schema`).toBeTruthy();
        }
    });

    it('deprecated contracts have lifecycle deprecated', () => {
        const deprecated = [
            'INTENT_CAMERA_CAPTURE_PHOTO',
            'INTENT_MEDIA_CAPTURE_START',
            'INTENT_IMAGE_OPTIMIZE'
        ];
        for (const name of deprecated) {
            expect(MediaContracts[name].lifecycle).toBe('deprecated');
        }
    });

    it('contract count matches implementation', () => {
        const count = Object.keys(MediaContracts).length;
        // 18 active + 11 deprecated = 29
        // INTENT_MEDIA_CAPTURE_CANCEL is unchanged (not deprecated), so 11 not 12 deprecated
        expect(count).toBe(29);
    });
});
