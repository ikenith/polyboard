# Polyboard Copilot Instructions

## Project shape

- This is a React + TypeScript frontend deployed with a Cloudflare Worker.
- `src/server/worker.ts` serves the app and routes API/WebSocket traffic.
- `src/server/room_do.ts` owns persistent room state through a SQLite-backed Durable Object.
- Game rules belong in `src/games/<game>/`; keep the lobby and room layer game-agnostic.

## Engineering rules

- Treat the server as the source of truth. Clients send intents, never authoritative dice, coordinates, or game state.
- Preserve WebSocket validation, session-token privacy, rate limits, and message-size limits when changing protocols.
- Prefer existing game interfaces, geometry helpers, and protocol types over new parallel abstractions.
- Keep user-facing UI responsive on mobile and consistent with the existing styling in `src/client/index.css`.
- Run `npm test` for logic or protocol changes and `npm run build` for changes that affect the Worker or frontend.
- Use Wrangler for Cloudflare local development and deployment; do not add provider-specific secrets to source files.
