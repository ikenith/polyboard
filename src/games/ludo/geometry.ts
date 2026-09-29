import { LUDO_BOARD_CONFIG } from "./config";

export interface Point {
  x: number;
  y: number;
}

export interface CellCoord {
  id: string; // e.g. "track_0", "home_col_0_2", "yard_0_1", "center_0"
  point: Point;
  radius: number;
  type: "track" | "home_column" | "yard" | "center";
  armIndex: number;
  ringIndex?: number;
  homeColIndex?: number;
  yardSlotIndex?: number;
  isSafe?: boolean;
  isStart?: boolean;
  isStar?: boolean;
  tilePolygon?: Point[]; // 4 corner points of the cell tile
}

export interface YardGeometry {
  armIndex: number;
  center: Point;
  boxWidth: number;
  boxHeight: number;
  tokenSlots: Point[]; // 4 points
}

export interface ArmGeometry {
  armIndex: number;
  angleRad: number;
  trackCells: CellCoord[]; // 13 cells
  homeColumnCells: CellCoord[]; // 5 cells
  yard: YardGeometry;
  centerWedge: Point[]; // Polygon points for center wedge
  centerGoalPoint: Point;
  armTrackPolygon: Point[]; // Outer boundary of the 3-lane track
}

export interface BoardGeometry {
  armCount: number;
  viewBox: string;
  center: Point;
  arms: ArmGeometry[];
  trackCellsByRingIndex: Record<number, CellCoord>;
  homeColumnCells: Record<string, CellCoord>; // key: `${armIndex}_${colIndex}`
  yardSlots: Record<string, CellCoord>; // key: `${armIndex}_${slotIndex}`
  centerGoals: Record<number, CellCoord>; // key: armIndex
}

/**
 * Computes procedural geometry for an M-arm Ludo board.
 * N arms, each identical, with a yard, start cell, home column and shared track.
 * One single geometry function for all N.
 */
