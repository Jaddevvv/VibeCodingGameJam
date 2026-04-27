# Tank Assault — Desert Storm

3D tank combat game with charged laser mechanics. Single-player (CO-OP vs bots) and real-time multiplayer.

## Run

```bash
npm install
node server.js
```

Then open http://localhost:3000 in your browser.

## Test multiplayer locally

Open the same URL (`http://localhost:3000`) in **multiple browser tabs or windows** — each tab is a separate player. Each tab will show a name on the start screen (edit the callsign field if you want), then click **MULTIPLAYER** to join the shared room. You should see the other tabs' tanks in the world and a `PLAYERS` panel listing everyone with their kill counts.

Different browsers (Chrome + Firefox) or an incognito window work too — useful if sessionStorage/cache gets sticky.

## Modes

- **CO-OP** — play alone against AI tank waves (the original single-player).
- **MULTIPLAYER** — all players share one server, no bots. Players respawn 4s after being destroyed.

## Controls

| Key | Action |
| --- | --- |
| WASD / ZQSD | Move tank |
| Mouse | Aim turret |
| Hold Space | Charge laser |
| Release Space | Fire |
| Esc | Pause / settings |

## Deployment

The server is a stock Node + `ws` setup. To deploy:

- Ensure `PORT` env var is honored (`PORT=8080 node server.js`).
- Serve behind a reverse proxy with WebSocket upgrade support (nginx, Caddy, Fly.io, Railway, Render all work).
- The client connects to `ws://<same-host>/ws` — so as long as the same origin serves both HTTP and WS, no client config is needed.
