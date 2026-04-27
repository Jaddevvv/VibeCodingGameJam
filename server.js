// ============================================================
// Tank Assault — multiplayer server
// Serves the static game files and a single shared WS room.
// Run with: node server.js   (http://localhost:3000)
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
    let urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const resolved = path.normalize(path.join(ROOT, urlPath));
    if (!resolved.startsWith(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(resolved, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + urlPath);
            return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
        });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const PLAYER_MAX_HP = 100;
const RESPAWN_MS = 4000;
const STATE_HZ = 20;
const MAX_NAME_LEN = 16;

const players = new Map();
let nextId = 1;

function randSpawn() {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    return { x, z };
}

function sanitizeName(raw) {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace(/[\x00-\x1f<>"'`]/g, '').trim().slice(0, MAX_NAME_LEN);
    return cleaned.length > 0 ? cleaned : null;
}

function send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(msg, exceptId) {
    const s = JSON.stringify(msg);
    for (const [id, p] of players) {
        if (id === exceptId) continue;
        if (p.ws.readyState === 1) p.ws.send(s);
    }
}

function publicPlayer(p) {
    return {
        id: p.id, name: p.name,
        x: p.x, y: p.y, z: p.z,
        rotY: p.rotY, turretY: p.turretY,
        hp: p.hp, kills: p.kills, alive: p.alive,
    };
}

wss.on('connection', (ws) => {
    const id = String(nextId++);
    const spawn = randSpawn();
    const player = {
        id, ws,
        name: 'Tank-' + id,
        x: spawn.x, y: 0, z: spawn.z,
        rotY: 0, turretY: 0, charge: 0,
        hp: PLAYER_MAX_HP, kills: 0, alive: true,
    };
    players.set(id, player);
    console.log('[+] Player ' + id + ' connected (' + players.size + ' online)');

    const others = [];
    for (const [, p] of players) {
        if (p.id !== id) others.push(publicPlayer(p));
    }
    send(ws, {
        type: 'welcome',
        id, name: player.name,
        spawn: { x: player.x, z: player.z },
        maxHp: PLAYER_MAX_HP,
        players: others,
    });

    broadcast({ type: 'join', player: publicPlayer(player) }, id);

    ws.on('message', (raw) => {
        let m;
        try { m = JSON.parse(raw.toString()); } catch { return; }
        const me = players.get(id);
        if (!me) return;

        switch (m.type) {
            case 'name': {
                const n = sanitizeName(m.name);
                if (!n) return;
                me.name = n;
                broadcast({ type: 'name', id, name: me.name });
                break;
            }
            case 'state': {
                if (!me.alive) return;
                if (typeof m.x === 'number') me.x = m.x;
                if (typeof m.y === 'number') me.y = m.y;
                if (typeof m.z === 'number') me.z = m.z;
                if (typeof m.rotY === 'number') me.rotY = m.rotY;
                if (typeof m.turretY === 'number') me.turretY = m.turretY;
                if (typeof m.charge === 'number') me.charge = Math.max(0, Math.min(1, m.charge));
                break;
            }
            case 'fire': {
                if (!me.alive) return;
                broadcast({
                    type: 'fire', id,
                    ox: m.ox, oy: m.oy, oz: m.oz,
                    dx: m.dx, dy: m.dy, dz: m.dz,
                    dmg: Math.max(0, Math.min(150, Number(m.dmg) || 0)),
                }, id);
                break;
            }
            case 'hit': {
                if (!me.alive) return;
                const targetId = String(m.targetId);
                if (targetId === id) return;
                const target = players.get(targetId);
                if (!target || !target.alive) return;
                const dmg = Math.max(0, Math.min(150, Number(m.dmg) || 0));
                if (dmg <= 0) return;

                target.hp -= dmg;
                if (target.hp <= 0) {
                    target.hp = 0;
                    target.alive = false;
                    me.kills += 1;
                    broadcast({
                        type: 'death',
                        id: target.id, victimName: target.name,
                        killerId: id, killerName: me.name,
                    });
                    broadcast({ type: 'kills', id, kills: me.kills });

                    setTimeout(() => {
                        const t = players.get(targetId);
                        if (!t) return;
                        const sp = randSpawn();
                        t.alive = true;
                        t.hp = PLAYER_MAX_HP;
                        t.x = sp.x; t.y = 0; t.z = sp.z;
                        t.rotY = 0; t.turretY = 0;
                        broadcast({
                            type: 'respawn',
                            id: t.id, x: t.x, z: t.z, hp: t.hp,
                        });
                    }, RESPAWN_MS);
                } else {
                    broadcast({
                        type: 'hp',
                        id: target.id, hp: target.hp,
                        shooterId: id, dmg,
                    });
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        players.delete(id);
        console.log('[-] Player ' + id + ' disconnected (' + players.size + ' online)');
        broadcast({ type: 'leave', id });
    });
});

setInterval(() => {
    if (players.size === 0) return;
    const states = [];
    for (const [, p] of players) {
        states.push({
            id: p.id, x: p.x, y: p.y, z: p.z,
            rotY: p.rotY, turretY: p.turretY,
            charge: p.charge, alive: p.alive,
        });
    }
    const msg = JSON.stringify({ type: 'states', players: states });
    for (const [, p] of players) {
        if (p.ws.readyState === 1) p.ws.send(msg);
    }
}, Math.round(1000 / STATE_HZ));

httpServer.listen(PORT, () => {
    console.log('Tank Assault server listening on http://localhost:' + PORT);
    console.log('Open that URL in multiple browsers/tabs to test multiplayer.');
});
