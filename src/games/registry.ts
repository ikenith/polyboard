import { GameModule } from "./types";
import { ludoGameModule } from "./ludo";

// Registry of all playable games
// Adding a new game in the future ONLY requires registering it here!
const GAME_REGISTRY = new Map<string, GameModule<any, any, any, any>>([
  [ludoGameModule.id, ludoGameModule]
]);

export function getGameModule(gameId: string): GameModule<any, any, any, any> | undefined {
  return GAME_REGISTRY.get(gameId);
}

export function listAvailableGames(): { id: string; name: string; minPlayers: number; maxPlayers: number }[] {
  return Array.from(GAME_REGISTRY.values()).map(g => ({
    id: g.id,
    name: g.name,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers
  }));
}