export function generateBoardGeometry(armCount: number): BoardGeometry {
  const cx = 500;
  const cy = 500;
  const viewBox = "0 0 1000 1000";

  // Scale parameters based on armCount
  // More arms = slightly smaller cell width so they do not overlap near center
  const scale = armCount >= 6 ? 0.86 : armCount === 5 ? 0.92 : 1.0;

  const R_center = 84 * scale;
  const R_tip = 430 * scale;
  const cellRadius = 15 * scale;
  const W = 32 * scale; // Half-width of lane offset (total arm width ~ 3*W)

  const arms: ArmGeometry[] = [];
  const trackCellsByRingIndex: Record<number, CellCoord> = {};
  const homeColumnCells: Record<string, CellCoord> = {};
  const yardSlots: Record<string, CellCoord> = {};
  const centerGoals: Record<number, CellCoord> = {};

  // Standard radial step along the arm
  const radialSteps = 5;
  const rMin = R_center + 24 * scale;
  const rMax = R_tip - 30 * scale;
  const dr = (rMax - rMin) / (radialSteps - 1);

  for (let k = 0; k < armCount; k++) {
    // Centerline angle for arm k (arm 0 points UP)
    const angle = (2 * Math.PI * k) / armCount - Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Coordinate transformation from arm local (u: radial, v: tangential) to world (x, y)
    const toWorld = (u: number, v: number): Point => ({
      x: Math.round((cx + u * cosA - v * sinA) * 10) / 10,
      y: Math.round((cy + u * sinA + v * cosA) * 10) / 10,
    });

    const makeQuad = (u: number, v: number, du: number, dv: number): Point[] => [
      toWorld(u - du / 2, v - dv / 2),
      toWorld(u + du / 2, v - dv / 2),
      toWorld(u + du / 2, v + dv / 2),
      toWorld(u - du / 2, v + dv / 2),
    ];

    // ---------------------------------------------------------
    // 1. 13 Track Cells for Arm k
    // ---------------------------------------------------------
    // Cells 0..4: Outward lane (v = -W)
    // Cells 5..7: Outer tip turn
    // Cells 8..12: Inward lane (v = +W)
    const armTrackCells: CellCoord[] = [];

    // Local coordinates (u, v) for the 13 cells
    const localCoords: { u: number; v: number; du: number; dv: number }[] = [
      // 0: Outward lane start (near center corner)
      { u: rMin, v: -W, du: dr * 0.94, dv: W * 0.94 },
      // 1: START CELL (at offset 1)
      { u: rMin + dr, v: -W, du: dr * 0.94, dv: W * 0.94 },
      // 2: Outward
      { u: rMin + 2 * dr, v: -W, du: dr * 0.94, dv: W * 0.94 },
      // 3: Outward
      { u: rMin + 3 * dr, v: -W, du: dr * 0.94, dv: W * 0.94 },
      // 4: Outward lane tip
      { u: rMax, v: -W, du: dr * 0.94, dv: W * 0.94 },
      // 5: Tip outer corner left
      { u: R_tip, v: -W * 0.6, du: 24 * scale, dv: W * 0.8 },
      // 6: Outer tip center
      { u: R_tip + 10 * scale, v: 0, du: 24 * scale, dv: W * 0.9 },
      // 7: Tip outer corner right
      { u: R_tip, v: W * 0.6, du: 24 * scale, dv: W * 0.8 },
      // 8: Inward lane start
      { u: rMax, v: W, du: dr * 0.94, dv: W * 0.94 },
      // 9: STAR CELL (at offset 9)
      { u: rMin + 3 * dr, v: W, du: dr * 0.94, dv: W * 0.94 },
      // 10: Inward
      { u: rMin + 2 * dr, v: W, du: dr * 0.94, dv: W * 0.94 },
      // 11: Inward
      { u: rMin + dr, v: W, du: dr * 0.94, dv: W * 0.94 },
      // 12: Inward lane end / corner to next arm
      { u: rMin, v: W, du: dr * 0.94, dv: W * 0.94 },
    ];

    for (let offset = 0; offset < LUDO_BOARD_CONFIG.CELLS_PER_ARM; offset++) {
      const ringIndex = k * LUDO_BOARD_CONFIG.CELLS_PER_ARM + offset;
      const coord = localCoords[offset];
      const pt = toWorld(coord.u, coord.v);
      const isStart = offset === LUDO_BOARD_CONFIG.START_CELL_OFFSET;
      const isStar = offset === LUDO_BOARD_CONFIG.STAR_CELL_OFFSET;
      const isSafe = isStart || isStar;
      const tilePolygon = makeQuad(coord.u, coord.v, coord.du, coord.dv);

      const cell: CellCoord = {
        id: `track_${ringIndex}`,
        point: pt,
        radius: cellRadius,
        type: "track",
        armIndex: k,
        ringIndex,
        isSafe,
        isStart,
        isStar,
        tilePolygon,
      };

      armTrackCells.push(cell);
      trackCellsByRingIndex[ringIndex] = cell;
    }

    // ---------------------------------------------------------
    // 2. Home Column (5 cells) leading into Center Goal
    // ---------------------------------------------------------
    const armHomeColCells: CellCoord[] = [];
    for (let h = 0; h < LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH; h++) {
      // h=0 is outer (entrance), h=4 is inner (near goal)
      const uHome = rMax - h * ((rMax - rMin) / 4);
      const pt = toWorld(uHome, 0);
      const tilePolygon = makeQuad(uHome, 0, dr * 0.94, W * 0.94);

      const cell: CellCoord = {
        id: `home_col_${k}_${h}`,
        point: pt,
        radius: cellRadius,
        type: "home_column",
        armIndex: k,
        homeColIndex: h,
        isSafe: true,
        tilePolygon,
      };

      armHomeColCells.push(cell);
      homeColumnCells[`${k}_${h}`] = cell;
    }

    // Center Goal Point
    const goalPt = toWorld(R_center * 0.45, 0);
    const centerGoalCell: CellCoord = {
      id: `center_${k}`,
      point: goalPt,
      radius: cellRadius * 1.3,
      type: "center",
      armIndex: k,
      isSafe: true,
    };
    centerGoals[k] = centerGoalCell;

    // Center Wedge Polygon for Arm k
    const halfSectorAngle = Math.PI / armCount;
    const wedgeP1 = { x: cx, y: cy };
    const wedgeP2 = {
      x: Math.round((cx + R_center * Math.cos(angle - halfSectorAngle)) * 10) / 10,
      y: Math.round((cy + R_center * Math.sin(angle - halfSectorAngle)) * 10) / 10,
    };
    const wedgeP3 = {
      x: Math.round((cx + R_center * Math.cos(angle + halfSectorAngle)) * 10) / 10,
      y: Math.round((cy + R_center * Math.sin(angle + halfSectorAngle)) * 10) / 10,
    };

    // Arm Track Outer Boundary Polygon (solid backing strip of the arm)
    const armTrackPolygon = [
      toWorld(rMin - dr * 0.5, -W * 1.55),
      toWorld(R_tip + 18 * scale, -W * 1.55),
      toWorld(R_tip + 26 * scale, 0),
      toWorld(R_tip + 18 * scale, W * 1.55),
      toWorld(rMin - dr * 0.5, W * 1.55),
    ];

    // ---------------------------------------------------------
    // 3. Yard (Base) Area with 4 Token Slots
    // ---------------------------------------------------------
    // Placed prominently in the quadrant between arms (near arm k's start cell)
    const bisectorAngle = angle - Math.PI / armCount;
    const yardDist = R_tip * 0.68;
    const yardCenter: Point = {
      x: Math.round((cx + yardDist * Math.cos(bisectorAngle)) * 10) / 10,
      y: Math.round((cy + yardDist * Math.sin(bisectorAngle)) * 10) / 10,
    };
    const yardBoxSize = (armCount <= 4 ? 165 : armCount === 5 ? 145 : 130) * scale;
    const slotOffset = (armCount <= 4 ? 28 : armCount === 5 ? 24 : 20) * scale;

    const yardTokenSlots: Point[] = [
      { x: Math.round((yardCenter.x - slotOffset) * 10) / 10, y: Math.round((yardCenter.y - slotOffset) * 10) / 10 },
      { x: Math.round((yardCenter.x + slotOffset) * 10) / 10, y: Math.round((yardCenter.y - slotOffset) * 10) / 10 },
      { x: Math.round((yardCenter.x - slotOffset) * 10) / 10, y: Math.round((yardCenter.y + slotOffset) * 10) / 10 },
      { x: Math.round((yardCenter.x + slotOffset) * 10) / 10, y: Math.round((yardCenter.y + slotOffset) * 10) / 10 },
    ];

    yardTokenSlots.forEach((pt, sIdx) => {
      yardSlots[`${k}_${sIdx}`] = {
        id: `yard_${k}_${sIdx}`,
        point: pt,
        radius: cellRadius * 1.1,
        type: "yard",
        armIndex: k,
        yardSlotIndex: sIdx,
        isSafe: true,
      };
    });

    arms.push({
      armIndex: k,
      angleRad: angle,
      trackCells: armTrackCells,
      homeColumnCells: armHomeColCells,
      yard: {
        armIndex: k,
        center: yardCenter,
        boxWidth: yardBoxSize,
        boxHeight: yardBoxSize,
        tokenSlots: yardTokenSlots,
      },
      centerWedge: [wedgeP1, wedgeP2, wedgeP3],
      centerGoalPoint: goalPt,
      armTrackPolygon,
    });
  }

  return {
    armCount,
    viewBox,
    center: { x: cx, y: cy },
    arms,
    trackCellsByRingIndex,
    homeColumnCells,
    yardSlots,
    centerGoals,
  };
}
