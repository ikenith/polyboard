import { Player, PlayerId, LegalAction, ApplyActionResult, RoomSettings } from "../types";
import { 
  LudoState, 
  LudoAction, 
  LudoPlayerState, 
  LudoToken, 
  TokenLocation 
} from "./types";
import { 
  LUDO_BOARD_CONFIG, 
  getArmCountForPlayerCount, 
  getPlayerArmIndex 
} from "./config";

/**
 * Returns the global ring cell index for the start cell of arm armIndex.
 */
export function getArmStartCell(armIndex: number, totalRingCells: number): number {
  return (armIndex * LUDO_BOARD_CONFIG.CELLS_PER_ARM + LUDO_BOARD_CONFIG.START_CELL_OFFSET) % totalRingCells;
}

/**
 * Returns the global ring cell index for the star cell of arm armIndex.
 */
export function getArmStarCell(armIndex: number, totalRingCells: number): number {
  return (armIndex * LUDO_BOARD_CONFIG.CELLS_PER_ARM + LUDO_BOARD_CONFIG.STAR_CELL_OFFSET) % totalRingCells;
}

/**
 * Checks whether a given global ring cell is a designated safe cell (any start cell or star cell).
 */
export function isSafeCell(ringIndex: number, armCount: number): boolean {
  const totalCells = armCount * LUDO_BOARD_CONFIG.CELLS_PER_ARM;
  for (let a = 0; a < armCount; a++) {
    if (ringIndex === getArmStartCell(a, totalCells)) return true;
    if (ringIndex === getArmStarCell(a, totalCells)) return true;
  }
  return false;
}

/**
 * Initializes a new Ludo game state.
 */
export function initLudoGame(players: Player[], settings: RoomSettings): LudoState {
  const playerCount = players.length;
  const armCount = getArmCountForPlayerCount(playerCount);
  const totalRingCells = armCount * LUDO_BOARD_CONFIG.CELLS_PER_ARM;

  const playerStates: LudoPlayerState[] = players.map((p) => {
    const armIndex = getPlayerArmIndex(playerCount, p.seatIndex);
    const tokens: LudoToken[] = [];
    for (let t = 0; t < LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER; t++) {
      tokens.push({
        id: t,
        ownerId: p.id,
        location: { type: "yard" }
      });
    }

    let teamIndex: number | undefined = undefined;
    let partnerPlayerId = p.partnerPlayerId;
    if (settings.teamsEnabled && playerCount >= 4 && playerCount % 2 === 0) {
      // In team mode, opposite seats share a team: seat i and seat (i + N/2) % N
      teamIndex = p.seatIndex % (playerCount / 2);
      if (!partnerPlayerId) {
        const partnerSeat = (p.seatIndex + playerCount / 2) % playerCount;
        const partnerPlayer = players.find(other => other.seatIndex === partnerSeat);
        if (partnerPlayer) {
          partnerPlayerId = partnerPlayer.id;
        }
      }
    }

    return {
      id: p.id,
      name: p.name,
      colorId: p.colorId,
      iconId: p.iconId,
      seatIndex: p.seatIndex,
      armIndex,
      tokens,
      hasFinished: false,
      partnerPlayerId,
      teamIndex
    };
  });

  // First turn: everyone rolls once, highest starts (Rule 11)
  const firstTurnRolls: Record<PlayerId, number | null> = {};
  const firstTurnContenders = playerStates.map(p => p.id);
  for (const pid of firstTurnContenders) {
    firstTurnRolls[pid] = null;
  }

  return {
    phase: "ROLLING_FOR_FIRST_TURN",
    playerCount,
    armCount,
    totalRingCells,
    players: playerStates,
    currentTurnPlayerId: firstTurnContenders[0],
    currentDiceRoll: null,
    lastDiceRoll: null,
    canRoll: true,
    consecutiveSixes: 0,
    firstTurnRolls,
    firstTurnContenders,
    firstTurnCurrentRollerIndex: 0,
    rankings: [],
    teamRankings: [],
    settings,
    turnCount: 0,
    lastActionDescription: "Game started! Rolling for first turn..."
  };
}

