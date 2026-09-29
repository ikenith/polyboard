import React, { useMemo, useState, useEffect, useRef } from "react";
import { generateBoardGeometry, Point, BoardGeometry } from "../../games/ludo/geometry";
import { LUDO_COLORS, LUDO_ICONS, LUDO_BOARD_CONFIG } from "../../games/ludo/config";
import { LudoState, LudoToken } from "../../games/ludo/types";
import { LegalAction } from "../../games/types";
import { sound } from "../utils/audio";

interface BoardRendererProps {
  gameState: LudoState;
  myPlayerId: string | null;
  legalActions: LegalAction[];
  onMoveToken: (tokenId: number) => void;
}

/**
 * Computes the sequential cell coordinates traversed when a token moves from prevLoc to currLoc.
 */
export function computePathPoints(
  armIndex: number,
  armCount: number,
  prevLoc: LudoToken["location"],
  currLoc: LudoToken["location"],
  geo: BoardGeometry
): Point[] {
  const totalRingCells = armCount * LUDO_BOARD_CONFIG.CELLS_PER_ARM;
  const startRing = armIndex * LUDO_BOARD_CONFIG.CELLS_PER_ARM;
  const homeEntranceRing = startRing;

  const points: Point[] = [];

  // Yard -> Track start
  if (prevLoc.type === "yard" && currLoc.type === "track") {
    const startCell = geo.trackCellsByRingIndex[currLoc.ringIndex];
    if (startCell) {
      points.push(startCell.point);
    }
    return points;
  }

  // Track -> Track
  if (prevLoc.type === "track" && currLoc.type === "track") {
    let r = prevLoc.ringIndex;
    const target = currLoc.ringIndex;
    let guard = 0;
    while (r !== target && guard < 10) {
      r = (r + 1) % totalRingCells;
      const cell = geo.trackCellsByRingIndex[r];
      if (cell) points.push(cell.point);
      guard++;
    }
    return points;
  }

  // Track -> Home Column
  if (prevLoc.type === "track" && currLoc.type === "home_column") {
    let r = prevLoc.ringIndex;
    let guard = 0;
    while (r !== homeEntranceRing && guard < 15) {
      r = (r + 1) % totalRingCells;
      const cell = geo.trackCellsByRingIndex[r];
      if (cell) points.push(cell.point);
      guard++;
    }
    for (let c = 0; c <= currLoc.index; c++) {
      const hCell = geo.homeColumnCells[`${armIndex}_${c}`];
      if (hCell) points.push(hCell.point);
    }
    return points;
  }

  // Track -> Home (Goal)
  if (prevLoc.type === "track" && currLoc.type === "home") {
    let r = prevLoc.ringIndex;
    let guard = 0;
    while (r !== homeEntranceRing && guard < 15) {
      r = (r + 1) % totalRingCells;
      const cell = geo.trackCellsByRingIndex[r];
      if (cell) points.push(cell.point);
      guard++;
    }
    for (let c = 0; c < LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH; c++) {
      const hCell = geo.homeColumnCells[`${armIndex}_${c}`];
      if (hCell) points.push(hCell.point);
    }
    const goal = geo.centerGoals[armIndex];
    if (goal) points.push(goal.point);
    return points;
  }

  // Home Column -> Home Column
  if (prevLoc.type === "home_column" && currLoc.type === "home_column") {
    for (let c = prevLoc.index + 1; c <= currLoc.index; c++) {
      const hCell = geo.homeColumnCells[`${armIndex}_${c}`];
      if (hCell) points.push(hCell.point);
    }
    return points;
  }

  // Home Column -> Home (Goal)
  if (prevLoc.type === "home_column" && currLoc.type === "home") {
    for (let c = prevLoc.index + 1; c < LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH; c++) {
      const hCell = geo.homeColumnCells[`${armIndex}_${c}`];
      if (hCell) points.push(hCell.point);
    }
    const goal = geo.centerGoals[armIndex];
    if (goal) points.push(goal.point);
    return points;
  }

  return points;
}

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  gameState,
  myPlayerId,
  legalActions,
  onMoveToken,
}) => {
  const armCount = gameState.armCount;
  const geo = useMemo(() => generateBoardGeometry(armCount), [armCount]);

  // Track cell-by-cell stepping animation coordinates
  const [animatingPositions, setAnimatingPositions] = useState<Record<string, Point>>({});
  const prevTokensRef = useRef<Record<string, { location: LudoToken["location"]; armIndex: number }>>({});
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const initialMap: Record<string, { location: LudoToken["location"]; armIndex: number }> = {};
      gameState.players.forEach(p => {
        p.tokens.forEach(t => {
          initialMap[`${p.id}_${t.id}`] = { location: t.location, armIndex: p.armIndex };
        });
      });
      prevTokensRef.current = initialMap;
      return;
    }

    const prevMap = prevTokensRef.current;
    const nextMap: Record<string, { location: LudoToken["location"]; armIndex: number }> = {};
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];

    gameState.players.forEach(p => {
      p.tokens.forEach(t => {
        const key = `${p.id}_${t.id}`;
        nextMap[key] = { location: t.location, armIndex: p.armIndex };

        const prev = prevMap[key];
        if (prev) {
          const locChanged = JSON.stringify(prev.location) !== JSON.stringify(t.location);
          if (locChanged) {
            const pathPoints = computePathPoints(p.armIndex, armCount, prev.location, t.location, geo);
            if (pathPoints.length > 0) {
              const stepDuration = 80;
              pathPoints.forEach((pt, stepIdx) => {
                const timer = setTimeout(() => {
                  sound.playStep();
                  setAnimatingPositions(curr => ({
                    ...curr,
                    [key]: pt
                  }));

                  if (stepIdx === pathPoints.length - 1) {
                    if (t.location.type === "home") {
                      sound.playHome();
                    }
                    setTimeout(() => {
                      setAnimatingPositions(curr => {
                        const copy = { ...curr };
                        delete copy[key];
                        return copy;
                      });
                    }, stepDuration);
                  }
                }, stepIdx * stepDuration);
                activeTimeouts.push(timer);
              });
            }
          }
        }
      });
    });

    prevTokensRef.current = nextMap;

    return () => {
      activeTimeouts.forEach(clearTimeout);
    };
  }, [gameState, geo, armCount]);

  // Extract legal token IDs
  const legalMoveTokenIds = useMemo(() => {
    return new Set(
      legalActions
        .filter(a => a.type === "move" && a.tokenId !== undefined)
        .map(a => a.tokenId!)
    );
  }, [legalActions]);

  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const canMove = isMyTurn && !gameState.canRoll && gameState.currentDiceRoll !== null;

  const playerByArm = useMemo(() => {
    const map = new Map<number, typeof gameState.players[0]>();
    gameState.players.forEach(p => map.set(p.armIndex, p));
    return map;
  }, [gameState.players]);

  // Collect all tokens with screen coordinates
  const tokensToRender = useMemo(() => {
    const cellGroups = new Map<string, { token: LudoToken; armIndex: number; basePoint: Point }[]>();

    gameState.players.forEach(p => {
      p.tokens.forEach(t => {
        let basePoint: Point | null = null;
        let cellKey = "";

        if (t.location.type === "yard") {
          const slot = geo.yardSlots[`${p.armIndex}_${t.id}`];
          if (slot) {
            basePoint = slot.point;
            cellKey = `yard_${p.armIndex}_${t.id}`;
          }
        } else if (t.location.type === "track") {
          const trackCell = geo.trackCellsByRingIndex[t.location.ringIndex];
          if (trackCell) {
            basePoint = trackCell.point;
            cellKey = `track_${t.location.ringIndex}`;
          }
        } else if (t.location.type === "home_column") {
          const hCell = geo.homeColumnCells[`${p.armIndex}_${t.location.index}`];
          if (hCell) {
            basePoint = hCell.point;
            cellKey = `home_${p.armIndex}_${t.location.index}`;
          }
        } else if (t.location.type === "home") {
          const goal = geo.centerGoals[p.armIndex];
          if (goal) {
            basePoint = goal.point;
            cellKey = `goal_${p.armIndex}_${t.id}`;
          }
        }

        if (basePoint) {
          if (!cellGroups.has(cellKey)) {
            cellGroups.set(cellKey, []);
          }
          cellGroups.get(cellKey)!.push({ token: t, armIndex: p.armIndex, basePoint });
        }
      });
    });

    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    const myTokensHome = myPlayer ? myPlayer.tokens.filter(t => t.location.type === "home").length : 0;
    const controllingPartner = !!gameState.settings.teamsEnabled && myTokensHome === LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER;
    const activeOwnerId = controllingPartner ? myPlayer?.partnerPlayerId : myPlayerId;

    const result: {
      token: LudoToken;
      player: typeof gameState.players[0];
      point: Point;
      isMovable: boolean;
    }[] = [];

    cellGroups.forEach((group) => {
      const count = group.length;
      group.forEach((item, idx) => {
        const player = gameState.players.find(p => p.id === item.token.ownerId)!;

        let x = item.basePoint.x;
        let y = item.basePoint.y;

        if (count > 1 && !item.token.location.type.includes("yard")) {
          const offsetAngle = (2 * Math.PI * idx) / count;
          const offsetDist = Math.min(9, 13 / Math.sqrt(count));
          x += Math.cos(offsetAngle) * offsetDist;
          y += Math.sin(offsetAngle) * offsetDist;
        }

        const isMovable = canMove &&
          item.token.location.type !== "home" &&
          player.id === activeOwnerId &&
          legalMoveTokenIds.has(item.token.id);

        const animPoint = animatingPositions[`${player.id}_${item.token.id}`];
        const finalPoint = animPoint || { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };

        result.push({
          token: item.token,
          player,
          point: finalPoint,
          isMovable,
        });
      });
    });

    return result;
  }, [gameState, geo, canMove, myPlayerId, legalMoveTokenIds, animatingPositions]);

  return (
    <div className="relative w-full max-w-[460px] sm:max-w-[480px] max-h-[48vh] sm:max-h-[52vh] aspect-square flex items-center justify-center select-none touch-none mx-auto">
      <svg
        viewBox={geo.viewBox}
        className="w-full h-full overflow-visible"
        style={{ filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.85))" }}
      >
        <defs>
          {/* Board Outer Wooden Frame */}
          <linearGradient id="woodBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a2810" />
            <stop offset="50%" stopColor="#2e1708" />
            <stop offset="100%" stopColor="#1a0c04" />
          </linearGradient>

          {/* Board Playing Surface: Cream Parchment */}
          <radialGradient id="boardSurfaceGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#fffdf8" />
            <stop offset="70%" stopColor="#f8f3e8" />
            <stop offset="100%" stopColor="#ede3d0" />
          </radialGradient>

          {/* Track Arm Backing */}
          <linearGradient id="armTrackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f7f3ea" />
          </linearGradient>

          {/* Token Spherical Dome Gradient */}
          <radialGradient id="pawnDomeHighlight" cx="30%" cy="25%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="85%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Movable token golden pulse */}
          <filter id="goldenPawnGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1.2 0.8 0 0 0.15  0.8 0.7 0 0 0.08  0 0.1 0 0 0  0 0 0 2 0"
              result="goldGlow"
            />
            <feMerge>
              <feMergeNode in="goldGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Yard active turn glow */}
          <filter id="yardTurnGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Star tile glow */}
          <filter id="starTileGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Dynamic Player Gradients */}
          {geo.arms.map((arm) => {
            const player = playerByArm.get(arm.armIndex);
            const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
            const pc = colorDef?.primary || "#64748b";
            const sc = colorDef?.secondary || "#94a3b8";
            const bc = colorDef?.border || pc;

            return (
              <React.Fragment key={`grads_${arm.armIndex}`}>
                {/* Yard Base Gradient */}
                <radialGradient id={`yardBaseGrad_${arm.armIndex}`} cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor={sc} stopOpacity="0.9" />
                  <stop offset="60%" stopColor={pc} />
                  <stop offset="100%" stopColor={bc} />
                </radialGradient>

                {/* Pawn 3D Body Gradient */}
                <radialGradient id={`pawnBodyGrad_${arm.armIndex}`} cx="32%" cy="28%" r="75%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                  <stop offset="25%" stopColor={pc} />
                  <stop offset="80%" stopColor={bc} />
                  <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.8" />
                </radialGradient>
              </React.Fragment>
            );
          })}
        </defs>

        {/* ========================================================= */}
        {/* 1. TABLE TOP & WOODEN FRAME                               */}
        {/* ========================================================= */}
        {armCount === 4 ? (
          // Classic Square Board for 4 players (and 2 players)
          <g id="board_frame_square">
            {/* Outer shadow */}
            <rect x="8" y="8" width="984" height="984" rx="42" fill="rgba(0,0,0,0.6)" />
            {/* Dark Mahogany Border */}
            <rect x="12" y="12" width="976" height="976" rx="38" fill="url(#woodBorderGrad)" stroke="#150a04" strokeWidth="6" />
            {/* Gold Pin-Stripe Inlay */}
            <rect x="24" y="24" width="952" height="952" rx="30" fill="none" stroke="#D4AF37" strokeWidth="2.5" opacity="0.65" />
            {/* Playing Field Surface */}
            <rect x="30" y="30" width="940" height="940" rx="26" fill="url(#boardSurfaceGrad)" stroke="#c4b59d" strokeWidth="2" />
            {/* Corner Brass Rivets */}
            {[[42, 42], [958, 42], [42, 958], [958, 958]].map(([bx, by], idx) => (
              <circle key={idx} cx={bx} cy={by} r="5" fill="#D4AF37" stroke="#8c7322" strokeWidth="1" />
            ))}
          </g>
        ) : (
          // Regular Polygon Frame for 3, 5, 6, 7 players
          <g id="board_frame_poly">
            <circle cx="500" cy="500" r="495" fill="rgba(0,0,0,0.6)" />
            <circle cx="500" cy="500" r="488" fill="url(#woodBorderGrad)" stroke="#150a04" strokeWidth="6" />
            <circle cx="500" cy="500" r="476" fill="none" stroke="#D4AF37" strokeWidth="2.5" opacity="0.65" />
            <circle cx="500" cy="500" r="470" fill="url(#boardSurfaceGrad)" stroke="#c4b59d" strokeWidth="2" />
          </g>
        )}

        {/* ========================================================= */}
        {/* 2. SOLID ARM TRACK BACKINGS                               */}
        {/* ========================================================= */}
        {geo.arms.map((arm) => {
          const pts = arm.armTrackPolygon.map(p => `${p.x},${p.y}`).join(" ");
          return (
            <g key={`arm_back_${arm.armIndex}`}>
              <polygon
                points={pts}
                fill="url(#armTrackGrad)"
                stroke="#cbd5e1"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* ========================================================= */}
        {/* 3. CENTER HOME WEDGES (Vivid Authentic Colors)            */}
        {/* ========================================================= */}
        {geo.arms.map((arm) => {
          const player = playerByArm.get(arm.armIndex);
          const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
          const fillColor = colorDef ? colorDef.primary : "#94a3b8";
          const borderColor = colorDef ? colorDef.border : "#64748b";
          const pts = arm.centerWedge.map(p => `${p.x},${p.y}`).join(" ");

          return (
            <g key={`center_wedge_${arm.armIndex}`}>
              <polygon
                points={pts}
                fill={fillColor}
                opacity={player ? 1 : 0.35}
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Glossy radial overlay on wedge */}
              <polygon
                points={pts}
                fill="url(#pawnDomeHighlight)"
                opacity="0.2"
              />
            </g>
          );
        })}

        {/* Center Golden Medallion */}
        <g id="center_medallion">
          <circle cx="500" cy="500" r="32" fill="rgba(0,0,0,0.35)" transform="translate(1, 2)" />
          <circle cx="500" cy="500" r="30" fill="#B8860B" stroke="#DAA520" strokeWidth="2" />
          <circle cx="500" cy="500" r="26" fill="#FFD700" />
          <circle cx="500" cy="500" r="22" fill="#FFFBEB" stroke="#DAA520" strokeWidth="1.5" />
          <text
            x="500"
            y="506"
            textAnchor="middle"
            fill="#B45309"
            fontSize="18"
            fontWeight="900"
            style={{ userSelect: "none" }}
          >
            ★
          </text>
        </g>

        {/* ========================================================= */}
        {/* 4. ARM TILES: Track & Home Column                         */}
        {/* ========================================================= */}
        {geo.arms.map((arm) => {
          const player = playerByArm.get(arm.armIndex);
          const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
          const primaryColor = colorDef ? colorDef.primary : "#64748b";
          const borderColor = colorDef ? colorDef.border : "#475569";

          return (
            <g key={`arm_tiles_${arm.armIndex}`}>
              {/* Track Cells */}
              {arm.trackCells.map((cell) => {
                const pts = cell.tilePolygon ? cell.tilePolygon.map(p => `${p.x},${p.y}`).join(" ") : null;
                const isStart = cell.isStart;
                const isStar = cell.isStar;

                let fill = "#ffffff";
                let stroke = "#94a3b8";
                let strokeWidth = 1.5;

                if (isStart) {
                  fill = player ? primaryColor : "#94a3b8";
                  stroke = player ? borderColor : "#64748b";
                  strokeWidth = 2.5;
                } else if (isStar) {
                  fill = "#FEF3C7";
                  stroke = "#D97706";
                  strokeWidth = 2;
                }

                return (
                  <g key={`track_${cell.id}`}>
                    {pts ? (
                      <polygon
                        points={pts}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        filter={isStar ? "url(#starTileGlow)" : undefined}
                      />
                    ) : (
                      <circle
                        cx={cell.point.x}
                        cy={cell.point.y}
                        r={cell.radius}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                      />
                    )}

                    {/* Start Cell Arrow */}
                    {isStart && (
                      <text
                        x={cell.point.x}
                        y={cell.point.y + 5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="900"
                        style={{ userSelect: "none" }}
                      >
                        ▶
                      </text>
                    )}

                    {/* Star Safe Cell Star */}
                    {isStar && (
                      <text
                        x={cell.point.x}
                        y={cell.point.y + 6}
                        textAnchor="middle"
                        fill="#D97706"
                        fontSize="16"
                        fontWeight="bold"
                        style={{ userSelect: "none" }}
                      >
                        ★
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Home Column (5 colored tiles) */}
              {arm.homeColumnCells.map((hCell, hIdx) => {
                const pts = hCell.tilePolygon ? hCell.tilePolygon.map(p => `${p.x},${p.y}`).join(" ") : null;

                return (
                  <g key={`home_col_${hCell.id}`}>
                    {pts ? (
                      <polygon
                        points={pts}
                        fill={player ? primaryColor : "#94a3b8"}
                        opacity={player ? 0.95 : 0.3}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                    ) : (
                      <circle
                        cx={hCell.point.x}
                        cy={hCell.point.y}
                        r={hCell.radius}
                        fill={player ? primaryColor : "#94a3b8"}
                        opacity={player ? 0.95 : 0.3}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                      />
                    )}

                    {/* Inward Chevron Indicator */}
                    <text
                      x={hCell.point.x}
                      y={hCell.point.y + 4.5}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.85)"
                      fontSize="11"
                      fontWeight="bold"
                      style={{ userSelect: "none" }}
                    >
                      ▲
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ========================================================= */}
        {/* 5. YARDS / BASES (Large, Authentic Ludo Corners)          */}
        {/* ========================================================= */}
        {geo.arms.map((arm) => {
          const player = playerByArm.get(arm.armIndex);
          const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
          const primaryColor = colorDef ? colorDef.primary : "#64748b";
          const borderColor = colorDef ? colorDef.border : "#475569";
          const iconDef = player ? LUDO_ICONS.find(i => i.id === player.iconId) : undefined;
          const isTurnArm = player?.id === gameState.currentTurnPlayerId;

          const bw = arm.yard.boxWidth;
          const bh = arm.yard.boxHeight;
          const x0 = arm.yard.center.x - bw / 2;
          const y0 = arm.yard.center.y - bh / 2;

          return (
            <g key={`yard_base_${arm.armIndex}`}>
              {/* Yard Drop Shadow */}
              <rect
                x={x0 + 3}
                y={y0 + 5}
                width={bw}
                height={bh}
                rx="24"
                fill="rgba(0,0,0,0.3)"
              />

              {/* Main Outer Colored Yard Base */}
              <rect
                x={x0}
                y={y0}
                width={bw}
                height={bh}
                rx="22"
                fill={player ? `url(#yardBaseGrad_${arm.armIndex})` : "#94a3b8"}
                opacity={player ? 1 : 0.3}
                stroke={isTurnArm ? "#FFD700" : borderColor}
                strokeWidth={isTurnArm ? 4.5 : 3}
                filter={isTurnArm ? "url(#yardTurnGlow)" : undefined}
              />

              {/* Inner White Parchment Box */}
              <rect
                x={x0 + bw * 0.12}
                y={y0 + bh * 0.12}
                width={bw * 0.76}
                height={bh * 0.76}
                rx="16"
                fill="#ffffff"
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1.5"
              />

              {/* Four Circular Token Nests */}
              {arm.yard.tokenSlots.map((pt, sIdx) => (
                <g key={`nest_${arm.armIndex}_${sIdx}`}>
                  {/* Recessed shadow */}
                  <circle cx={pt.x + 1} cy={pt.y + 1.5} r="21" fill="rgba(0,0,0,0.18)" />
                  {/* Outer colored ring */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="20"
                    fill={player ? primaryColor : "#cbd5e1"}
                    opacity={player ? 0.9 : 0.3}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  {/* Inner white recessed spot */}
                  <circle cx={pt.x} cy={pt.y} r="14" fill="#ffffff" opacity="0.9" />
                </g>
              ))}

              {/* Player Icon/Name in Yard Center (only when player seated) */}
              {player && (
                <g transform={`translate(${arm.yard.center.x}, ${arm.yard.center.y})`}>
                  <circle cx="0" cy="0" r="16" fill={primaryColor} opacity="0.95" stroke="#ffffff" strokeWidth="2" />
                  <text
                    x="0"
                    y="5.5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="15"
                    fontWeight="bold"
                    style={{ userSelect: "none" }}
                  >
                    {iconDef ? iconDef.emoji : "♟️"}
                  </text>
                </g>
              )}

              {/* Yard Label: Player Name */}
              {player && (
                <text
                  x={arm.yard.center.x}
                  y={y0 - 8}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize="13"
                  fontWeight="900"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    userSelect: "none",
                    textShadow: "0 1px 2px rgba(255,255,255,0.9)",
                  }}
                >
                  {player.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ========================================================= */}
        {/* 6. TOKENS LAYER (Authentic 3D Ludo Pawns)                 */}
        {/* ========================================================= */}
        {tokensToRender.map(({ token, player, point, isMovable }) => {
          const colorDef = LUDO_COLORS.find(c => c.id === player.colorId);
          const iconDef = LUDO_ICONS.find(i => i.id === player.iconId);
          const primaryColor = colorDef?.primary || "#ef4444";
          const borderColor = colorDef?.border || "#991b1b";
          const tokenKey = `token_${token.ownerId}_${token.id}`;

          return (
            <g
              key={tokenKey}
              onClick={() => {
                if (isMovable) {
                  onMoveToken(token.id);
                }
              }}
              style={{
                cursor: isMovable ? "pointer" : "default",
              }}
              className={isMovable ? "animate-pawn-float" : ""}
            >
              {/* Movable Golden Halo Ring & Sparkles */}
              {isMovable && (
                <g>
                  {/* Outer pulsating dashed ring */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="25"
                    fill="rgba(255, 215, 0, 0.22)"
                    stroke="#FFD700"
                    strokeWidth="3"
                    strokeDasharray="7 4"
                    className="animate-spin-slow"
                  />
                  {/* Downward bouncing hand/arrow indicator */}
                  <path
                    d={`M ${point.x} ${point.y - 32} L ${point.x - 7} ${point.y - 42} L ${point.x + 7} ${point.y - 42} Z`}
                    fill="#FFD700"
                    stroke="#B45309"
                    strokeWidth="1.5"
                    className="animate-bounce-subtle"
                  />
                </g>
              )}

              {/* Pawn Base Contact Drop Shadow */}
              <ellipse
                cx={point.x + 2}
                cy={point.y + 7}
                rx="15"
                ry="7"
                fill="rgba(0,0,0,0.55)"
              />

              {/* Pawn Bottom Skirt / Flange */}
              <ellipse
                cx={point.x}
                cy={point.y + 4}
                rx="14"
                ry="6.5"
                fill={borderColor}
                stroke="#ffffff"
                strokeWidth="1"
              />

              {/* Pawn Conical Waist */}
              <path
                d={`M ${point.x - 11} ${point.y + 3} Q ${point.x - 5} ${point.y - 5} ${point.x - 7} ${point.y - 8} L ${point.x + 7} ${point.y - 8} Q ${point.x + 5} ${point.y - 5} ${point.x + 11} ${point.y + 3} Z`}
                fill={primaryColor}
                stroke={borderColor}
                strokeWidth="1"
              />

              {/* Pawn Spherical Head Dome */}
              <circle
                cx={point.x}
                cy={point.y - 8}
                r="11"
                fill={`url(#pawnBodyGrad_${player.armIndex})`}
                stroke={isMovable ? "#FFD700" : "#ffffff"}
                strokeWidth={isMovable ? 2.5 : 1.5}
                filter={isMovable ? "url(#goldenPawnGlow)" : undefined}
              />

              {/* Specular 3D Gloss Highlight */}
              <circle
                cx={point.x - 3.5}
                cy={point.y - 11.5}
                r="4.5"
                fill="url(#pawnDomeHighlight)"
              />

              {/* Pawn Icon / Token Number */}
              <text
                x={point.x}
                y={point.y - 4.5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="9"
                fontWeight="900"
                pointerEvents="none"
                style={{
                  userSelect: "none",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {iconDef ? iconDef.emoji : String(token.id + 1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
