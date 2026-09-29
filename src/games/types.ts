export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  colorId: string;
  iconId: string;
  seatIndex: number;
  isHost: boolean;
  connected: boolean;
  partnerPlayerId?: string;
}

export interface RoomSettings {
  turnTimeSeconds: number;
  autoMoveSingle: boolean;
  blocksStopOpponents: boolean;
  teamsEnabled: boolean;
}

export interface LegalAction {
  type: "roll" | "move";
  tokenId?: number;
  description?: string;
}

export interface ApplyActionResult<TState> {
  newState: TState;
  logMessages?: string[];
  broadcast?: boolean;
}

export interface GameModule<TState, TConfig, TAction, TPublicState> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  init(players: Player[], config: TConfig): TState;
  getLegalActions(state: TState, playerId: PlayerId): LegalAction[];
  applyAction(state: TState, playerId: PlayerId, action: TAction, rng: () => number): ApplyActionResult<TState>;
  getPublicState(state: TState, forPlayerId?: PlayerId): TPublicState;
  onTimerExpired?(state: TState, rng: () => number): ApplyActionResult<TState>;
}
