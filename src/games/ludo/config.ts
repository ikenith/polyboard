export interface ColorDef {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  border: string;
  text: string;
}

export interface IconDef {
  id: string;
  name: string;
  emoji: string;
}

export const LUDO_COLORS: ColorDef[] = [
  { id: "red", name: "Crimson Red", primary: "#EF4444", secondary: "#FCA5A5", border: "#B91C1C", text: "#FFFFFF" },
  { id: "blue", name: "Cobalt Blue", primary: "#3B82F6", secondary: "#93C5FD", border: "#1D4ED8", text: "#FFFFFF" },
  { id: "green", name: "Emerald Green", primary: "#10B981", secondary: "#6EE7B7", border: "#047857", text: "#FFFFFF" },
  { id: "yellow", name: "Amber Gold", primary: "#F59E0B", secondary: "#FDE68A", border: "#B45309", text: "#1F2937" },
  { id: "purple", name: "Royal Purple", primary: "#8B5CF6", secondary: "#DDD6FE", border: "#6D28D9", text: "#FFFFFF" },
  { id: "orange", name: "Sunset Orange", primary: "#F97316", secondary: "#FDBA74", border: "#C2410C", text: "#FFFFFF" },
  { id: "teal", name: "Aqua Teal", primary: "#14B8A6", secondary: "#99F6E4", border: "#0F766E", text: "#FFFFFF" },
];

export const LUDO_ICONS: IconDef[] = [
  { id: "crown", name: "Crown", emoji: "👑" },
  { id: "dragon", name: "Dragon", emoji: "🐉" },
  { id: "lion", name: "Lion", emoji: "🦁" },
  { id: "eagle", name: "Eagle", emoji: "🦅" },
  { id: "shield", name: "Shield", emoji: "🛡️" },
  { id: "star", name: "Star", emoji: "⭐" },
  { id: "lightning", name: "Lightning", emoji: "⚡" },
];

export const LUDO_BOARD_CONFIG = {
  // Cells per polygon arm
  CELLS_PER_ARM: 13,
  // Start cell offset within arm (0-indexed: offset 1 is the 2nd cell)
  START_CELL_OFFSET: 1,
  // Star cell offset within arm (0-indexed: offset 9)
  STAR_CELL_OFFSET: 9,
  // Home column length leading up to center
  HOME_COLUMN_LENGTH: 5,
  // Tokens per player
  TOKENS_PER_PLAYER: 4,
  // Minimum and maximum dice values
  DICE_MIN: 1,
  DICE_MAX: 6,
  // Roll required to leave yard
  ROLL_TO_EXIT_BASE: 6,
  // Maximum consecutive sixes before turn forfeit
  CONSECUTIVE_SIXES_LIMIT: 3,
} as const;

export function getArmCountForPlayerCount(playerCount: number): number {
  if (playerCount <= 2) return 4; // 2 players play on a square board with opposite seats
  return playerCount;
}

export function getPlayerArmIndex(playerCount: number, seatIndex: number): number {
  if (playerCount === 2) {
    // Opposite seats: seat 0 -> arm 0, seat 1 -> arm 2
    return seatIndex === 0 ? 0 : 2;
  }
  return seatIndex;
}
