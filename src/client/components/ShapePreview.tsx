import React from "react";
import { generateBoardGeometry } from "../../games/ludo/geometry";
import { getArmCountForPlayerCount, LUDO_COLORS, LUDO_ICONS } from "../../games/ludo/config";
import { Player } from "../../games/types";

interface ShapePreviewProps {
  playerCount: number;
  players: Player[];
}

export const ShapePreview: React.FC<ShapePreviewProps> = ({ playerCount, players }) => {
  const count = Math.max(2, Math.min(7, playerCount));
  const armCount = getArmCountForPlayerCount(count);
  const geo = generateBoardGeometry(armCount);

  // Map of armIndex to player
  const playerByArm = new Map<number, Player>();
  players.forEach((p) => {
    const armIdx = count === 2 ? (p.seatIndex === 0 ? 0 : 2) : p.seatIndex;
    playerByArm.set(armIdx, p);
  });

  const shapeNames: Record<number, string> = {
    3: "Triangle (3 arms)",
    4: count === 2 ? "Square (2 opposite seats)" : "Square (4 arms)",
    5: "Pentagon (5 arms)",
    6: "Hexagon (6 arms)",
    7: "Heptagon (7 arms)",
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-3xl ludo-card w-full">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
        Procedural Board Shape
      </div>
      <div className="text-sm font-black text-amber-300 mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {shapeNames[armCount]}
      </div>

      <div className="w-56 h-56 sm:w-64 sm:h-64 relative">
        <svg viewBox={geo.viewBox} className="w-full h-full drop-shadow-2xl">
          {/* Frame & Board Surface */}
          {armCount === 4 ? (
            <g>
              <rect x="20" y="20" width="960" height="960" rx="36" fill="#2c1810" stroke="#1a0c06" strokeWidth="6" />
              <rect x="32" y="32" width="936" height="936" rx="26" fill="#FAF6EE" stroke="#c4b59d" strokeWidth="2" />
            </g>
          ) : (
            <g>
              <circle cx="500" cy="500" r="480" fill="#2c1810" stroke="#1a0c06" strokeWidth="6" />
              <circle cx="500" cy="500" r="462" fill="#FAF6EE" stroke="#c4b59d" strokeWidth="2" />
            </g>
          )}

          {/* Solid Arm Tracks */}
          {geo.arms.map((arm) => {
            const pts = arm.armTrackPolygon.map(p => `${p.x},${p.y}`).join(" ");
            return (
              <polygon
                key={`preview_arm_back_${arm.armIndex}`}
                points={pts}
                fill="#FFFFFF"
                stroke="#cbd5e1"
                strokeWidth="2"
              />
            );
          })}

          {/* Center Goal Wedges */}
          {geo.arms.map((arm) => {
            const player = playerByArm.get(arm.armIndex);
            const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
            const fillColor = colorDef ? colorDef.primary : "#94a3b8";
            const pts = arm.centerWedge.map(p => `${p.x},${p.y}`).join(" ");
            return (
              <polygon
                key={`preview_wedge_${arm.armIndex}`}
                points={pts}
                fill={fillColor}
                opacity={player ? 1 : 0.35}
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
            );
          })}

          {/* Center Star Hub */}
          <circle cx="500" cy="500" r="26" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
          <text x="500" y="506" textAnchor="middle" fill="#92400E" fontSize="16" fontWeight="bold">★</text>

          {/* Arm tracks and yards */}
          {geo.arms.map((arm) => {
            const player = playerByArm.get(arm.armIndex);
            const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
            const primaryColor = colorDef ? colorDef.primary : "#94a3b8";
            const borderColor = colorDef ? colorDef.border : "#64748b";
            const iconDef = player ? LUDO_ICONS.find(i => i.id === player.iconId) : undefined;

            const bw = arm.yard.boxWidth;
            const bh = arm.yard.boxHeight;
            const x0 = arm.yard.center.x - bw / 2;
            const y0 = arm.yard.center.y - bh / 2;

            return (
              <g key={`preview_arm_${arm.armIndex}`}>
                {/* Yard Base */}
                <rect
                  x={x0}
                  y={y0}
                  width={bw}
                  height={bh}
                  rx="20"
                  fill={player ? primaryColor : "#94a3b8"}
                  opacity={player ? 1 : 0.3}
                  stroke={player ? borderColor : "#475569"}
                  strokeWidth="2.5"
                />

                {/* Inner white box */}
                <rect
                  x={x0 + bw * 0.12}
                  y={y0 + bh * 0.12}
                  width={bw * 0.76}
                  height={bh * 0.76}
                  rx="14"
                  fill="#FFFFFF"
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="1"
                />

                {/* 4 Token Spots */}
                {arm.yard.tokenSlots.map((pt, sIdx) => (
                  <circle
                    key={`preview_nest_${arm.armIndex}_${sIdx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="15"
                    fill={player ? primaryColor : "#cbd5e1"}
                    opacity={player ? 0.85 : 0.4}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                ))}

                {/* Yard Center Icon (only when player seated) */}
                {player && (
                  <g>
                    <circle cx={arm.yard.center.x} cy={arm.yard.center.y} r="14" fill={primaryColor} />
                    <text
                      x={arm.yard.center.x}
                      y={arm.yard.center.y + 5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="13"
                      fontWeight="bold"
                    >
                      {iconDef ? iconDef.emoji : "♟️"}
                    </text>
                  </g>
                )}

                {/* Track Cells */}
                {arm.trackCells.map((cell) => {
                  let fill = "#FFFFFF";
                  let stroke = "#94a3b8";
                  let strokeWidth = 1.2;

                  if (cell.isStart) {
                    fill = player ? primaryColor : "#94a3b8";
                    stroke = player ? borderColor : "#64748b";
                    strokeWidth = 2;
                  } else if (cell.isStar) {
                    fill = "#FEF3C7";
                    stroke = "#D97706";
                    strokeWidth = 1.8;
                  }

                  return (
                    <circle
                      key={`preview_track_${cell.id}`}
                      cx={cell.point.x}
                      cy={cell.point.y}
                      r={cell.radius * 0.85}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                  );
                })}

                {/* Home Column cells */}
                {arm.homeColumnCells.map((hCell) => (
                  <circle
                    key={`preview_home_${hCell.id}`}
                    cx={hCell.point.x}
                    cy={hCell.point.y}
                    r={hCell.radius * 0.85}
                    fill={player ? primaryColor : "#94a3b8"}
                    opacity={player ? 0.95 : 0.3}
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-[11px] text-slate-400 mt-2 font-medium">
        {count} players joined • Adaptively scaled
      </div>
    </div>
  );
};
