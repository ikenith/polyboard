import { describe, it, expect } from "vitest";
import { 
  initLudoGame, 
  getLegalActions, 
  applyAction, 
  handleTimerExpired,
  getArmStartCell,
  getArmStarCell
} from "../src/games/ludo/engine";
import { Player, RoomSettings } from "../src/games/types";
import { LudoState } from "../src/games/ludo/types";

function mockRng(values: number[]) {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx++;
    return (val - 0.5) / 6;
  };
}

const defaultSettings: RoomSettings = {
  turnTimeSeconds: 60,
  autoMoveSingle: false,
  blocksStopOpponents: false,
  teamsEnabled: false,
};

function createPlayers(count: number): Player[] {
  const colors = ["red", "blue", "green", "yellow", "purple", "orange", "teal"];
  const icons = ["crown", "dragon", "lion", "eagle", "shield", "star", "lightning"];
  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    players.push({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      colorId: colors[i],
      iconId: icons[i],
      seatIndex: i,
      isHost: i === 0,
      connected: true,
    });
  }
  return players;
}

function setupPlayingState(playerCount: number = 4, settings = defaultSettings): LudoState {
  const players = createPlayers(playerCount);
  let state = initLudoGame(players, settings);
  const rolls = [6, ...Array(playerCount - 1).fill(1)];
  const rng = mockRng(rolls);
  for (const p of state.players) {
    state = applyAction(state, p.id, { type: "roll" }, rng).newState;
  }
  expect(state.phase).toBe("PLAYING");
  expect(state.currentTurnPlayerId).toBe("p1");
  return state;
}

