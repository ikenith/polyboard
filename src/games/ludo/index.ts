import { GameModule, RoomSettings } from "../types";
import { LudoState, LudoAction } from "./types";
import { 
  initLudoGame, 
  getLegalActions, 
  applyAction, 
  getLudoPublicState, 
  handleTimerExpired 
} from "./engine";

export * from "./types";
export * from "./config";
export * from "./engine";

export const ludoGameModule: GameModule<LudoState, RoomSettings, LudoAction, LudoState> = {
  id: "ludo",
  name: "Ludo",
  minPlayers: 2,
  maxPlayers: 7,
  init: initLudoGame,
  getLegalActions: getLegalActions,
  applyAction: applyAction,
  getPublicState: getLudoPublicState,
  onTimerExpired: handleTimerExpired
};