/**
 * Helper to get the tokens that the current player is allowed to move.
 * In team mode, if the player has all 4 tokens home, they move their partner's tokens.
 */
export function getControllableTokens(state: LudoState, playerId: PlayerId): { owner: LudoPlayerState; tokens: LudoToken[] } | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;

  const playerTokensHome = player.tokens.filter(t => t.location.type === "home").length;
  if (playerTokensHome < LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER) {
    return { owner: player, tokens: player.tokens };
  }

  // If in team mode and all 4 tokens are home, player controls their partner tokens
  if (state.settings.teamsEnabled && player.partnerPlayerId) {
    const partner = state.players.find(p => p.id === player.partnerPlayerId);
    if (partner) {
      const partnerTokensHome = partner.tokens.filter(t => t.location.type === "home").length;
      if (partnerTokensHome < LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER) {
        return { owner: partner, tokens: partner.tokens };
      }
    }
  }

  return null;
}

/**
 * Checks if a specific cell on the track contains an active block (2+ tokens of same player or team).
 */
export function isBlockOnTrack(
  state: LudoState, 
  ringIndex: number, 
  forPlayerId: PlayerId
): { isBlock: boolean; isFriendly: boolean } {
  const player = state.players.find(p => p.id === forPlayerId);
  const playerTeam = player?.teamIndex;

  // Count tokens per player/team on this cell
  const tokensOnCell: { ownerId: PlayerId; teamIndex?: number }[] = [];
  for (const p of state.players) {
    for (const t of p.tokens) {
      if (t.location.type === "track" && t.location.ringIndex === ringIndex) {
        tokensOnCell.push({ ownerId: p.id, teamIndex: p.teamIndex });
      }
    }
  }

  if (tokensOnCell.length < 2) {
    return { isBlock: false, isFriendly: false };
  }

  // Check if 2+ belong to same player or same team
  const friendlyCount = tokensOnCell.filter(t => 
    t.ownerId === forPlayerId || (state.settings.teamsEnabled && playerTeam !== undefined && t.teamIndex === playerTeam)
  ).length;

  if (friendlyCount >= 2) {
    return { isBlock: true, isFriendly: true };
  }

  // Check opponent counts
  const opponentGroups: Record<string, number> = {};
  for (const t of tokensOnCell) {
    const groupKey = state.settings.teamsEnabled && t.teamIndex !== undefined ? "team_" + t.teamIndex : "p_" + t.ownerId;
    opponentGroups[groupKey] = (opponentGroups[groupKey] || 0) + 1;
    if (opponentGroups[groupKey] >= 2) {
      return { isBlock: true, isFriendly: false };
    }
  }

  return { isBlock: false, isFriendly: false };
}

/**
 * Checks if a specific token has a legal move given the current dice roll.
 */
