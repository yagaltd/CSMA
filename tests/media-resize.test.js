/**
 * CanvasResize tests — dimension calculation.
 */
import { describe, it, expect } from 'vitest';
import { calculateDimensions } from '../src/modules/media/codecs/resize/CanvasResize.js';

describe('CanvasResize', () => {
    describe('calculateDimensions', () => {
        it('returns source dimensions when no constraints', () => {
            const result = calculateDimensions(1000, 800);
            expect(result.width).toBe(1000);
            expect(result.height).toBe(800);
        });

        it('scales down to maxWidth maintaining aspect ratio', () => {
            const result = calculateDimensions(1000, 800, { maxWidth: 500 });
            expect(result.width).toBe(500);
            expect(result.height).toBe(400);
        });

        it('scales down to maxHeight maintaining aspect ratio', () => {
            const result = calculateDimensions(1000, 800, { maxHeight: 400 });
            expect(result.width).toBe(500);
            expect(result.height).toBe(400);
        });

        it('scales to fit both maxWidth and maxHeight', () => {
            const result = calculateDimensions(1000, 800, { maxWidth: 400, maxHeight: 300 });
            expect(result.width).toBeLessThanOrEqual(400);
            expect(result.height).toBeLessThanOrEqual(300);
        });

        it('does not upscale with maxWidth', () => {
            const result = calculateDimensions(100, 80, { maxWidth: 500 });
            expect(result.width).toBe(100);
            expect(result.height).toBe(80);
        });

        it('scales to exact width only', () => {
            const result = calculateDimensions(1000, 800, { width: 500 });
            expect(result.width).toBe(500);
            expect(result.height).toBe(400);
        });

        it('scales to exact height only', () => {
            const result = calculateDimensions(1000, 800, { height: 400 });
            expect(result.width).toBe(500);
            expect(result.height).toBe(400);
        });

        it('distorts when both width and height set without maintainAspect', () => {
            const result = calculateDimensions(1000, 800, { width: 200, height: 100, maintainAspect: false });
            expect(result.width).toBe(200);
            expect(result.height).toBe(100);
        });

        it('fits within width x height with maintainAspect', () => {
            const result = calculateDimensions(1000, 500, { width: 200, height: 200, maintainAspect: true });
            expect(result.width).toBe(200);
            expect(result.height).toBe(100);
        });

        it('clamps to browser max canvas size', () => {
            // Request something huge — should be clamped
            const result = calculateDimensions(100000, 100000);
            expect(result.width).toBeLessThanOrEqual(65536);
            expect(result.height).toBeLessThanOrEqual(65536);
        });
    });
});
