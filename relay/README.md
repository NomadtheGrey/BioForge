# BioForge room relay

Cloudflare Worker + Durable Object that relays multiplayer messages
between players in the same room. Deployed as the 
worker via Cloudflare Workers Builds (root directory: this folder,
deploy command: 
 ⛅️ wrangler 4.150.0
────────────────────

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md).

-  — the relay. One Durable Object instance per room code;
  forwards each WebSocket message to everyone else in the room.
-  — worker config. The Durable Object binding (ROOMS)
  and migration live here; the Cloudflare dashboard cannot create them,
  which is why this folder is deployed from Git.