export function canTokenMove(
  state: LudoState,
  token: LudoToken,
  tokenOwner: LudoPlayerState,
  diceRoll: number
): boolean {
  if (diceRoll < 1 || diceRoll > 6) return false;

  const totalRingCells = state.totalRingCells;
  const startCell = getArmStartCell(tokenOwner.armIndex, totalRingCells);

  // 1. Token in yard: can only leave on a 6
  if (token.location.type === "yard") {
    if (diceRoll !== LUDO_BOARD_CONFIG.ROLL_TO_EXIT_BASE) return false;

    // Check if start cell has an opponent block that cannot be entered
    const blockCheck = isBlockOnTrack(state, startCell, tokenOwner.id);
    if (blockCheck.isBlock && !blockCheck.isFriendly && state.settings.blocksStopOpponents) {
      return false;
    }
    return true;
  }

  // 2. Token already home: cannot move
  if (token.location.type === "home") {
    return false;
  }

  // 3. Token on track
  if (token.location.type === "track") {
    const currentDistance = token.location.distanceTraveled;
    const newDistance = currentDistance + diceRoll;
    const maxTrackDistance = totalRingCells; // Full lap length
    const maxFinishDistance = totalRingCells + LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH; // EXACT finish at +5

    // Overshoot check
    if (newDistance > maxFinishDistance) {
      return false;
    }

    // Check intermediate path for blocks if blocksStopOpponents is enabled
    if (state.settings.blocksStopOpponents) {
      const stepsToCheck = Math.min(diceRoll, maxTrackDistance - currentDistance);
      for (let s = 1; s <= stepsToCheck; s++) {
        const intermediateDist = currentDistance + s;
        if (intermediateDist < maxTrackDistance) {
          const intermediateRing = (startCell + intermediateDist) % totalRingCells;
          const block = isBlockOnTrack(state, intermediateRing, tokenOwner.id);
          if (block.isBlock && !block.isFriendly) {
            return false; // Path blocked by opponent block!
          }
        }
      }
    }

    // Check landing cell if still on track
    if (newDistance < maxTrackDistance) {
      const targetRing = (startCell + newDistance) % totalRingCells;
      const landingBlock = isBlockOnTrack(state, targetRing, tokenOwner.id);
      const safe = isSafeCell(targetRing, state.armCount);
      // Opponent blocks are safe from capture, so landing on an opponent block on a non-safe cell is illegal.
      // On designated safe cells, different players can share the cell unless blocksStopOpponents is enabled.
      if (landingBlock.isBlock && !landingBlock.isFriendly) {
        if (!safe || state.settings.blocksStopOpponents) {
          return false;
        }
      }
    }

    return true;
  }

  // 4. Token in home column
  if (token.location.type === "home_column") {
    const currentDistance = token.location.distanceTraveled;
    const newDistance = currentDistance + diceRoll;
    const maxFinishDistance = totalRingCells + LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH;

    // Exact roll required to reach center
    if (newDistance > maxFinishDistance) {
      return false; // Overshoot is illegal!
    }

    return true;
  }

  return false;
}

/**
 * Returns all legal actions for a given player in the current state.
 */
export function getLegalActions(state: LudoState, playerId: PlayerId): LegalAction[] {
  if (state.phase === "GAME_OVER") return [];

  // Phase: ROLLING_FOR_FIRST_TURN
  if (state.phase === "ROLLING_FOR_FIRST_TURN") {
    if (state.currentTurnPlayerId !== playerId) return [];
    if (!state.canRoll) return [];
    return [{ type: "roll", description: "Roll dice to determine who goes first" }];
  }

  // Phase: PLAYING
  if (state.currentTurnPlayerId !== playerId) return [];

  if (state.canRoll) {
    return [{ type: "roll", description: "Roll dice" }];
  }

  if (state.currentDiceRoll !== null) {
    const controllable = getControllableTokens(state, playerId);
    if (!controllable) return [];

    const legalTokenMoves: LegalAction[] = [];
    for (const token of controllable.tokens) {
      if (canTokenMove(state, token, controllable.owner, state.currentDiceRoll)) {
        legalTokenMoves.push({
          type: "move",
          tokenId: token.id,
          description: `Move token ${token.id + 1}`
        });
      }
    }
    return legalTokenMoves;
  }

  return [];
}

/**
 * Advances the turn to the next player.
 */
