import { Player, RoomSettings } from "../games/types";

export interface PublicRoomState {
  code: string;
  gameId: string;
  hostPlayerId: string;
  status: "LOBBY" | "PLAYING" | "GAME_OVER";
  players: Player[];
  maxPlayers: number;
  settings: RoomSettings;
  partnerRequests: Record<string, string>; // requesterId -> targetId
  gameState: any | null; // e.g. LudoState
  turnDeadline: number | null; // Unix timestamp ms when turn expires
  logs: string[];
}

export type ClientMessage =
  | { type: "join"; name: string; sessionToken?: string }
  | { type: "pick_color"; colorId: string }
  | { type: "pick_icon"; iconId: string }
  | { type: "toggle_teams"; enabled: boolean }
  | { type: "request_partner"; targetPlayerId: string }
  | { type: "accept_partner"; requesterPlayerId: string }
  | { type: "randomize_teams" }
  | { type: "update_settings"; settings: Partial<RoomSettings> }
  | { type: "kick_player"; targetPlayerId: string }
  | { type: "start_game" }
  | { type: "roll" }
  | { type: "move"; tokenId: number }
  | { type: "play_again" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "welcome"; playerId: string; sessionToken: string; isHost: boolean }
  | { type: "state_update"; room: PublicRoomState }
  | { type: "error"; message: string }
  | { type: "notification"; message: string }
  | { type: "pong" };

export const MAX_MESSAGE_SIZE_BYTES = 4096;
export const RATE_LIMIT_WINDOW_MS = 1000;
export const MAX_MESSAGES_PER_WINDOW = 12;

export function generateRoomCode(): string {
  // 6 uppercase unambiguous alphanumeric characters (no 0/O, 1/I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
