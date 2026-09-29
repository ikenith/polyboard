# 🎲 Polyboard — Realtime Multiplayer Board Games

A modern, mobile-first realtime multiplayer board-game web application architected for up to 7 players per room. It launches with a fully featured, anti-cheat hardened **Ludo** engine with procedural polygon boards (triangles, squares, pentagons, hexagons, heptagons) and teams support.

Hosted on **ONE Cloudflare Workers project** (free plan, zero budget):
- The Worker serves the built React frontend via **Workers Static Assets** AND handles API & WebSockets on the exact same domain.
- No separate frontend host, zero CORS configuration needed.
- Room state is durably persisted using **SQLite-backed Durable Objects** with native WebSocket hibernation and server-side alarms for turn timers.

---

## 🚀 Quick Start (Exact Copy-Paste Commands)

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Cloudflare Account**: Free tier (zero budget required)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Automated Tests
Runs all unit and integration tests covering the rules engine, procedural SVG polygon geometry, and anti-cheat protocol:
```bash
npm test
```

### 4. Run Locally
To test the complete stack locally (Vite frontend + Cloudflare Worker with SQLite Durable Objects & WebSockets):

```bash
# Build frontend and launch the Cloudflare local runtime:
npm run build
npx wrangler dev
```
Open **`http://localhost:8787`** in your browser (or multiple private/incognito windows to test multiplayer).

*(Optional: for rapid frontend hot-module reloading during UI tweaks, run `npm run dev` in one terminal and `npx wrangler dev` in another).*

### 5. Deploy to Cloudflare (Free Plan)
Authenticate once with Cloudflare, then deploy:
```bash
# 1. Log in to your free Cloudflare account
npx wrangler login

# 2. Build and deploy frontend + backend in one shot
npm run deploy
```
Wrangler will output your live URL (e.g., `https://polyboard.<your-subdomain>.workers.dev`). Open the link, share room codes or invite URLs with your friends, and play!

---

## 🛡️ Anti-Cheat Architecture (Top Priority)

The server is the absolute single source of truth; the client is untrusted:
1. **Intents Only**: Clients only transmit `{ type: "roll" }` and `{ type: "move", tokenId: number }`. Clients never send dice rolls, coordinates, or board state.
2. **Server-Side Dice**: Dice values are generated using Web Crypto `crypto.getRandomValues` on the server.
3. **Atomic Locks**: Color and icon selections are validated atomically on the server. If two players click the same color or icon at the same millisecond, the first gets it and the second receives a descriptive error.
4. **Session Authentication**: No accounts required. Each player is issued a 48-character cryptographically secure `sessionToken` stored in `localStorage`. Reconnecting or refreshing automatically restores their seat. Session tokens are **never** broadcast to opponents.
5. **Rate & Size Limiting**: Every WebSocket message is capped at 4KB and rate-limited to 12 messages/second per connection.
6. **Server Turn Timer**: Server-side alarms enforce the turn timer (default 60s, configurable by host). If a player disconnects or idles, the server automatically rolls and executes legal moves or passes.

---

## 📐 Procedural Polygon Board Geometry

Boards are generated procedurally in SVG from $N$ players who joined:
- **2 Players**: Square board (4 arms) with players seated on opposite arms.
- **3 Players**: Triangle board (3 arms).
- **4 Players**: Square board (4 arms).
- **5 Players**: Pentagon board (5 arms).
- **6 Players**: Hexagon board (6 arms).
- **7 Players**: Heptagon board (7 arms).

Each arm is identical:
- **13 cells per arm** ($13 \times N$ total on the shared perimeter track).
- **Start cell** at offset 1 in each arm.
- **Star cell** at offset 9 in each arm (both start and star cells are designated safe cells where no captures can occur).
- **Home column**: 5 colored cells leading directly into the center home goal.
- Logical track indices are decoupled from SVG render coordinates, enabling smooth CSS cell-by-cell animations.

---

## 📜 Ludo Rules Implemented

1. **4 tokens per player** starting in the yard/base.
2. **Exit yard only on a 6** onto the player's start cell.
3. **Extra rolls**: Rolling a 6 earns an extra roll. **Three consecutive 6s** immediately forfeits the turn (the third 6 is not played).
4. **Exact moves**: A legal move must be taken if one exists; if none exist, the server auto-passes. Host can enable **Auto-move single option** when only 1 move exists.
5. **Captures**: Landing on a single opponent token sends it back to the yard; the capturer receives an extra roll.
6. **Safe cells**: All start cells and star cells are safe from capture; multiple players can share them.
7. **Blocks**: 2 or more tokens of the same player (or team) form a safe block. Host setting: *"Blocks stop opponents passing"* (default OFF).
8. **Home column**: Enterable only after completing the full lap of the perimeter track.
9. **Center finish**: Exact roll required to reach the center home. Overshooting is illegal. Reaching home earns an extra roll.
10. **Solo rankings**: Players are ranked as all 4 tokens reach home (1st, 2nd, 3rd, ...). The game continues until 1 player remains.
11. **First-turn roll**: At the start, all players roll once. The highest roll takes the first turn (ties re-roll only for tied contenders).

---

## 🤝 Teams Mode

- Available when joined player count is even and at least 4 (4 or 6 players).
- Host toggles Teams in settings. Players send and accept partner requests, or host clicks **Randomize Teams**.
- Partners sit directly opposite each other (`seat i` and `seat i + N/2`).
- Teammates never capture each other and form safe blocks together.
- When a player has all 4 tokens home, on their turns they move their partner's tokens!
- A team wins when all 8 tokens are home.

---

## 🧩 Adding More Games in the Future

The lobby and room layer is completely decoupled from game rules. To add a new game:
1. Create a folder in `src/games/<your-game>/`.
2. Implement the `GameModule` interface from `src/games/types.ts`:
   - `init(players, config)`
   - `getLegalActions(state, playerId)`
   - `applyAction(state, playerId, action, rng)`
   - `getPublicState(state, playerId)`
3. Register the module in `src/games/registry.ts`.
Zero lobby or networking code needs to be modified!