export function advanceToNextTurn(state: LudoState): { 
  nextPlayerId: string; 
  gameOver: boolean; 
  winningTeamIndex?: number;
  teamRankings?: number[];
} {
  const playerCount = state.players.length;
  const currentIdx = state.players.findIndex(p => p.id === state.currentTurnPlayerId);

  // Check game over conditions
  if (state.settings.teamsEnabled) {
    // Team mode: count home tokens for each team
    const teamTokensHome: Record<number, number> = {};
    for (const p of state.players) {
      if (p.teamIndex !== undefined) {
        const count = p.tokens.filter(t => t.location.type === "home").length;
        teamTokensHome[p.teamIndex] = (teamTokensHome[p.teamIndex] || 0) + count;
      }
    }

    const totalTeams = Math.floor(playerCount / 2);
    if (!state.teamRankings) {
      state.teamRankings = [];
    }

    // Update finished teams in order of finishing
    for (let t = 0; t < totalTeams; t++) {
      if ((teamTokensHome[t] || 0) === 8 && !state.teamRankings.includes(t)) {
        state.teamRankings.push(t);
        if (state.winningTeamIndex === undefined) {
          state.winningTeamIndex = t;
        }
      }
    }

    // Check if game is over (4 players -> 1 finished team ends game; 6 players -> 2 finished teams ends game)
    const isGameOver = (totalTeams === 2 && state.teamRankings.length >= 1) ||
      (totalTeams > 2 && state.teamRankings.length >= totalTeams - 1);

    if (isGameOver) {
      // Append any remaining unfinished teams
      for (let t = 0; t < totalTeams; t++) {
        if (!state.teamRankings.includes(t)) {
          state.teamRankings.push(t);
        }
      }

      // Populate rankings for all players based on their team rank
      state.rankings = [];
      state.teamRankings.forEach((tIdx, rankIdx) => {
        const teamPlayers = state.players.filter(p => p.teamIndex === tIdx);
        for (const tp of teamPlayers) {
          tp.hasFinished = true;
          tp.rank = rankIdx + 1;
          state.rankings.push(tp.id);
        }
      });

      return { 
        nextPlayerId: state.currentTurnPlayerId, 
        gameOver: true, 
        winningTeamIndex: state.winningTeamIndex,
        teamRankings: state.teamRankings 
      };
    }

    // Find next player whose team has not yet finished all 8 tokens
    for (let i = 1; i <= playerCount; i++) {
      const candidateIdx = (currentIdx + i) % playerCount;
      const candidate = state.players[candidateIdx];
      const teamIdx = candidate.teamIndex;
      if (teamIdx !== undefined && (teamTokensHome[teamIdx] || 0) < 8) {
        return { 
          nextPlayerId: candidate.id, 
          gameOver: false, 
          winningTeamIndex: state.winningTeamIndex,
          teamRankings: state.teamRankings 
        };
      }
    }

    return { 
      nextPlayerId: state.currentTurnPlayerId, 
      gameOver: true, 
      winningTeamIndex: state.winningTeamIndex,
      teamRankings: state.teamRankings 
    };
  } else {
    // Solo mode: check if only 1 unfinished player remains
    const unfinishedPlayers = state.players.filter(p => !p.hasFinished);
    if (unfinishedPlayers.length <= 1) {
      // Record rank for the last remaining player
      if (unfinishedPlayers.length === 1) {
        const lastPlayer = unfinishedPlayers[0];
        lastPlayer.hasFinished = true;
        lastPlayer.rank = state.rankings.length + 1;
        state.rankings.push(lastPlayer.id);
      }
      return { nextPlayerId: state.currentTurnPlayerId, gameOver: true };
    }

    // Find next unfinished player
    for (let i = 1; i <= playerCount; i++) {
      const candidateIdx = (currentIdx + i) % playerCount;
      const candidate = state.players[candidateIdx];
      if (!candidate.hasFinished) {
        return { nextPlayerId: candidate.id, gameOver: false };
      }
    }

    return { nextPlayerId: state.currentTurnPlayerId, gameOver: true };
  }
}

/**
 * Applies an action to the state. Pure and deterministic given the RNG generator.
 */
