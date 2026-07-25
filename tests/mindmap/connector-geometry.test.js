import { describe, it, expect } from 'vitest';
import {
  main,
  sub,
  rectFromNodes,
  directionClassFor,
  DIRECTION_CLASS
} from '../../src/modules/mindmap/services/ConnectorGeometry.js';

const baseRect = {
  pT: 0, pL: 0, pW: 180, pH: 44,
  cT: 100, cL: 260, cW: 180, cH: 44
};

describe('ConnectorGeometry', () => {
  describe('main()', () => {
    it('returns an SVG path d attribute starting with M', () => {
      const d = main(baseRect, { direction: DIRECTION_CLASS.RHS, containerHeight: 400 });
      expect(d.startsWith('M ')).toBe(true);
    });

    it('LHS main connector ends at the right edge of the child (cL + cW)', () => {
      const d = main(baseRect, { direction: DIRECTION_CLASS.LHS, containerHeight: 400 });
      // Path should terminate near (cL + cW, cT + cH/2) = (440, 122)
      expect(d).toContain('440');
      expect(d).toContain('122');
    });

    it('DOWN main connector uses the roundedVertical shape (V/Q/H commands)', () => {
      const d = main(baseRect, { direction: DIRECTION_CLASS.DOWN, containerHeight: 400 });
      expect(d).toMatch(/[VH]/);
      expect(d.startsWith('M ')).toBe(true);
    });

    it('returns vertical-only path when parent and child share x', () => {
      const d = main(
        { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 0, cW: 100, cH: 40 },
        { direction: DIRECTION_CLASS.DOWN, containerHeight: 400 }
      );
      expect(d).toBe('M 50 40 V 100');
    });
  });

  describe('sub()', () => {
    it('RHS sub connector uses cubic Bézier C command', () => {
      const d = sub(baseRect, { direction: DIRECTION_CLASS.RHS, isFirst: false });
      expect(d).toContain('C ');
    });

    it('LHS sub connector uses cubic Bézier with H end segment', () => {
      const d = sub(baseRect, { direction: DIRECTION_CLASS.LHS, isFirst: true });
      expect(d).toContain('C ');
      expect(d).toContain('H ');
    });

    it('honours custom nodeGapX (GAP value affects control points)', () => {
      const small = sub(baseRect, { direction: DIRECTION_CLASS.RHS, isFirst: false, nodeGapX: 10 });
      const large = sub(baseRect, { direction: DIRECTION_CLASS.RHS, isFirst: false, nodeGapX: 100 });
      expect(small).not.toEqual(large);
    });

    it('DOWN sub connector matches roundedVertical output', () => {
      const d = sub(baseRect, { direction: DIRECTION_CLASS.DOWN, isFirst: true });
      expect(d.startsWith('M ')).toBe(true);
      expect(d).toMatch(/V/);
    });
  });

  describe('helpers', () => {
    it('rectFromNodes maps {x,y,w,h} to {p*,c*}', () => {
      const parent = { x: 0, y: 0, w: 100, h: 40 };
      const child = { x: 200, y: 50, w: 100, h: 40 };
      const r = rectFromNodes(parent, child);
      expect(r).toEqual({ pT: 0, pL: 0, pW: 100, pH: 40, cT: 50, cL: 200, cW: 100, cH: 40 });
    });

    it('directionClassFor maps LayoutEngine link directions', () => {
      expect(directionClassFor({ direction: 0 })).toBe(DIRECTION_CLASS.RHS);
      expect(directionClassFor({ direction: 1 })).toBe(DIRECTION_CLASS.LHS);
      expect(directionClassFor({ direction: undefined })).toBe(DIRECTION_CLASS.DOWN);
    });
  });
});
