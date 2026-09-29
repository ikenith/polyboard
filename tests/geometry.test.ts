import { describe, it, expect } from "vitest";
import { generateBoardGeometry } from "../src/games/ludo/geometry";
import { LUDO_BOARD_CONFIG } from "../src/games/ludo/config";
import { computePathPoints } from "../src/client/components/BoardRenderer";

describe("Ludo Procedural Board Geometry", () => {
  it.each([3, 4, 5, 6, 7])("generates valid geometry for %i arms", (arms) => {
    const geo = generateBoardGeometry(arms);

    expect(geo.armCount).toBe(arms);
    expect(geo.arms.length).toBe(arms);
    expect(Object.keys(geo.trackCellsByRingIndex).length).toBe(arms * LUDO_BOARD_CONFIG.CELLS_PER_ARM);

    // Verify all points are finite numbers
    for (const arm of geo.arms) {
      expect(arm.trackCells.length).toBe(LUDO_BOARD_CONFIG.CELLS_PER_ARM);
      expect(arm.homeColumnCells.length).toBe(LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH);
      expect(arm.yard.tokenSlots.length).toBe(4);

      for (const cell of arm.trackCells) {
        expect(Number.isFinite(cell.point.x)).toBe(true);
        expect(Number.isFinite(cell.point.y)).toBe(true);
        expect(cell.point.x).toBeGreaterThanOrEqual(0);
        expect(cell.point.x).toBeLessThanOrEqual(1000);
        expect(cell.point.y).toBeGreaterThanOrEqual(0);
        expect(cell.point.y).toBeLessThanOrEqual(1000);
      }

      for (const hCell of arm.homeColumnCells) {
        expect(Number.isFinite(hCell.point.x)).toBe(true);
        expect(Number.isFinite(hCell.point.y)).toBe(true);
      }

      for (const slot of arm.yard.tokenSlots) {
        expect(Number.isFinite(slot.x)).toBe(true);
        expect(Number.isFinite(slot.y)).toBe(true);
      }
    }
  });

  it("correctly flags safe start cells and star cells", () => {
    const geo = generateBoardGeometry(4);

    // Arm 0 start is at offset 1, star is at offset 9
    const startCell0 = geo.trackCellsByRingIndex[1];
    expect(startCell0.isStart).toBe(true);
    expect(startCell0.isSafe).toBe(true);

    const starCell0 = geo.trackCellsByRingIndex[9];
    expect(starCell0.isStar).toBe(true);
    expect(starCell0.isSafe).toBe(true);

    // Offset 0 should not be safe
    const normalCell = geo.trackCellsByRingIndex[0];
    expect(normalCell.isSafe).toBe(false);
  });

  describe("computePathPoints Animation Pathing", () => {
    it("includes the start cell before entering home column from track (arm 0)", () => {
      const geo = generateBoardGeometry(4);
      // Arm 0, total ring cells = 52.
      // Token at ring index 50 moves to home column index 1.
      const points = computePathPoints(
        0,
        4,
        { type: "track", ringIndex: 50, distanceTraveled: 49 },
        { type: "home_column", index: 1, distanceTraveled: 53 },
        geo
      );

      // Path should traverse cell 51, cell 0, cell 1 (the start cell), then home.
      expect(points.length).toBe(5);
      expect(points[0]).toEqual(geo.trackCellsByRingIndex[51].point);
      expect(points[1]).toEqual(geo.trackCellsByRingIndex[0].point);
      expect(points[2]).toEqual(geo.trackCellsByRingIndex[1].point);
      expect(points[3]).toEqual(geo.homeColumnCells["0_0"].point);
      expect(points[4]).toEqual(geo.homeColumnCells["0_1"].point);
    });

    it("steps cell-by-cell forward on track", () => {
      const geo = generateBoardGeometry(4);
      const points = computePathPoints(
        0,
        4,
        { type: "track", ringIndex: 1, distanceTraveled: 0 },
        { type: "track", ringIndex: 4, distanceTraveled: 3 },
        geo
      );

      expect(points.length).toBe(3);
      expect(points[0]).toEqual(geo.trackCellsByRingIndex[2].point);
      expect(points[1]).toEqual(geo.trackCellsByRingIndex[3].point);
      expect(points[2]).toEqual(geo.trackCellsByRingIndex[4].point);
    });

    it("steps from home column to center goal", () => {
      const geo = generateBoardGeometry(4);
      const points = computePathPoints(
        0,
        4,
        { type: "home_column", index: 3, distanceTraveled: 55 },
        { type: "home" },
        geo
      );

      expect(points.length).toBe(2);
      expect(points[0]).toEqual(geo.homeColumnCells["0_4"].point);
      expect(points[1]).toEqual(geo.centerGoals[0].point);
    });
  });
});