export function applyAction(
  state: LudoState,
  playerId: PlayerId,
  action: LudoAction,
  rng: () => number = Math.random
): ApplyActionResult<LudoState> {
  const logMessages: string[] = [];

  // Deep clone state to ensure immutability
  const next: LudoState = JSON.parse(JSON.stringify(state));

  // -------------------------------------------------------------
  // PHASE: ROLLING FOR FIRST TURN
  // -------------------------------------------------------------
  if (next.phase === "ROLLING_FOR_FIRST_TURN") {
    if (action.type !== "roll") {
      throw new Error("Action must be roll during first turn determination");
    }
    if (next.currentTurnPlayerId !== playerId) {
      throw new Error("Not your turn to roll");
    }

    // Roll 1-6
    const roll = Math.floor(rng() * 6) + 1;
    next.firstTurnRolls[playerId] = roll;
    next.currentDiceRoll = roll;
    next.lastDiceRoll = roll;
    const player = next.players.find(p => p.id === playerId);
    logMessages.push(`${player?.name || "Player"} rolled a ${roll} for first turn.`);

    // Advance to next contender
    const currentIndex = next.firstTurnCurrentRollerIndex;
    const nextIndex = currentIndex + 1;

    if (nextIndex < next.firstTurnContenders.length) {
      next.firstTurnCurrentRollerIndex = nextIndex;
      next.currentTurnPlayerId = next.firstTurnContenders[nextIndex];
      next.canRoll = true;
    } else {
      // All contenders have rolled! Find highest
      let maxVal = -1;
      let highestPids: PlayerId[] = [];

      for (const pid of next.firstTurnContenders) {
        const val = next.firstTurnRolls[pid] ?? 0;
        if (val > maxVal) {
          maxVal = val;
          highestPids = [pid];
        } else if (val === maxVal) {
          highestPids.push(pid);
        }
      }

      if (highestPids.length === 1) {
        // Clear winner!
        const winner = next.players.find(p => p.id === highestPids[0])!;
        next.phase = "PLAYING";
        next.currentTurnPlayerId = winner.id;
        next.canRoll = true;
        next.currentDiceRoll = null;
        next.consecutiveSixes = 0;
        logMessages.push(`${winner.name} rolled the highest (${maxVal}) and goes first!`);
      } else {
        // Tie! Re-roll for tied contenders
        const tiedNames = highestPids.map(id => next.players.find(p => p.id === id)?.name || id).join(", ");
        logMessages.push(`Tie of ${maxVal} between ${tiedNames}! Re-rolling...`);
        next.firstTurnContenders = highestPids;
        next.firstTurnCurrentRollerIndex = 0;
        next.currentTurnPlayerId = highestPids[0];
        next.canRoll = true;
        for (const pid of highestPids) {
          next.firstTurnRolls[pid] = null;
        }
      }
    }

    next.lastActionDescription = logMessages[logMessages.length - 1];
    return { newState: next, logMessages, broadcast: true };
  }

  // -------------------------------------------------------------
  // PHASE: PLAYING
  // -------------------------------------------------------------
  if (next.phase !== "PLAYING") {
    throw new Error("Game is not in PLAYING phase");
  }

  if (next.currentTurnPlayerId !== playerId) {
    throw new Error("Not your turn");
  }

  const currentPlayer = next.players.find(p => p.id === playerId)!;

  // ACTION: ROLL
  if (action.type === "roll") {
    if (!next.canRoll) {
      throw new Error("Cannot roll right now");
    }

    const roll = Math.floor(rng() * 6) + 1;
    next.currentDiceRoll = roll;
    next.lastDiceRoll = roll;
    next.canRoll = false;

    logMessages.push(`${currentPlayer.name} rolled a ${roll}.`);

    // Check Rule 3: Three 6s in a row forfeits the turn
    if (roll === 6) {
      next.consecutiveSixes++;
      if (next.consecutiveSixes === LUDO_BOARD_CONFIG.CONSECUTIVE_SIXES_LIMIT) {
        logMessages.push(`${currentPlayer.name} rolled three 6s in a row! Turn forfeited.`);
        next.consecutiveSixes = 0;
        next.currentDiceRoll = null;
        next.canRoll = true;
        const adv = advanceToNextTurn(next);
        next.currentTurnPlayerId = adv.nextPlayerId;
        if (adv.gameOver) {
          next.phase = "GAME_OVER";
          next.winningTeamIndex = adv.winningTeamIndex;
          if (adv.teamRankings) {
            next.teamRankings = adv.teamRankings;
          }
          logMessages.push("Game Over!");
        }
        next.lastActionDescription = logMessages[logMessages.length - 1];
        return { newState: next, logMessages, broadcast: true };
      }
    } else {
      next.consecutiveSixes = 0;
    }

    // Compute legal moves
    const legalMoves = getLegalActions(next, playerId).filter(a => a.type === "move");

    if (legalMoves.length === 0) {
      // Rule 4: If no legal move exists, auto-pass!
      logMessages.push(`No legal moves for ${currentPlayer.name}. Turn passed.`);
      next.currentDiceRoll = null;
      next.canRoll = true;
      next.consecutiveSixes = 0;
      const adv = advanceToNextTurn(next);
      next.currentTurnPlayerId = adv.nextPlayerId;
      if (adv.gameOver) {
        next.phase = "GAME_OVER";
        next.winningTeamIndex = adv.winningTeamIndex;
        if (adv.teamRankings) {
          next.teamRankings = adv.teamRankings;
        }
        logMessages.push("Game Over!");
      }
      next.lastActionDescription = logMessages[logMessages.length - 1];
      return { newState: next, logMessages, broadcast: true };
    }

    // Setting: auto-move when only one legal move exists
    if (next.settings.autoMoveSingle && legalMoves.length === 1) {
      // Execute the single legal move directly!
      const singleMoveAction: LudoAction = { type: "move", tokenId: legalMoves[0].tokenId! };
      const moveResult = applyAction(next, playerId, singleMoveAction, rng);
      return {
        newState: moveResult.newState,
        logMessages: [...logMessages, ...moveResult.logMessages!],
        broadcast: true
      };
    }

    next.lastActionDescription = logMessages[logMessages.length - 1];
    return { newState: next, logMessages, broadcast: true };
  }

  // ACTION: MOVE
  if (action.type === "move") {
    if (next.canRoll || next.currentDiceRoll === null) {
      throw new Error("Must roll dice before moving");
    }

    const diceRoll = next.currentDiceRoll;
    const controllable = getControllableTokens(next, playerId);
    if (!controllable) {
      throw new Error("No controllable tokens available");
    }

    const token = controllable.tokens.find(t => t.id === action.tokenId);
    if (!token) {
      throw new Error(`Token ${action.tokenId} not found`);
    }

    if (!canTokenMove(next, token, controllable.owner, diceRoll)) {
      throw new Error(`Illegal move for token ${action.tokenId}`);
    }

    const totalRingCells = next.totalRingCells;
    const startCell = getArmStartCell(controllable.owner.armIndex, totalRingCells);
    let extraRoll = diceRoll === 6; // Rule 3: A 6 gives an extra roll
    let capturedOpponent = false;

    // Execute Move
    if (token.location.type === "yard") {
      // Leave yard onto start cell
      token.location = {
        type: "track",
        ringIndex: startCell,
        distanceTraveled: 0
      };
      logMessages.push(`${currentPlayer.name} moved token out of base to start cell.`);
    } else if (token.location.type === "track") {
      const currentDist = token.location.distanceTraveled;
      const newDist = currentDist + diceRoll;
      const maxTrackDistance = totalRingCells;
      const maxFinishDistance = totalRingCells + LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH;

      if (newDist === maxFinishDistance) {
        // Reached Center Home!
        token.location = { type: "home" };
        extraRoll = true; // Rule 9: Reaching home gives an extra roll
        logMessages.push(`${currentPlayer.name}'s token reached home!`);
      } else if (newDist >= maxTrackDistance) {
        // Entered Home Column
        const homeColIdx = newDist - maxTrackDistance;
        token.location = {
          type: "home_column",
          index: homeColIdx,
          distanceTraveled: newDist
        };
        logMessages.push(`${currentPlayer.name}'s token entered home column at cell ${homeColIdx + 1}.`);
      } else {
        // Advance on Track
        const targetRing = (startCell + newDist) % totalRingCells;
        token.location = {
          type: "track",
          ringIndex: targetRing,
          distanceTraveled: newDist
        };

        // Check Capture (Rule 5 & 6)
        if (!isSafeCell(targetRing, next.armCount)) {
          // Check tokens occupying targetRing
          for (const otherPlayer of next.players) {
            // Teammates and self cannot be captured
            const isFriendly = otherPlayer.id === controllable.owner.id || 
              (next.settings.teamsEnabled && controllable.owner.teamIndex !== undefined && otherPlayer.teamIndex === controllable.owner.teamIndex);
            
            if (!isFriendly) {
              const opponentTokensOnCell = otherPlayer.tokens.filter(
                t => t.location.type === "track" && t.location.ringIndex === targetRing
              );

              // Capture only if single opponent token (blocks of 2+ cannot be captured)
              if (opponentTokensOnCell.length === 1) {
                const capturedToken = opponentTokensOnCell[0];
                capturedToken.location = { type: "yard" };
                capturedOpponent = true;
                extraRoll = true; // Rule 5: Capturer gets an extra roll
                logMessages.push(`${currentPlayer.name} captured ${otherPlayer.name}'s token!`);
              }
            }
          }
        }
        if (!capturedOpponent) {
          logMessages.push(`${currentPlayer.name} moved token forward ${diceRoll} steps.`);
        }
      }
    } else if (token.location.type === "home_column") {
      const currentDist = token.location.distanceTraveled;
      const newDist = currentDist + diceRoll;
      const maxTrackDistance = totalRingCells;
      const maxFinishDistance = totalRingCells + LUDO_BOARD_CONFIG.HOME_COLUMN_LENGTH;

      if (newDist === maxFinishDistance) {
        token.location = { type: "home" };
        extraRoll = true; // Rule 9: Reaching home gives an extra roll
        logMessages.push(`${currentPlayer.name}'s token reached home!`);
      } else {
        const homeColIdx = newDist - maxTrackDistance;
        token.location = {
          type: "home_column",
          index: homeColIdx,
          distanceTraveled: newDist
        };
        logMessages.push(`${currentPlayer.name} moved token along home column to cell ${homeColIdx + 1}.`);
      }
    }

    // Check if token owner just finished all 4 tokens
    const tokensHome = controllable.owner.tokens.filter(t => t.location.type === "home").length;
    if (tokensHome === LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER && !controllable.owner.hasFinished) {
      controllable.owner.hasFinished = true;
      controllable.owner.rank = next.rankings.length + 1;
      next.rankings.push(controllable.owner.id);
      logMessages.push(`🎉 ${controllable.owner.name} finished in place #${controllable.owner.rank}!`);
    }

    // Reset current roll
    next.currentDiceRoll = null;

    // Check if turn passes or extra roll awarded
    if (extraRoll) {
      logMessages.push(`${currentPlayer.name} earned an extra roll!`);
      if (next.settings.teamsEnabled) {
        const teamIdx = controllable.owner.teamIndex;
        if (teamIdx !== undefined) {
          const teamPlayers = next.players.filter(p => p.teamIndex === teamIdx);
          const teamTokensHome = teamPlayers.reduce(
            (sum, p) => sum + p.tokens.filter(t => t.location.type === "home").length,
            0
          );
          if (teamTokensHome === teamPlayers.length * LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER) {
            // Whole team is done! It cannot roll anymore.
            next.canRoll = false;
            next.consecutiveSixes = 0;
            const adv = advanceToNextTurn(next);
            next.currentTurnPlayerId = adv.nextPlayerId;
            if (adv.gameOver) {
              next.phase = "GAME_OVER";
              next.winningTeamIndex = adv.winningTeamIndex;
              if (adv.teamRankings) {
                next.teamRankings = adv.teamRankings;
              }
              logMessages.push("Game Over! Team won!");
            } else {
              next.canRoll = true;
            }
          } else {
            next.canRoll = true;
          }
        } else {
          next.canRoll = true;
        }
      } else if (currentPlayer.hasFinished) {
        next.canRoll = false;
        next.consecutiveSixes = 0;
        const adv = advanceToNextTurn(next);
        next.currentTurnPlayerId = adv.nextPlayerId;
        if (adv.gameOver) {
          next.phase = "GAME_OVER";
          next.winningTeamIndex = adv.winningTeamIndex;
          if (adv.teamRankings) {
            next.teamRankings = adv.teamRankings;
          }
          logMessages.push("Game Over!");
        } else {
          next.canRoll = true;
        }
      } else {
        next.canRoll = true;
      }
    } else {
      next.canRoll = true;
      next.consecutiveSixes = 0;
      const adv = advanceToNextTurn(next);
      next.currentTurnPlayerId = adv.nextPlayerId;
      if (adv.gameOver) {
        next.phase = "GAME_OVER";
        next.winningTeamIndex = adv.winningTeamIndex;
        if (adv.teamRankings) {
          next.teamRankings = adv.teamRankings;
        }
        logMessages.push("Game Over!");
      }
    }

    next.turnCount++;
    next.lastActionDescription = logMessages[logMessages.length - 1];
    return { newState: next, logMessages, broadcast: true };
  }

  throw new Error("Invalid action type");
}

