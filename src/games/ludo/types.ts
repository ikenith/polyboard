import { PlayerId, RoomSettings } from "../types";

export type TokenLocation = 
  | { type: "yard" }
  | { type: "track"; ringIndex: number; distanceTraveled: number }
  | { type: "home_column"; index: number; distanceTraveled: number } // 0 to 4
  | { type: "home" }; // Center goal

export interface LudoToken {
  id: number; // 0, 1, 2, 3
  ownerId: PlayerId;
  location: TokenLocation;
}

export interface LudoPlayerState {
  id: PlayerId;
  name: string;
  colorId: string;
  iconId: string;
  seatIndex: number;
  armIndex: number;
  tokens: LudoToken[];
  rank?: number; // 1 for 1st place, etc.
  hasFinished: boolean;
  partnerPlayerId?: PlayerId;
  teamIndex?: number;
}

export type LudoPhase = 
  | "ROLLING_FOR_FIRST_TURN"
  | "PLAYING"
  | "GAME_OVER";

export interface LudoState {
  phase: LudoPhase;
  playerCount: number;
  armCount: number;
  totalRingCells: number; // 13 * armCount
  players: LudoPlayerState[];
  currentTurnPlayerId: string;
  currentDiceRoll: number | null;
  canRoll: boolean;
  consecutiveSixes: number;
  
  // First turn roll determination
  firstTurnRolls: Record<PlayerId, number | null>;
  firstTurnContenders: PlayerId[];
  firstTurnCurrentRollerIndex: number;

  rankings: PlayerId[]; // Players in order of finishing
  winningTeamIndex?: number;
  teamRankings?: number[]; // Team indices in order of finishing
  lastDiceRoll?: number | null;
  settings: RoomSettings;
  lastActionDescription?: string;
  turnCount: number;
}

export type LudoAction = 
  | { type: "roll" }
  | { type: "move"; tokenId: number };