describe("Ludo Engine - Full Specification Rules", () => {
  it("Rule 1: initializes with 4 tokens per player in yard", () => {
    const players = createPlayers(4);
    const state = initLudoGame(players, defaultSettings);

    expect(state.players.length).toBe(4);
    for (const p of state.players) {
      expect(p.tokens.length).toBe(4);
      for (const t of p.tokens) {
        expect(t.location.type).toBe("yard");
      }
    }
  });

  it("2 players: uses 4 arms (square) and opposite seats (arm 0 and arm 2)", () => {
    const players = createPlayers(2);
    const state = initLudoGame(players, defaultSettings);

    expect(state.armCount).toBe(4); // Square board
    expect(state.totalRingCells).toBe(52);
    expect(state.players[0].armIndex).toBe(0);
    expect(state.players[1].armIndex).toBe(2); // Opposite seat!
  });

  it("7 players: uses 7 arms (heptagon)", () => {
    const players = createPlayers(7);
    const state = initLudoGame(players, defaultSettings);

    expect(state.armCount).toBe(7);
    expect(state.totalRingCells).toBe(7 * 13);
    for (let i = 0; i < 7; i++) {
      expect(state.players[i].armIndex).toBe(i);
    }
  });

  it("Rule 11: determines first turn by highest roll with tie-breaking", () => {
    const players = createPlayers(3);
    let state = initLudoGame(players, defaultSettings);
    expect(state.phase).toBe("ROLLING_FOR_FIRST_TURN");

    let rng = mockRng([4, 5, 3]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p2", { type: "roll" }, rng).newState;
    state = applyAction(state, "p3", { type: "roll" }, rng).newState;

    expect(state.phase).toBe("PLAYING");
    expect(state.currentTurnPlayerId).toBe("p2");
    expect(state.canRoll).toBe(true);
  });

  it("Rule 11: ties re-roll only for the tied contenders", () => {
    const players = createPlayers(3);
    let state = initLudoGame(players, defaultSettings);

    const rng = mockRng([5, 5, 2, 3, 6]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p2", { type: "roll" }, rng).newState;
    state = applyAction(state, "p3", { type: "roll" }, rng).newState;

    expect(state.phase).toBe("ROLLING_FOR_FIRST_TURN");
    expect(state.firstTurnContenders).toEqual(["p1", "p2"]);
    expect(state.currentTurnPlayerId).toBe("p1");

    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p2", { type: "roll" }, rng).newState;

    expect(state.phase).toBe("PLAYING");
    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("Rule 2: token leaves yard only on a 6, onto start cell", () => {
    let state = setupPlayingState(4);

    let rng = mockRng([4]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    expect(state.currentTurnPlayerId).toBe("p2");
    expect(state.players[0].tokens[0].location.type).toBe("yard");

    rng = mockRng([2, 3, 1]);
    state = applyAction(state, "p2", { type: "roll" }, rng).newState;
    state = applyAction(state, "p3", { type: "roll" }, rng).newState;
    state = applyAction(state, "p4", { type: "roll" }, rng).newState;
    expect(state.currentTurnPlayerId).toBe("p1");

    rng = mockRng([6]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    expect(state.canRoll).toBe(false);
    expect(state.currentDiceRoll).toBe(6);

    const legalMoves = getLegalActions(state, "p1");
    expect(legalMoves.length).toBe(4);

    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    const startCellP1 = getArmStartCell(state.players[0].armIndex, state.totalRingCells);

    expect(state.players[0].tokens[0].location).toEqual({
      type: "track",
      ringIndex: startCellP1,
      distanceTraveled: 0
    });
  });

  it("Rule 3: rolling 6 gives an extra roll", () => {
    let state = setupPlayingState(4);
    const rng = mockRng([6]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;

    expect(state.currentTurnPlayerId).toBe("p1");
    expect(state.canRoll).toBe(true);
    expect(state.currentDiceRoll).toBe(null);
  });

  it("Rule 3: three 6s in a row forfeits the turn", () => {
    let state = setupPlayingState(4);
    state.players[0].tokens[0].location = { type: "track", ringIndex: 1, distanceTraveled: 0 };

    let rng = mockRng([6]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    expect(state.consecutiveSixes).toBe(1);

    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    expect(state.consecutiveSixes).toBe(2);

    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    expect(state.consecutiveSixes).toBe(0);
    expect(state.currentTurnPlayerId).toBe("p2");
    expect(state.canRoll).toBe(true);
  });

  it("Rule 4: autoMoveSingle setting automatically executes when only 1 legal move exists", () => {
    const settingsWithAutoMove: RoomSettings = {
      ...defaultSettings,
      autoMoveSingle: true,
    };
    let state = setupPlayingState(4, settingsWithAutoMove);
    // Token 0 is on track, tokens 1, 2, 3 in yard
    state.players[0].tokens[0].location = { type: "track", ringIndex: 1, distanceTraveled: 0 };

    // Rolling a 3 means ONLY token 0 can move (tokens in yard require 6)
    // With autoMoveSingle, the move should be applied immediately!
    const rng = mockRng([3]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;

    expect(state.players[0].tokens[0].location).toEqual({
      type: "track",
      ringIndex: 4,
      distanceTraveled: 3
    });
    // Turn should have automatically passed to p2
    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("Rule 5: capture sends opponent to yard and grants an extra roll", () => {
    let state = setupPlayingState(4);
    state.players[1].tokens[0].location = { type: "track", ringIndex: 5, distanceTraveled: 4 };
    state.players[0].tokens[0].location = { type: "track", ringIndex: 1, distanceTraveled: 0 };

    const rng = mockRng([4]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;

    expect(state.players[1].tokens[0].location).toEqual({ type: "yard" });
    expect(state.players[0].tokens[0].location).toEqual({ type: "track", ringIndex: 5, distanceTraveled: 4 });
    expect(state.currentTurnPlayerId).toBe("p1");
    expect(state.canRoll).toBe(true);
  });

  it("Rule 6: safe cells allow multiple players without capture", () => {
    let state = setupPlayingState(4);
    const starCell = getArmStarCell(0, state.totalRingCells);

    state.players[1].tokens[0].location = { type: "track", ringIndex: starCell, distanceTraveled: 10 };
    state.players[0].tokens[0].location = { type: "track", ringIndex: starCell - 3, distanceTraveled: 5 };

    const rng = mockRng([3]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;

    expect(state.players[1].tokens[0].location.type).toBe("track");
    expect((state.players[1].tokens[0].location as any).ringIndex).toBe(starCell);
    expect(state.players[0].tokens[0].location.type).toBe("track");
    expect((state.players[0].tokens[0].location as any).ringIndex).toBe(starCell);
    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("Rule 7: blocks of 2+ friendly tokens are safe from capture", () => {
    let state = setupPlayingState(4);
    const nonSafeCell = 6;

    state.players[1].tokens[0].location = { type: "track", ringIndex: nonSafeCell, distanceTraveled: 5 };
    state.players[1].tokens[1].location = { type: "track", ringIndex: nonSafeCell, distanceTraveled: 5 };

    state.players[0].tokens[0].location = { type: "track", ringIndex: 4, distanceTraveled: 3 };

    state.canRoll = false;
    state.currentDiceRoll = 2;

    const legalMoves = getLegalActions(state, "p1");
    const canMoveToken0 = legalMoves.some(m => m.tokenId === 0);
    expect(canMoveToken0).toBe(false);
  });

  it("Rule 7: blocksStopOpponents setting prevents opponents from passing through", () => {
    const settingsWithBlockStop: RoomSettings = {
      ...defaultSettings,
      blocksStopOpponents: true,
    };
    let state = setupPlayingState(4, settingsWithBlockStop);
    const blockCell = 6;

    state.players[1].tokens[0].location = { type: "track", ringIndex: blockCell, distanceTraveled: 5 };
    state.players[1].tokens[1].location = { type: "track", ringIndex: blockCell, distanceTraveled: 5 };

    state.players[0].tokens[0].location = { type: "track", ringIndex: 4, distanceTraveled: 3 };

    state.canRoll = false;
    state.currentDiceRoll = 4;

    const legalMoves = getLegalActions(state, "p1");
    const canMoveToken0 = legalMoves.some(m => m.tokenId === 0);
    expect(canMoveToken0).toBe(false);
  });

  it("Rule 8 & 9: enters home column, requires exact roll, overshoot illegal", () => {
    let state = setupPlayingState(4);

    state.players[0].tokens[0].location = { type: "track", ringIndex: 0, distanceTraveled: 51 };

    let rng = mockRng([2]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;

    expect(state.players[0].tokens[0].location).toEqual({
      type: "home_column",
      index: 1,
      distanceTraveled: 53
    });

    state.currentTurnPlayerId = "p1";
    state.canRoll = false;

    state.currentDiceRoll = 5;
    let legal = getLegalActions(state, "p1");
    expect(legal.some(m => m.tokenId === 0)).toBe(false);

    state.currentDiceRoll = 4;
    legal = getLegalActions(state, "p1");
    expect(legal.some(m => m.tokenId === 0)).toBe(true);

    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    expect(state.players[0].tokens[0].location).toEqual({ type: "home" });
    expect(state.canRoll).toBe(true);
    expect(state.currentTurnPlayerId).toBe("p1");
  });

  it("Rule 10: player ranked when all 4 tokens are home, game continues until 1 left", () => {
    let state = setupPlayingState(3);

    state.players[0].tokens[0].location = { type: "home" };
    state.players[0].tokens[1].location = { type: "home" };
    state.players[0].tokens[2].location = { type: "home" };
    state.players[0].tokens[3].location = { type: "home_column", index: 4, distanceTraveled: state.totalRingCells + 4 };

    const rng = mockRng([1]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 3 }, rng).newState;

    expect(state.players[0].hasFinished).toBe(true);
    expect(state.players[0].rank).toBe(1);
    expect(state.rankings).toEqual(["p1"]);
    expect(state.phase).toBe("PLAYING");
    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("Teams: partners opposite, cannot capture teammate, moves partner tokens when finished", () => {
    const teamSettings: RoomSettings = {
      ...defaultSettings,
      teamsEnabled: true,
    };
    const players = createPlayers(4);
    players[0].partnerPlayerId = "p3";
    players[2].partnerPlayerId = "p1";
    players[1].partnerPlayerId = "p4";
    players[3].partnerPlayerId = "p2";

    let state = initLudoGame(players, teamSettings);
    expect(state.players[0].teamIndex).toBe(0);
    expect(state.players[2].teamIndex).toBe(0);
    expect(state.players[1].teamIndex).toBe(1);
    expect(state.players[3].teamIndex).toBe(1);

    state.phase = "PLAYING";
    state.currentTurnPlayerId = "p1";
    state.canRoll = true;

    state.players[2].tokens[0].location = { type: "track", ringIndex: 5, distanceTraveled: 10 };
    state.players[0].tokens[0].location = { type: "track", ringIndex: 1, distanceTraveled: 0 };

    let rng = mockRng([4]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;

    expect(state.players[2].tokens[0].location.type).toBe("track");
    expect(state.players[0].tokens[0].location.type).toBe("track");

    for (let t = 0; t < 4; t++) {
      state.players[0].tokens[t].location = { type: "home" };
    }
    state.currentTurnPlayerId = "p1";
    state.canRoll = true;

    state.players[2].tokens[0].location = { type: "track", ringIndex: 10, distanceTraveled: 5 };

    rng = mockRng([3]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    const legalMoves = getLegalActions(state, "p1");
    expect(legalMoves.some(m => m.tokenId === 0)).toBe(true);

    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    expect(state.players[2].tokens[0].location).toEqual({
      type: "track",
      ringIndex: (state.players[2].armIndex * 13 + 1 + 8) % state.totalRingCells,
      distanceTraveled: 8
    });
  });

  it("Anti-cheat: rejects illegal actions and unauthorized turns", () => {
    let state = setupPlayingState(4);

    // p2 attempts to roll when it is p1's turn
    expect(() => {
      applyAction(state, "p2", { type: "roll" });
    }).toThrow("Not your turn");

    // p1 attempts to move before rolling
    expect(() => {
      applyAction(state, "p1", { type: "move", tokenId: 0 });
    }).toThrow("Must roll dice before moving");

    // p1 rolls a 3, attempts to move token 0 from yard (requires 6)
    const rng = mockRng([3]);
    // Set autoMoveSingle to false so it doesn't auto-pass
    state.settings.autoMoveSingle = false;
    // But since no legal moves exist, rolling auto-passes turn
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    expect(state.currentTurnPlayerId).toBe("p2");
  });

  it("Timer: auto-rolls and auto-moves or passes on timeout", () => {
    let state = setupPlayingState(4);
    state.players[0].tokens[0].location = { type: "track", ringIndex: 1, distanceTraveled: 0 };

    const rng = mockRng([3]);
    const res = handleTimerExpired(state, rng);

    expect(res.newState.players[0].tokens[0].location).toEqual({
      type: "track",
      ringIndex: 4,
      distanceTraveled: 3
    });
    expect(res.newState.currentTurnPlayerId).toBe("p2");
  });

  it("Rule 6: allows landing on star safe cell even if opponent has a block when blocksStopOpponents is false", () => {
    let state = setupPlayingState(4, { ...defaultSettings, blocksStopOpponents: false });
    const starRing = getArmStarCell(0, state.totalRingCells);
    state.players[1].tokens[0].location = { type: "track", ringIndex: starRing, distanceTraveled: 10 };
    state.players[1].tokens[1].location = { type: "track", ringIndex: starRing, distanceTraveled: 10 };

    state.players[0].tokens[0].location = { type: "track", ringIndex: starRing - 4, distanceTraveled: 4 };

    const rng = mockRng([4]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;

    const legalMoves = getLegalActions(state, "p1").filter(a => a.type === "move");
    expect(legalMoves.some(a => a.tokenId === 0)).toBe(true);

    state = applyAction(state, "p1", { type: "move", tokenId: 0 }, rng).newState;
    expect(state.players[0].tokens[0].location).toEqual({
      type: "track",
      ringIndex: starRing,
      distanceTraveled: 8
    });
    expect(state.players[1].tokens[0].location.type).toBe("track");
    expect(state.players[1].tokens[1].location.type).toBe("track");
  });

  it("Rule 11: records currentDiceRoll and lastDiceRoll during first-turn roll-off", () => {
    const players = createPlayers(2);
    let state = initLudoGame(players, defaultSettings);
    expect(state.phase).toBe("ROLLING_FOR_FIRST_TURN");
    expect(state.currentDiceRoll).toBeNull();
    expect(state.lastDiceRoll).toBeNull();

    const rng = mockRng([5]);
    state = applyAction(state, "p1", { type: "roll" }, rng).newState;
    expect(state.currentDiceRoll).toBe(5);
    expect(state.lastDiceRoll).toBe(5);
    expect(state.firstTurnRolls["p1"]).toBe(5);
  });

  it("Team victory: finishes game immediately when team gets 8 tokens home during extraRoll", () => {
    const teamSettings: RoomSettings = { ...defaultSettings, teamsEnabled: true };
    const players = createPlayers(4);
    let state = initLudoGame(players, teamSettings);

    state.phase = "PLAYING";
    state.currentTurnPlayerId = "p1";
    state.canRoll = false;

    for (let t = 0; t < 4; t++) {
      state.players[0].tokens[t].location = { type: "home" };
    }
    for (let t = 0; t < 3; t++) {
      state.players[2].tokens[t].location = { type: "home" };
    }

    state.players[2].tokens[3].location = {
      type: "home_column",
      index: 4,
      distanceTraveled: 52 + 5 - 1
    };

    state.currentDiceRoll = 1;

    const res = applyAction(state, "p1", { type: "move", tokenId: 3 });

    expect(res.newState.players[2].tokens[3].location.type).toBe("home");
    expect(res.newState.phase).toBe("GAME_OVER");
    expect(res.newState.winningTeamIndex).toBe(0);
    expect(res.newState.teamRankings).toBeDefined();
    expect(res.newState.teamRankings![0]).toBe(0);
    expect(res.newState.players[0].rank).toBe(1);
    expect(res.newState.players[2].rank).toBe(1);
    expect(res.newState.players[1].rank).toBe(2);
    expect(res.newState.players[3].rank).toBe(2);
  });
});