/**
 * Handles server-side turn timer expiration.
 * Auto-rolls if roll pending, then auto-moves or auto-passes.
 */
export function handleTimerExpired(state: LudoState, rng: () => number = Math.random): ApplyActionResult<LudoState> {
  if (state.phase === "GAME_OVER") {
    return { newState: state };
  }

  if (state.phase === "ROLLING_FOR_FIRST_TURN") {
    // Current roller auto-rolls
    return applyAction(state, state.currentTurnPlayerId, { type: "roll" }, rng);
  }

  let currentState = state;
  const messages: string[] = [];

  // If player hasn't rolled, auto-roll
  if (currentState.canRoll) {
    const rollRes = applyAction(currentState, currentState.currentTurnPlayerId, { type: "roll" }, rng);
    currentState = rollRes.newState;
    if (rollRes.logMessages) messages.push(...rollRes.logMessages);
  }

  // If now waiting for a move
  if (!currentState.canRoll && currentState.currentDiceRoll !== null) {
    const legalMoves = getLegalActions(currentState, currentState.currentTurnPlayerId).filter(a => a.type === "move");
    if (legalMoves.length > 0) {
      // Auto-move first legal token
      const moveRes = applyAction(currentState, currentState.currentTurnPlayerId, { type: "move", tokenId: legalMoves[0].tokenId! }, rng);
      currentState = moveRes.newState;
      if (moveRes.logMessages) messages.push(...moveRes.logMessages);
    } else {
      // Auto-pass
      const adv = advanceToNextTurn(currentState);
      currentState.currentDiceRoll = null;
      currentState.canRoll = true;
      currentState.consecutiveSixes = 0;
      currentState.currentTurnPlayerId = adv.nextPlayerId;
      if (adv.gameOver) {
        currentState.phase = "GAME_OVER";
        currentState.winningTeamIndex = adv.winningTeamIndex;
        if (adv.teamRankings) {
          currentState.teamRankings = adv.teamRankings;
        }
      }
    }
  }

  return {
    newState: currentState,
    logMessages: messages,
    broadcast: true
  };
}

/**
 * Returns the public state for a player or observer.
 */
export function getLudoPublicState(state: LudoState, _forPlayerId?: PlayerId): LudoState {
  // Ludo has full public board visibility.
  return state;
}
