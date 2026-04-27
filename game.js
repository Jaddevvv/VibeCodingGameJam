// ============================================================
// TANK ASSAULT - Desert Storm
// A 3D tank combat game with charged laser mechanics
// ============================================================

(function () {
    'use strict';

    // ── Constants ────────────────────────────────────────────
    const MAP_SIZE = 300;
    const HALF_MAP = MAP_SIZE / 2;
    const TANK_SPEED = 18;
    const TANK_ROTATION_SPEED = 2.2;
    const TURRET_FOLLOW_SPEED = 6;
    const CHARGE_RATE = 0.35;          // 0→1 in ~2.8s
    const MAX_LASER_RANGE = 250;
    const MIN_LASER_DMG = 8;
    const MAX_LASER_DMG = 80;
    const PLAYER_MAX_HP = 100;
    const ENEMY_MAX_HP = 60;
    const ENEMY_FIRE_INTERVAL = 2.5;   // seconds between enemy shots
    const ENEMY_SHOT_DMG = 8;
    const ENEMY_SPEED = 10;
    const ENEMY_ROTATION_SPEED = 1.8;
    const SPAWN_DISTANCE_MIN = 60;
    const INITIAL_ENEMIES = 4;
    const LOOT_SPAWN_INTERVAL = 15;   // seconds between drops
    const LOOT_FALL_SPEED = 10;
    const LOOT_LAND_HEIGHT = 1.2;
    const LOOT_PICKUP_RANGE = 5;
    const BUFF_DURATION = 30;          // seconds for timed buffs
    const LOOT_TYPES = ['health', 'speed', 'shield', 'damage'];

    // ── Sniper mode ──────────────────────────────────────────
    const SNIPER_PLATFORM_TOP = 11;     // Y of walkway top surface
    const SNIPER_EYE_HEIGHT = 1.7;
    // Walkway sits OUTSIDE the boundary walls so no tanks are ever beneath it
    const SNIPER_INNER = 154;           // closest the sniper can get to the map (just outside walls at 150)
    const SNIPER_OUTER = 170;           // outermost edge of the walkway
    const SNIPER_WALK_SPEED = 14;
    const SNIPER_RUN_MULT = 1.6;
    const SNIPER_SCOPED_MOVE_MULT = 0.45;
    const SNIPER_DAMAGE = 120;          // one-shot most enemies
    const SNIPER_FIRE_COOLDOWN = 1.7;   // bolt-action cycle
    const SNIPER_MAG_SIZE = 5;
    const SNIPER_RELOAD_TIME = 2.4;
    const SNIPER_FOV_NORMAL = 60;
    const SNIPER_FOV_SCOPED = 14;
    const SNIPER_JUMP_VELOCITY = 8.5;
    const SNIPER_GRAVITY = 22;
    const SNIPER_CROUCH_LERP = 9;
    const SNIPER_CROUCH_HEIGHT_FACTOR = 0.5;   // crouched eye height as fraction of standing
    const SNIPER_3P_CAM_DIST = 4.5;

    // ── Colors ───────────────────────────────────────────────
    const COL = {
        sand:       0xC2A66B,
        sandDark:   0xA8915A,
        sandLight:  0xD4BC82,
        concrete:   0x9C9488,
        concreteDk: 0x7B7168,
        metal:      0x5A6650,
        metalDark:  0x3E4A38,
        metalLight: 0x6E7E64,
        barrel:     0x4A4A4A,
        track:      0x3A3A3A,
        enemy:      0x8B5A32,
        enemyDark:  0x5A3822,
        laser:      0xff3322,
        laserGlow:  0xff6644,
        sky:        0x8CAACC,
        fog:        0xC8B898,
        crate:      0x8B7355,
        crateDark:  0x6B5540,
    };

    // ── State ────────────────────────────────────────────────
    let scene, camera, renderer, clock;
    let playerTank, playerGroup;
    let enemies = [];
    let projectiles = [];
    let particles = [];
    let structures = [];       // collidable map objects {mesh, box}
    let laserBeams = [];
    let lootCrates = [];
    let lootSpawnTimer = 8;   // first drop after 8s
    let activeBuffs = { speed: 0, shield: 0, damage: 0 };
    let shieldMesh = null;
    let gameStarted = false;
    let gameOver = false;
    let kills = 0;
    let wave = 1;
    let enemiesPerWave = INITIAL_ENEMIES;

    // ── Multiplayer state ────────────────────────────────────
    let gameMode = null;           // 'coop' | 'multiplayer'
    let isMP = false;
    let ws = null;
    let myId = null;
    let myName = 'Tank';
    let stateSendTimer = 0;
    const STATE_SEND_INTERVAL = 1 / 15;   // 15Hz
    const remotePlayers = new Map();      // id -> remotePlayer
    let pendingDead = false;
    let respawnBannerEl = null;
    let respawnBannerTextEl = null;
    let respawnBannerSubEl = null;
    let playersPanelEl = null;
    let playersListEl = null;

    const keys = {};
    let mouseX = 0, mouseY = 0;
    let isCharging = false;
    let chargeAmount = 0;
    let pointerLocked = false;
    let turretTargetAngle = 0;
    let cameraPitch = 0.35;   // slight downward look
    let paused = false;
    let aimSensitivity = 0.003;
    const savedSens = parseFloat(localStorage.getItem('aimSensitivity'));
    if (!isNaN(savedSens) && savedSens > 0) aimSensitivity = savedSens;

    // ── Sniper mode state ────────────────────────────────────
    let isSniper = false;
    let sniperYaw = 0;
    let sniperPitch = 0;
    let sniperScoped = false;
    let sniperAmmo = SNIPER_MAG_SIZE;
    let sniperReloading = false;
    let sniperReloadTimer = 0;
    let sniperFireCooldown = 0;
    let sniperRunning = false;
    let sniperPlatformBuilt = false;
    let sniperPlatformMeshes = [];
    let rifleGroup = null;        // rifle held by avatar (3rd-person)
    let sniperHud = null;
    let sniperVy = 0;
    let sniperGrounded = true;
    let sniperCrouching = false;
    let crouchT = 0;              // 0 standing, 1 crouched (lerped)
    let walkPhase = 0;            // walk cycle radians
    let walkSwing = 0;             // amplitude (lerped 0..1 when moving)
    let boundaryWalls = [];        // map perimeter wall meshes (hidden in sniper mode)

    // HUD elements
    let hudCharge, hudHealth, hudHealthText, hudScore, hudWave, hudKillfeed, hudDamageFlash;
    let minimapCtx;

    // ── Scene Setup ──────────────────────────────────────────
    function initScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(COL.sky);
        scene.fog = new THREE.Fog(COL.fog, 30, 280);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        document.body.prepend(renderer.domElement);

        // Camera (3rd person)
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 500);

        // Lighting - harsh desert sun
        const sunLight = new THREE.DirectionalLight(0xFFF4D6, 2.2);
        sunLight.position.set(80, 120, 60);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 300;
        sunLight.shadow.bias = -0.001;
        scene.add(sunLight);

        const ambientLight = new THREE.AmbientLight(0xD4C4A0, 0.7);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xFFF8E8, 0x8B7355, 0.5);
        scene.add(hemiLight);

        clock = new THREE.Clock();

        window.addEventListener('resize', onResize);
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ── Terrain ──────────────────────────────────────────────
    function makeSandTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base sand color
        ctx.fillStyle = '#B89B6A';
        ctx.fillRect(0, 0, 512, 512);

        // Sand grain noise
        for (let i = 0; i < 60000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const brightness = 150 + Math.random() * 80;
            const r = brightness + 20;
            const g = brightness - 10;
            const b = brightness - 60;
            ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.3)`;
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }

        // Larger sand patches
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 5 + Math.random() * 20;
            const brightness = 160 + Math.random() * 50;
            ctx.fillStyle = `rgba(${brightness + 30|0},${brightness|0},${brightness - 50|0},0.15)`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(12, 12);
        return tex;
    }

    function createTerrain() {
        // Ground plane — extended past the boundary walls so the outside-the-map
        // sniper platform sits over visible desert, not void.
        const GROUND_SIZE = MAP_SIZE + 120;
        const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 100, 100);
        groundGeo.rotateX(-Math.PI / 2);

        // Subtle height variation
        const verts = groundGeo.attributes.position;
        for (let i = 0; i < verts.count; i++) {
            const x = verts.getX(i);
            const z = verts.getZ(i);
            const h = Math.sin(x * 0.03) * Math.cos(z * 0.02) * 1.2
                    + Math.sin(x * 0.07 + z * 0.05) * 0.5
                    + Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.3;
            verts.setY(i, h);
        }
        groundGeo.computeVertexNormals();

        const sandTex = makeSandTexture();
        const groundMat = new THREE.MeshStandardMaterial({
            map: sandTex,
            color: COL.sand,
            roughness: 0.95,
            metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.receiveShadow = true;
        scene.add(ground);

        // Boundary walls (tall concrete)
        const wallTex = makeConcreteTexture();
        const wallMat = new THREE.MeshStandardMaterial({
            map: wallTex, color: COL.concreteDk, roughness: 0.9, metalness: 0.05
        });
        const wallH = 10, wallThick = 3;
        const sides = [
            { pos: [0, wallH / 2, -HALF_MAP], size: [MAP_SIZE, wallH, wallThick] },
            { pos: [0, wallH / 2,  HALF_MAP], size: [MAP_SIZE, wallH, wallThick] },
            { pos: [-HALF_MAP, wallH / 2, 0], size: [wallThick, wallH, MAP_SIZE] },
            { pos: [ HALF_MAP, wallH / 2, 0], size: [wallThick, wallH, MAP_SIZE] },
        ];
        sides.forEach(s => {
            const geo = new THREE.BoxGeometry(...s.size);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(...s.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            boundaryWalls.push(mesh);
        });
    }

    function makeConcreteTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#908070';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 15000; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const v = 100 + Math.random() * 80;
            ctx.fillStyle = `rgba(${v|0},${v - 5|0},${v - 10|0},0.25)`;
            ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
        }
        // Cracks
        ctx.strokeStyle = 'rgba(60,50,40,0.15)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            let x = Math.random() * 256, y = Math.random() * 256;
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += (Math.random() - 0.5) * 40;
                y += (Math.random() - 0.5) * 40;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        return tex;
    }

    // ── Map Structures (Dust-style) ─────────────────────────
    function createMap() {
        const conTex = makeConcreteTexture();
        const concreteMat = new THREE.MeshStandardMaterial({
            map: conTex, color: COL.concrete, roughness: 0.85, metalness: 0.05
        });
        const concreteDkMat = new THREE.MeshStandardMaterial({
            map: conTex, color: COL.concreteDk, roughness: 0.9, metalness: 0.05
        });
        const crateMat = new THREE.MeshStandardMaterial({
            color: COL.crate, roughness: 0.75, metalness: 0.0
        });
        const sandWallMat = new THREE.MeshStandardMaterial({
            map: makeSandTexture(), color: COL.sandDark, roughness: 0.9, metalness: 0.0
        });

        function addBox(w, h, d, x, y, z, mat) {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            const box = new THREE.Box3().setFromObject(mesh);
            structures.push({ mesh, box });
            return mesh;
        }

        function addCylinder(rTop, rBot, h, x, y, z, mat) {
            const geo = new THREE.CylinderGeometry(rTop, rBot, h, 12);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            const box = new THREE.Box3().setFromObject(mesh);
            structures.push({ mesh, box });
            return mesh;
        }

        // === Central compound - "Mid" ===
        // Main building
        addBox(20, 10, 16, 0, 5, 0, concreteMat);
        addBox(22, 1, 18, 0, 10.5, 0, concreteDkMat); // roof overhang

        // Pillars around mid building
        addCylinder(0.8, 1, 10, -12, 5, -9, concreteDkMat);
        addCylinder(0.8, 1, 10,  12, 5, -9, concreteDkMat);
        addCylinder(0.8, 1, 10, -12, 5,  9, concreteDkMat);
        addCylinder(0.8, 1, 10,  12, 5,  9, concreteDkMat);

        // === "Long A" path - East side ===
        // Long wall
        addBox(3, 7, 50, 50, 3.5, -20, sandWallMat);
        addBox(3, 7, 50, 50, 3.5,  40, sandWallMat);
        // Platform
        addBox(18, 3, 12, 55, 1.5, 10, concreteMat);
        // Crates on platform
        addBox(3, 3, 3, 50, 4.5, 8, crateMat);
        addBox(3, 3, 3, 53, 4.5, 12, crateMat);
        addBox(2.5, 2.5, 2.5, 51, 7, 10, crateMat);

        // Corner building
        addBox(16, 12, 16, 70, 6, -60, concreteMat);
        addBox(18, 1, 18, 70, 12.5, -60, concreteDkMat);

        // === "B Tunnels" - West side ===
        // Tunnel walls
        addBox(40, 8, 3, -50, 4, -30, sandWallMat);
        addBox(40, 8, 3, -50, 4, -15, sandWallMat);
        // Roof over tunnel
        addBox(42, 1, 18, -50, 8.5, -22.5, concreteDkMat);

        // B site boxes
        addBox(5, 4, 5, -60, 2, -50, crateMat);
        addBox(4, 3, 4, -55, 1.5, -55, crateMat);
        addBox(5, 4, 5, -70, 2, -45, crateMat);

        // === Scattered cover ===
        // South area
        addBox(12, 5, 3, -20, 2.5, 50, sandWallMat);
        addBox(3, 5, 12, -30, 2.5, 55, sandWallMat);
        addBox(8, 4, 8, 20, 2, 60, concreteMat);

        // North area
        addBox(15, 6, 3, 30, 3, -50, sandWallMat);
        addBox(3, 6, 15, 38, 3, -55, sandWallMat);

        // Mid-field cover
        addBox(4, 3, 4, -25, 1.5, 15, crateMat);
        addBox(4, 3, 4, 25, 1.5, -15, crateMat);
        addBox(6, 4, 3, -10, 2, -40, sandWallMat);
        addBox(3, 4, 6, 15, 2, 35, sandWallMat);

        // Large ruins - NW
        addBox(10, 8, 3, -80, 4, -80, concreteMat);
        addBox(3, 8, 10, -76, 4, -76, concreteMat);
        addBox(3, 8, 10, -84, 4, -76, concreteMat);

        // Large ruins - SE
        addBox(10, 8, 3, 80, 4, 80, concreteMat);
        addBox(3, 8, 10, 76, 4, 76, concreteMat);

        // Barrels
        addCylinder(1.2, 1.2, 3, -15, 1.5, -25, concreteDkMat);
        addCylinder(1.2, 1.2, 3, -13, 1.5, -24, concreteDkMat);
        addCylinder(1.2, 1.2, 3, 35, 1.5, 25, concreteDkMat);
        addCylinder(1.2, 1.2, 3, 37, 1.5, 26, concreteDkMat);

        // Extra cover elements
        addBox(8, 3, 2, 0, 1.5, 30, sandWallMat);
        addBox(2, 3, 8, -40, 1.5, 0, sandWallMat);
        addBox(2, 3, 8, 40, 1.5, 0, sandWallMat);

        // Dust piles (low mounds)
        for (let i = 0; i < 12; i++) {
            const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            const r = 2 + Math.random() * 3;
            const geo = new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                color: COL.sandLight, roughness: 1, metalness: 0
            }));
            mesh.position.set(x, 0, z);
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
    }

    // ── Tank Builder ─────────────────────────────────────────
    function createTankModel(isEnemy) {
        const group = new THREE.Group();

        const hullColor = isEnemy ? COL.enemy : COL.metal;
        const hullDarkColor = isEnemy ? COL.enemyDark : COL.metalDark;

        const hullMat = new THREE.MeshStandardMaterial({
            color: hullColor, roughness: 0.55, metalness: 0.45
        });
        const hullDkMat = new THREE.MeshStandardMaterial({
            color: hullDarkColor, roughness: 0.65, metalness: 0.35
        });
        const barrelMat = new THREE.MeshStandardMaterial({
            color: COL.barrel, roughness: 0.35, metalness: 0.65
        });
        const trackMat = new THREE.MeshStandardMaterial({
            color: COL.track, roughness: 0.9, metalness: 0.2
        });

        // ─ Hull - low wide shape with angled front (Abrams-style)
        // Lower hull body
        const lowerHullGeo = new THREE.BoxGeometry(4.6, 1.0, 6.2);
        lowerHullGeo.translate(0, 0, 0.2);
        const lowerHull = new THREE.Mesh(lowerHullGeo, hullDkMat);
        lowerHull.position.y = 0.9;
        lowerHull.castShadow = true;
        group.add(lowerHull);

        // Upper hull (narrower, sits on top)
        const upperHullGeo = new THREE.BoxGeometry(4.0, 0.7, 5.6);
        upperHullGeo.translate(0, 0, 0.3);
        const upperHull = new THREE.Mesh(upperHullGeo, hullMat);
        upperHull.position.y = 1.75;
        upperHull.castShadow = true;
        group.add(upperHull);

        // Front glacis plate (angled armor)
        const glacisGeo = new THREE.BoxGeometry(4.0, 1.2, 1.8);
        const glacis = new THREE.Mesh(glacisGeo, hullMat);
        glacis.position.set(0, 1.5, -3.2);
        glacis.rotation.x = -0.55;
        glacis.castShadow = true;
        group.add(glacis);

        // Lower front plate
        const lowerFrontGeo = new THREE.BoxGeometry(4.4, 0.8, 0.8);
        const lowerFront = new THREE.Mesh(lowerFrontGeo, hullDkMat);
        lowerFront.position.set(0, 0.9, -3.3);
        lowerFront.rotation.x = -0.3;
        lowerFront.castShadow = true;
        group.add(lowerFront);

        // Rear engine deck (flat, grilled look) — sits on top of upper hull
        const rearGeo = new THREE.BoxGeometry(4.2, 0.4, 1.8);
        const rear = new THREE.Mesh(rearGeo, hullDkMat);
        rear.position.set(0, 2.3, 3.2);
        rear.castShadow = true;
        group.add(rear);

        // Engine exhaust vents — sit on top of rear deck
        for (let x = -1; x <= 1; x += 2) {
            const ventGeo = new THREE.BoxGeometry(1.2, 0.12, 1.0);
            const vent = new THREE.Mesh(ventGeo, new THREE.MeshStandardMaterial({
                color: 0x2A2A2A, roughness: 0.8, metalness: 0.4
            }));
            vent.position.set(x * 1.1, 2.55, 3.3);
            group.add(vent);
        }

        // ─ Tracks (left & right) - rounded profile using multiple parts
        for (let side = -1; side <= 1; side += 2) {
            const xOff = side * 2.55;

            // Track body
            const trackBodyGeo = new THREE.BoxGeometry(0.7, 1.4, 6.6);
            const trackBody = new THREE.Mesh(trackBodyGeo, trackMat);
            trackBody.position.set(xOff, 0.7, 0);
            trackBody.castShadow = true;
            group.add(trackBody);

            // Track top plate
            const topPlateGeo = new THREE.BoxGeometry(0.75, 0.15, 6.6);
            const topPlate = new THREE.Mesh(topPlateGeo, trackMat);
            topPlate.position.set(xOff, 1.45, 0);
            group.add(topPlate);

            // Front drive sprocket (rounded)
            const frontWheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.65, 12);
            frontWheelGeo.rotateZ(Math.PI / 2);
            const frontWheel = new THREE.Mesh(frontWheelGeo, hullDkMat);
            frontWheel.position.set(xOff, 0.6, -3.1);
            group.add(frontWheel);

            // Rear idler
            const rearWheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.65, 12);
            rearWheelGeo.rotateZ(Math.PI / 2);
            const rearWheel = new THREE.Mesh(rearWheelGeo, hullDkMat);
            rearWheel.position.set(xOff, 0.55, 3.1);
            group.add(rearWheel);

            // Road wheels (6 per side)
            for (let i = 0; i < 6; i++) {
                const z = -2.4 + i * 1.0;
                const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.5, 12);
                wheelGeo.rotateZ(Math.PI / 2);
                const wheel = new THREE.Mesh(wheelGeo, hullDkMat);
                wheel.position.set(xOff, 0.45, z);
                group.add(wheel);

                // Wheel hub detail
                const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.55, 6);
                hubGeo.rotateZ(Math.PI / 2);
                const hub = new THREE.Mesh(hubGeo, barrelMat);
                hub.position.set(xOff, 0.45, z);
                group.add(hub);
            }

            // Side skirt armor
            const skirtGeo = new THREE.BoxGeometry(0.12, 0.9, 5.8);
            const skirt = new THREE.Mesh(skirtGeo, hullMat);
            skirt.position.set(side * 2.95, 1.1, 0);
            skirt.castShadow = true;
            group.add(skirt);

            // Mud flap / fender — raised to sit above the track top plate
            const fenderGeo = new THREE.BoxGeometry(0.8, 0.1, 6.8);
            const fender = new THREE.Mesh(fenderGeo, hullDkMat);
            fender.position.set(xOff, 1.65, 0);
            group.add(fender);
        }

        // ─ Hull top details
        // Driver's hatch (front left)
        const driverHatchGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 10);
        const driverHatch = new THREE.Mesh(driverHatchGeo, hullDkMat);
        driverHatch.position.set(-0.8, 2.15, -1.5);
        group.add(driverHatch);

        // Tool stowage on hull side
        const toolGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6);
        toolGeo.rotateX(Math.PI / 2);
        const tool = new THREE.Mesh(toolGeo, barrelMat);
        tool.position.set(2.1, 2.0, 1.5);
        group.add(tool);

        // Tow cables (front)
        for (let x = -1; x <= 1; x += 2) {
            const cableGeo = new THREE.TorusGeometry(0.3, 0.06, 6, 12, Math.PI);
            const cable = new THREE.Mesh(cableGeo, barrelMat);
            cable.position.set(x * 1.5, 1.3, -3.6);
            cable.rotation.y = Math.PI / 2;
            group.add(cable);
        }

        // ─ Turret (rotates independently)
        const turretGroup = new THREE.Group();
        turretGroup.position.y = 2.35;

        // Turret base ring
        const turretRingGeo = new THREE.CylinderGeometry(1.85, 1.9, 0.2, 24);
        const turretRing = new THREE.Mesh(turretRingGeo, hullDkMat);
        turretRing.position.y = 0;
        turretGroup.add(turretRing);

        // Main turret body (wider at base, narrower at top - using lathe)
        const turretProfile = [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(1.8, 0),
            new THREE.Vector2(1.85, 0.15),
            new THREE.Vector2(1.8, 0.4),
            new THREE.Vector2(1.6, 0.7),
            new THREE.Vector2(1.35, 0.95),
            new THREE.Vector2(1.1, 1.1),
            new THREE.Vector2(0.7, 1.2),
            new THREE.Vector2(0, 1.25),
        ];
        const turretGeo = new THREE.LatheGeometry(turretProfile, 24);
        const turretBody = new THREE.Mesh(turretGeo, hullMat);
        turretBody.position.y = 0.1;
        turretBody.castShadow = true;
        turretGroup.add(turretBody);

        // Turret bustle (rear overhang for ammo/counterweight)
        const bustleGeo = new THREE.BoxGeometry(2.4, 0.9, 1.8);
        const bustle = new THREE.Mesh(bustleGeo, hullMat);
        bustle.position.set(0, 0.55, 1.6);
        bustle.castShadow = true;
        turretGroup.add(bustle);

        // Bustle rack (cage armor at rear)
        const rackGeo = new THREE.BoxGeometry(2.6, 0.7, 0.1);
        const rack = new THREE.Mesh(rackGeo, barrelMat);
        rack.position.set(0, 0.5, 2.55);
        turretGroup.add(rack);

        // Commander's cupola
        const cupolaGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.35, 12);
        const cupola = new THREE.Mesh(cupolaGeo, hullDkMat);
        cupola.position.set(0.5, 1.35, 0.4);
        cupola.castShadow = true;
        turretGroup.add(cupola);

        // Loader's hatch
        const loaderHatchGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10);
        const loaderHatch = new THREE.Mesh(loaderHatchGeo, hullDkMat);
        loaderHatch.position.set(-0.5, 1.28, 0.4);
        turretGroup.add(loaderHatch);

        // Smoke launcher banks (each side of turret)
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 4; i++) {
                const launcherGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
                launcherGeo.rotateX(Math.PI / 2);
                const launcher = new THREE.Mesh(launcherGeo, barrelMat);
                launcher.position.set(side * 1.65, 0.5 + i * 0.18, -0.4);
                launcher.rotation.y = side * 0.3;
                turretGroup.add(launcher);
            }
        }

        // Antenna
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 4);
        const antenna = new THREE.Mesh(antennaGeo, barrelMat);
        antenna.position.set(-0.8, 2.8, 1.2);
        turretGroup.add(antenna);

        // ─ Main gun barrel
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.55, 0);

        // Barrel mantlet (housing where barrel meets turret)
        const mantletGeo = new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        mantletGeo.rotateX(Math.PI / 2);
        const mantlet = new THREE.Mesh(mantletGeo, hullDkMat);
        mantlet.position.set(0, 0, -1.2);
        mantlet.castShadow = true;
        barrelGroup.add(mantlet);

        // Main barrel tube - long smooth cylinder
        const mainBarrelGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 16);
        mainBarrelGeo.rotateX(Math.PI / 2);
        mainBarrelGeo.translate(0, 0, -4.2);
        const mainBarrel = new THREE.Mesh(mainBarrelGeo, barrelMat);
        mainBarrel.castShadow = true;
        barrelGroup.add(mainBarrel);

        // Thermal sleeve (thicker mid-section)
        const sleeveGeo = new THREE.CylinderGeometry(0.26, 0.26, 4, 14);
        sleeveGeo.rotateX(Math.PI / 2);
        sleeveGeo.translate(0, 0, -3.5);
        const sleeve = new THREE.Mesh(sleeveGeo, hullDkMat);
        barrelGroup.add(sleeve);

        // Bore evacuator (bulge near end)
        const evacuatorGeo = new THREE.SphereGeometry(0.32, 10, 8);
        evacuatorGeo.scale(1, 1, 1.5);
        const evacuator = new THREE.Mesh(evacuatorGeo, barrelMat);
        evacuator.position.set(0, 0, -5.8);
        barrelGroup.add(evacuator);

        // Muzzle brake
        const muzzleGeo = new THREE.CylinderGeometry(0.3, 0.22, 0.6, 12);
        muzzleGeo.rotateX(Math.PI / 2);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.position.set(0, 0, -7.8);
        barrelGroup.add(muzzle);

        // Muzzle reference sensor
        const sensorGeo = new THREE.BoxGeometry(0.06, 0.06, 0.4);
        const sensor = new THREE.Mesh(sensorGeo, barrelMat);
        sensor.position.set(0, 0.3, -6.5);
        barrelGroup.add(sensor);

        // Coax MG (small barrel next to main gun)
        const coaxGeo = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
        coaxGeo.rotateX(Math.PI / 2);
        coaxGeo.translate(0, 0, -2.2);
        const coax = new THREE.Mesh(coaxGeo, barrelMat);
        coax.position.set(0.4, -0.1, 0);
        barrelGroup.add(coax);

        turretGroup.add(barrelGroup);
        group.add(turretGroup);

        // Charge glow point (at muzzle)
        const glowGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: COL.laser, transparent: true, opacity: 0
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0, 0, -8.1);
        barrelGroup.add(glow);

        group.userData = {
            turret: turretGroup,
            barrel: barrelGroup,
            glow: glow,
            glowMat: glowMat,
        };

        return group;
    }

    // ── Player Tank ──────────────────────────────────────────
    function createPlayer(spawnX, spawnZ) {
        playerGroup = createTankModel(false);
        const sx = (typeof spawnX === 'number') ? spawnX : 0;
        const sz = (typeof spawnZ === 'number') ? spawnZ : 80;
        playerGroup.position.set(sx, 0, sz);
        scene.add(playerGroup);

        playerTank = {
            group: playerGroup,
            hp: PLAYER_MAX_HP,
            maxHp: PLAYER_MAX_HP,
            speed: TANK_SPEED,
            velocity: new THREE.Vector3(),
        };
    }

    // ── Enemy Tanks ──────────────────────────────────────────
    function spawnEnemy() {
        let x, z, dist;
        const playerPos = playerGroup.position;
        // Find a spawn position that's not too close and not inside structures
        do {
            if (isSniper) {
                // Spread tanks across the whole map (player is outside the map)
                x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
                z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            } else {
                const angle = Math.random() * Math.PI * 2;
                dist = SPAWN_DISTANCE_MIN + Math.random() * 60;
                x = playerPos.x + Math.cos(angle) * dist;
                z = playerPos.z + Math.sin(angle) * dist;
            }
            x = Math.max(-HALF_MAP + 10, Math.min(HALF_MAP - 10, x));
            z = Math.max(-HALF_MAP + 10, Math.min(HALF_MAP - 10, z));
        } while (isInsideStructure(x, z));

        const group = createTankModel(true);
        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        scene.add(group);

        const enemy = {
            group: group,
            hp: ENEMY_MAX_HP + wave * 5,
            maxHp: ENEMY_MAX_HP + wave * 5,
            speed: ENEMY_SPEED + wave * 0.5,
            state: 'patrol',
            patrolTarget: new THREE.Vector3(
                (Math.random() - 0.5) * MAP_SIZE * 0.7,
                0,
                (Math.random() - 0.5) * MAP_SIZE * 0.7
            ),
            fireTimer: Math.random() * ENEMY_FIRE_INTERVAL,
            stuckTimer: 0,
            lastPos: new THREE.Vector3(x, 0, z),
            patrolRetargetTimer: 1 + Math.random() * 3,
        };
        enemies.push(enemy);
    }

    function isInsideStructure(x, z) {
        const testPoint = new THREE.Vector3(x, 1, z);
        for (const s of structures) {
            if (s.box.containsPoint(testPoint)) return true;
        }
        return false;
    }

    // ── Laser System ─────────────────────────────────────────
    function fireLaser(origin, direction, damage, isPlayer) {
        const raycaster = new THREE.Raycaster(origin, direction, 0, MAX_LASER_RANGE);

        // Collect targets
        const targets = [];
        if (isPlayer) {
            enemies.forEach(e => {
                e.group.traverse(c => { if (c.isMesh) targets.push(c); });
            });
        } else {
            playerGroup.traverse(c => { if (c.isMesh) targets.push(c); });
        }
        // Also hit structures
        structures.forEach(s => targets.push(s.mesh));

        const hits = raycaster.intersectObjects(targets, false);
        let hitPoint = origin.clone().add(direction.clone().multiplyScalar(MAX_LASER_RANGE));
        let hitSomething = false;

        if (hits.length > 0) {
            hitPoint = hits[0].point.clone();
            const hitObj = hits[0].object;

            // Check if it's an enemy
            if (isPlayer) {
                for (const enemy of enemies) {
                    let isThisEnemy = false;
                    enemy.group.traverse(c => {
                        if (c === hitObj) isThisEnemy = true;
                    });
                    if (isThisEnemy) {
                        enemy.hp -= damage;
                        spawnHitParticles(hitPoint, COL.laserGlow, 12);
                        if (enemy.hp <= 0) {
                            destroyEnemy(enemy);
                        }
                        hitSomething = true;
                        break;
                    }
                }
            } else {
                // Enemy hit player
                let isPlayerHit = false;
                playerGroup.traverse(c => {
                    if (c === hitObj) isPlayerHit = true;
                });
                if (isPlayerHit) {
                    // Shield absorbs 80% of damage
                    const actualDmg = activeBuffs.shield > 0 ? damage * 0.2 : damage;
                    playerTank.hp -= actualDmg;
                    flashDamage();
                    spawnHitParticles(hitPoint, COL.laserGlow, 8);
                    hitSomething = true;
                    if (playerTank.hp <= 0) {
                        endGame();
                    }
                }
            }

            if (!hitSomething) {
                // Hit a structure
                spawnHitParticles(hitPoint, 0xCCBB99, 6);
            }
        }

        // Create beam visual
        createLaserBeam(origin, hitPoint, damage / MAX_LASER_DMG);
    }

    function createLaserBeam(from, to, intensity) {
        const dist = from.distanceTo(to);
        const dir = new THREE.Vector3().subVectors(to, from).normalize();
        const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);

        const thickness = 0.08 + intensity * 0.15;
        const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 6);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: COL.laser,
            transparent: true,
            opacity: 0.9,
        });
        const beam = new THREE.Mesh(geo, mat);
        beam.position.copy(mid);
        beam.lookAt(to);
        scene.add(beam);

        // Glow beam (wider, fainter)
        const glowGeo = new THREE.CylinderGeometry(thickness * 3, thickness * 3, dist, 6);
        glowGeo.rotateX(Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({
            color: COL.laserGlow,
            transparent: true,
            opacity: 0.25,
        });
        const glowBeam = new THREE.Mesh(glowGeo, glowMat);
        glowBeam.position.copy(mid);
        glowBeam.lookAt(to);
        scene.add(glowBeam);

        laserBeams.push({ beam, glowBeam, mat, glowMat, life: 0.25 });
    }

    function updateLaserBeams(dt) {
        for (let i = laserBeams.length - 1; i >= 0; i--) {
            const lb = laserBeams[i];
            lb.life -= dt;
            const alpha = Math.max(0, lb.life / 0.25);
            lb.mat.opacity = alpha * 0.9;
            lb.glowMat.opacity = alpha * 0.25;
            if (lb.life <= 0) {
                scene.remove(lb.beam);
                scene.remove(lb.glowBeam);
                lb.beam.geometry.dispose();
                lb.glowBeam.geometry.dispose();
                lb.mat.dispose();
                lb.glowMat.dispose();
                laserBeams.splice(i, 1);
            }
        }
    }

    // ── Particles ────────────────────────────────────────────
    function spawnHitParticles(position, color, count) {
        for (let i = 0; i < count; i++) {
            const size = 0.1 + Math.random() * 0.25;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            scene.add(mesh);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                Math.random() * 8,
                (Math.random() - 0.5) * 12
            );
            particles.push({ mesh, mat, vel, life: 0.4 + Math.random() * 0.3 });
        }
    }

    function spawnExplosion(position) {
        // Fire particles
        for (let i = 0; i < 25; i++) {
            const size = 0.2 + Math.random() * 0.5;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const isFlame = Math.random() > 0.4;
            const mat = new THREE.MeshBasicMaterial({
                color: isFlame ? 0xFF6622 : 0x444444,
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            scene.add(mesh);

            const speed = 5 + Math.random() * 15;
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                Math.random() * speed * 0.8,
                (Math.random() - 0.5) * speed
            );
            particles.push({ mesh, mat, vel, life: 0.5 + Math.random() * 0.8 });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            p.vel.y -= 15 * dt; // gravity
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            p.mat.opacity = Math.max(0, p.life / 0.8);

            if (p.life <= 0 || p.mesh.position.y < -1) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                particles.splice(i, 1);
            }
        }
    }

    // ── Loot System ────────────────────────────────────────────
    function createLootCrate() {
        const group = new THREE.Group();

        // Mystery crate - olive/brown generic package
        const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x556644, roughness: 0.7, metalness: 0.1
        });
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.castShadow = true;
        group.add(crate);

        // Cross straps on crate
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x3A3A2A, roughness: 0.8 });
        const strapH = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.2), strapMat);
        strapH.position.y = 0.3;
        group.add(strapH);
        const strapV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 1.5), strapMat);
        strapV.position.y = 0.3;
        group.add(strapV);

        // Question mark indicator (small floating sphere)
        const markerGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const markerMat = new THREE.MeshBasicMaterial({
            color: 0xFFCC00, transparent: true, opacity: 0.8
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.y = 1.2;
        group.add(marker);

        // Parachute (half-sphere, dome facing up)
        const chuteGeo = new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const chuteMat = new THREE.MeshStandardMaterial({
            color: 0xEEDDCC, roughness: 0.6, metalness: 0.0,
            side: THREE.DoubleSide, transparent: true, opacity: 0.85
        });
        const chute = new THREE.Mesh(chuteGeo, chuteMat);
        chute.position.y = 5;
        group.add(chute);

        // Parachute cords — from crate attachment points up to parachute rim
        const cordMat = new THREE.MeshBasicMaterial({ color: 0x887766 });
        const cordList = [];
        const upAxis = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const start = new THREE.Vector3(Math.cos(angle) * 0.7, 0.6, Math.sin(angle) * 0.7);
            const end = new THREE.Vector3(Math.cos(angle) * 2.5, 5, Math.sin(angle) * 2.5);
            const dir = end.clone().sub(start);
            const len = dir.length();
            const cordGeo = new THREE.CylinderGeometry(0.025, 0.025, len, 4);
            const cord = new THREE.Mesh(cordGeo, cordMat);
            cord.position.copy(start).add(end).multiplyScalar(0.5);
            cord.quaternion.setFromUnitVectors(upAxis, dir.normalize());
            group.add(cord);
            cordList.push(cord);
        }

        group.userData = {
            chute, marker, markerMat,
            cords: cordList,
        };

        return group;
    }

    function spawnLootDrop() {
        const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
        const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;

        // Don't spawn inside structures
        if (isInsideStructure(x, z)) return;

        const group = createLootCrate();
        const spawnY = 60 + Math.random() * 20;
        group.position.set(x, spawnY, z);
        scene.add(group);

        const type = LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)];

        lootCrates.push({
            group,
            type,
            falling: true,
            landed: false,
            landedTime: 0,
            bobPhase: Math.random() * Math.PI * 2,
        });

        addKillfeedEntry('Supply drop incoming!');
    }

    function updateLootCrates(dt) {
        const playerPos = playerGroup ? playerGroup.position : null;

        for (let i = lootCrates.length - 1; i >= 0; i--) {
            const loot = lootCrates[i];
            const g = loot.group;

            if (loot.falling) {
                // Fall with parachute
                g.position.y -= LOOT_FALL_SPEED * dt;

                // Gentle sway
                g.position.x += Math.sin(Date.now() * 0.001 + i) * 0.02;
                g.position.z += Math.cos(Date.now() * 0.0013 + i) * 0.02;

                // Slow rotation while falling
                g.rotation.y += 0.3 * dt;

                if (g.position.y <= LOOT_LAND_HEIGHT) {
                    g.position.y = LOOT_LAND_HEIGHT;
                    loot.falling = false;
                    loot.landed = true;

                    // Remove parachute
                    const ud = g.userData;
                    if (ud.chute) {
                        g.remove(ud.chute);
                        ud.chute.geometry.dispose();
                        ud.chute.material.dispose();
                        ud.chute = null;
                    }
                    // Remove cords
                    if (ud.cords) {
                        ud.cords.forEach(c => {
                            g.remove(c);
                            if (c.geometry) c.geometry.dispose();
                            if (c.material) c.material.dispose();
                        });
                        ud.cords = [];
                    }
                }
            }

            if (loot.landed) {
                // Bob and glow to attract attention
                loot.bobPhase += dt * 3;
                g.position.y = LOOT_LAND_HEIGHT + Math.sin(loot.bobPhase) * 0.3;
                g.rotation.y += 1.2 * dt;

                // Pulse the marker
                const ud = g.userData;
                if (ud.markerMat) {
                    ud.markerMat.opacity = 0.5 + Math.sin(loot.bobPhase * 2) * 0.3;
                }

                // Check pickup
                if (playerPos) {
                    const dist = new THREE.Vector2(
                        g.position.x - playerPos.x,
                        g.position.z - playerPos.z
                    ).length();

                    if (dist < LOOT_PICKUP_RANGE) {
                        applyLoot(loot.type);
                        scene.remove(g);
                        lootCrates.splice(i, 1);
                        continue;
                    }
                }

                // Despawn after 45 seconds on ground
                loot.landedTime += dt;
                if (loot.landedTime > 45) {
                    scene.remove(g);
                    lootCrates.splice(i, 1);
                }
            }
        }

        // Spawn timer
        lootSpawnTimer -= dt;
        if (lootSpawnTimer <= 0) {
            spawnLootDrop();
            lootSpawnTimer = LOOT_SPAWN_INTERVAL - Math.min(wave * 0.5, 5);
        }
    }

    function applyLoot(type) {
        const popup = document.getElementById('loot-popup');
        let msg = '';

        switch (type) {
            case 'health':
                const heal = playerTank.maxHp * 0.2;
                playerTank.hp = Math.min(playerTank.maxHp, playerTank.hp + heal);
                msg = '+20% HEALTH';
                spawnHitParticles(playerGroup.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x44ff44, 15);
                break;

            case 'speed':
                activeBuffs.speed = BUFF_DURATION;
                msg = 'SPEED BOOST x1.5';
                spawnHitParticles(playerGroup.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x44ccff, 15);
                break;

            case 'shield':
                activeBuffs.shield = BUFF_DURATION;
                msg = 'SHIELD ACTIVATED';
                createShieldVisual();
                spawnHitParticles(playerGroup.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x44ffaa, 15);
                break;

            case 'damage':
                activeBuffs.damage = BUFF_DURATION;
                msg = '+20% DAMAGE';
                spawnHitParticles(playerGroup.position.clone().add(new THREE.Vector3(0, 3, 0)), 0xff6644, 15);
                break;
        }

        // Show pickup notification
        popup.textContent = msg;
        popup.style.opacity = '1';
        setTimeout(() => { popup.style.opacity = '0'; }, 2000);

        addKillfeedEntry('Picked up: ' + msg);
    }

    function updateBuffs(dt) {
        if (activeBuffs.speed > 0) {
            activeBuffs.speed -= dt;
            if (activeBuffs.speed <= 0) {
                activeBuffs.speed = 0;
                addKillfeedEntry('Speed boost expired');
            }
        }
        if (activeBuffs.shield > 0) {
            activeBuffs.shield -= dt;
            if (activeBuffs.shield <= 0) {
                activeBuffs.shield = 0;
                removeShieldVisual();
                addKillfeedEntry('Shield expired');
            }
        }
        if (activeBuffs.damage > 0) {
            activeBuffs.damage -= dt;
            if (activeBuffs.damage <= 0) {
                activeBuffs.damage = 0;
                addKillfeedEntry('Damage boost expired');
            }
        }

        // Update shield visual position
        if (shieldMesh && playerGroup) {
            shieldMesh.position.copy(playerGroup.position);
            shieldMesh.position.y = 1.8;
            shieldMesh.rotation.y += dt * 0.5;

            // Pulse opacity
            const pulse = 0.15 + Math.sin(Date.now() * 0.003) * 0.05;
            shieldMesh.material.opacity = pulse;

            // Flash when about to expire
            if (activeBuffs.shield > 0 && activeBuffs.shield < 5) {
                shieldMesh.material.opacity = Math.sin(Date.now() * 0.01) > 0 ? 0.25 : 0.05;
            }
        }

        // Update buff HUD
        updateBuffHUD();
    }

    function createShieldVisual() {
        removeShieldVisual();

        const shieldGeo = new THREE.SphereGeometry(5, 24, 16);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x44ffaa,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            wireframe: false,
        });
        shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        shieldMesh.position.copy(playerGroup.position);
        shieldMesh.position.y = 1.8;
        scene.add(shieldMesh);

        // Inner wireframe ring for extra visual
        const ringGeo = new THREE.TorusGeometry(4.8, 0.08, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44ffaa, transparent: true, opacity: 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.5;
        shieldMesh.add(ring);

        // Second ring higher
        const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 0.5;
        shieldMesh.add(ring2);
    }

    function removeShieldVisual() {
        if (shieldMesh) {
            scene.remove(shieldMesh);
            shieldMesh.geometry.dispose();
            shieldMesh.material.dispose();
            shieldMesh = null;
        }
    }

    function updateBuffHUD() {
        const container = document.getElementById('buffs');
        container.innerHTML = '';

        if (activeBuffs.speed > 0) {
            const el = document.createElement('div');
            el.className = 'buff-icon buff-speed';
            el.innerHTML = '&#9889;<span class="buff-timer">' + Math.ceil(activeBuffs.speed) + 's</span>';
            container.appendChild(el);
        }
        if (activeBuffs.shield > 0) {
            const el = document.createElement('div');
            el.className = 'buff-icon buff-shield';
            el.innerHTML = '&#9711;<span class="buff-timer">' + Math.ceil(activeBuffs.shield) + 's</span>';
            container.appendChild(el);
        }
        if (activeBuffs.damage > 0) {
            const el = document.createElement('div');
            el.className = 'buff-icon buff-damage';
            el.innerHTML = '&#9876;<span class="buff-timer">' + Math.ceil(activeBuffs.damage) + 's</span>';
            container.appendChild(el);
        }
    }

    // ── Enemy AI ─────────────────────────────────────────────
    function updateEnemies(dt) {
        const playerPos = playerGroup.position;

        for (const enemy of enemies) {
            if (enemy.hp <= 0) continue;

            const pos = enemy.group.position;
            const distToPlayer = pos.distanceTo(playerPos);
            const turret = enemy.group.userData.turret;

            // State transitions
            if (isSniper) {
                // Sniper mode: tanks never attack — they just roam as moving targets.
                enemy.state = 'patrol';
                // Aggressively retarget so they don't sit still or hug edges
                enemy.patrolRetargetTimer -= dt;
                if (enemy.patrolRetargetTimer <= 0) {
                    enemy.patrolTarget.set(
                        (Math.random() - 0.5) * MAP_SIZE * 0.85,
                        0,
                        (Math.random() - 0.5) * MAP_SIZE * 0.85
                    );
                    enemy.patrolRetargetTimer = 2 + Math.random() * 3;
                }
            } else if (distToPlayer < 80) {
                enemy.state = 'attack';
            } else if (distToPlayer < 120) {
                enemy.state = 'chase';
            } else {
                enemy.state = 'patrol';
            }

            // Stuck detection
            if (pos.distanceTo(enemy.lastPos) < 0.1) {
                enemy.stuckTimer += dt;
                if (enemy.stuckTimer > 1.5) {
                    enemy.patrolTarget.set(
                        (Math.random() - 0.5) * MAP_SIZE * 0.7,
                        0,
                        (Math.random() - 0.5) * MAP_SIZE * 0.7
                    );
                    enemy.stuckTimer = 0;
                    enemy.state = 'patrol';
                }
            } else {
                enemy.stuckTimer = 0;
            }
            enemy.lastPos.copy(pos);

            let targetPos;
            if (enemy.state === 'patrol') {
                targetPos = enemy.patrolTarget;
                if (pos.distanceTo(targetPos) < 5) {
                    enemy.patrolTarget.set(
                        (Math.random() - 0.5) * MAP_SIZE * 0.7,
                        0,
                        (Math.random() - 0.5) * MAP_SIZE * 0.7
                    );
                }
            } else {
                targetPos = playerPos;
            }

            // Rotate hull toward target
            const angleToTarget = Math.atan2(
                targetPos.x - pos.x,
                targetPos.z - pos.z
            );
            let angleDiff = angleToTarget - enemy.group.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            const rotSpeed = ENEMY_ROTATION_SPEED * (isSniper ? 1.5 : 1) * dt;
            if (Math.abs(angleDiff) < rotSpeed) {
                enemy.group.rotation.y = angleToTarget;
            } else {
                enemy.group.rotation.y += Math.sign(angleDiff) * rotSpeed;
            }

            // Move forward — wider tolerance & speed boost in sniper mode keeps them roaming.
            const moveAngleThresh = isSniper ? 1.6 : 1.0;
            if (Math.abs(angleDiff) < moveAngleThresh) {
                const moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0), enemy.group.rotation.y
                );
                let speed = enemy.speed;
                if (!isSniper && enemy.state === 'attack' && distToPlayer < 25) speed = 0;
                if (isSniper) speed *= 1.4;
                const newPos = pos.clone().add(moveDir.multiplyScalar(speed * dt));

                // Clamp to map bounds
                newPos.x = Math.max(-HALF_MAP + 5, Math.min(HALF_MAP - 5, newPos.x));
                newPos.z = Math.max(-HALF_MAP + 5, Math.min(HALF_MAP - 5, newPos.z));

                // Collision check
                if (!checkStructureCollision(newPos, 3)) {
                    pos.copy(newPos);
                }
            }

            // Rotate turret toward player (always tracks player when in range)
            if (enemy.state === 'attack' || enemy.state === 'chase') {
                const turretAngle = Math.atan2(
                    playerPos.x - pos.x,
                    playerPos.z - pos.z
                ) - enemy.group.rotation.y;

                let tDiff = turretAngle - turret.rotation.y;
                while (tDiff > Math.PI) tDiff -= Math.PI * 2;
                while (tDiff < -Math.PI) tDiff += Math.PI * 2;
                turret.rotation.y += tDiff * 3 * dt;
            }

            // Fire at player
            if (enemy.state === 'attack') {
                enemy.fireTimer -= dt;
                if (enemy.fireTimer <= 0) {
                    enemy.fireTimer = ENEMY_FIRE_INTERVAL - wave * 0.1;
                    if (enemy.fireTimer < 1) enemy.fireTimer = 1;

                    // Get muzzle position in world space
                    const muzzleLocal = new THREE.Vector3(0, 0, -8.1);
                    const barrel = enemy.group.userData.barrel;
                    const worldMuzzle = muzzleLocal.clone();
                    barrel.localToWorld(worldMuzzle);

                    const fireDir = new THREE.Vector3()
                        .subVectors(playerPos.clone().add(new THREE.Vector3(0, 1.5, 0)), worldMuzzle)
                        .normalize();

                    fireLaser(worldMuzzle, fireDir, ENEMY_SHOT_DMG + wave, false);

                    // Muzzle flash
                    const glow = enemy.group.userData.glow;
                    const glowMat = enemy.group.userData.glowMat;
                    glowMat.opacity = 0.8;
                    setTimeout(() => { glowMat.opacity = 0; }, 100);
                }
            }
        }
    }

    function destroyEnemy(enemy) {
        spawnExplosion(enemy.group.position.clone().add(new THREE.Vector3(0, 2, 0)));
        scene.remove(enemy.group);

        const idx = enemies.indexOf(enemy);
        if (idx !== -1) enemies.splice(idx, 1);

        kills++;
        addKillfeedEntry('Enemy tank destroyed!');

        // Check wave completion
        if (enemies.length === 0) {
            wave++;
            enemiesPerWave = INITIAL_ENEMIES + wave * 2;
            addKillfeedEntry('=== WAVE ' + wave + ' ===');
            for (let i = 0; i < enemiesPerWave; i++) {
                setTimeout(() => spawnEnemy(), i * 500);
            }
        }
    }

    // ── Collision Detection ──────────────────────────────────
    function checkStructureCollision(position, radius) {
        const testBox = new THREE.Box3(
            new THREE.Vector3(position.x - radius, 0, position.z - radius),
            new THREE.Vector3(position.x + radius, 4, position.z + radius)
        );
        for (const s of structures) {
            if (testBox.intersectsBox(s.box)) return true;
        }
        return false;
    }

    // ── Player Controls ──────────────────────────────────────
    function updatePlayer(dt) {
        if (!playerTank || gameOver) return;
        if (isMP && pendingDead) {
            // Dead — camera still follows for spectator feel, but no input
            updateCamera(dt);
            return;
        }

        const group = playerGroup;
        const movedir = new THREE.Vector3();

        // Rotation (A/Q for AZERTY)
        if (keys['a'] || keys['q'] || keys['arrowleft']) {
            group.rotation.y += TANK_ROTATION_SPEED * dt;
        }
        if (keys['d'] || keys['arrowright']) {
            group.rotation.y -= TANK_ROTATION_SPEED * dt;
        }

        // Forward / backward (W/Z for AZERTY)
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0), group.rotation.y
        );

        if (keys['w'] || keys['z'] || keys['arrowup']) {
            movedir.add(forward);
        }
        if (keys['s'] || keys['arrowdown']) {
            movedir.add(forward.clone().negate());
        }

        // Apply speed buff
        const currentSpeed = TANK_SPEED * (activeBuffs.speed > 0 ? 1.5 : 1);

        if (movedir.length() > 0) {
            movedir.normalize();
            const newPos = group.position.clone().add(
                movedir.multiplyScalar(currentSpeed * dt)
            );

            // Map bounds
            newPos.x = Math.max(-HALF_MAP + 5, Math.min(HALF_MAP - 5, newPos.x));
            newPos.z = Math.max(-HALF_MAP + 5, Math.min(HALF_MAP - 5, newPos.z));

            // Structure collision
            if (!checkStructureCollision(newPos, 3)) {
                group.position.copy(newPos);
            }

            // Dust trail
            if (Math.random() < 0.3) {
                spawnDustTrail(group.position);
            }
        }

        // ─ Turret follows mouse (via pointer lock yaw)
        const turret = group.userData.turret;
        let tDiff = turretTargetAngle - turret.rotation.y;
        while (tDiff > Math.PI) tDiff -= Math.PI * 2;
        while (tDiff < -Math.PI) tDiff += Math.PI * 2;
        turret.rotation.y += tDiff * TURRET_FOLLOW_SPEED * dt;

        // ─ Laser charging
        const glow = group.userData.glow;
        const glowMat = group.userData.glowMat;

        if (isCharging) {
            chargeAmount = Math.min(1, chargeAmount + CHARGE_RATE * dt);
            glowMat.opacity = chargeAmount * 0.8;
            glow.scale.setScalar(1 + chargeAmount * 2);
        }

        // ─ Camera follow
        updateCamera(dt);
    }

    function firePlayerLaser() {
        if (chargeAmount < 0.05) return;
        if (isMP && pendingDead) { chargeAmount = 0; return; }

        let damage = MIN_LASER_DMG + (MAX_LASER_DMG - MIN_LASER_DMG) * chargeAmount;
        // Apply damage buff (+20%)
        if (activeBuffs.damage > 0) damage *= 1.2;

        // Get muzzle world position
        const barrel = playerGroup.userData.barrel;
        const muzzleLocal = new THREE.Vector3(0, 0, -8.1);
        const worldMuzzle = muzzleLocal.clone();
        barrel.localToWorld(worldMuzzle);

        // Fire direction - along barrel
        const barrelEnd = new THREE.Vector3(0, 0, -12);
        const worldEnd = barrelEnd.clone();
        barrel.localToWorld(worldEnd);
        const fireDir = new THREE.Vector3().subVectors(worldEnd, worldMuzzle).normalize();

        if (isMP) {
            firePlayerLaserMP(worldMuzzle, fireDir, damage);
            netSendFire(worldMuzzle, fireDir, damage);
        } else {
            fireLaser(worldMuzzle, fireDir, damage, true);
        }

        // Muzzle flash
        const glowMat = playerGroup.userData.glowMat;
        glowMat.opacity = 1;
        setTimeout(() => { glowMat.opacity = 0; }, 120);

        // Reset charge
        chargeAmount = 0;
        const glow = playerGroup.userData.glow;
        glow.scale.setScalar(1);
    }

    function spawnDustTrail(position) {
        const geo = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: COL.sandLight, transparent: true, opacity: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            position.x + (Math.random() - 0.5) * 2,
            0.3,
            position.z + (Math.random() - 0.5) * 2
        );
        scene.add(mesh);
        particles.push({
            mesh, mat,
            vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2),
            life: 0.5 + Math.random() * 0.5
        });
    }

    // ── Multiplayer: name labels ─────────────────────────────
    function makeNameSprite(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(ctx, 6, 10, 244, 44, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(7, 1.75, 1);
        sprite.position.set(0, 5.5, 0);
        sprite.userData.canvas = canvas;
        sprite.userData.ctx = ctx;
        sprite.userData.tex = tex;
        sprite.renderOrder = 999;
        return sprite;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function updateNameSprite(sprite, text) {
        const ctx = sprite.userData.ctx;
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(ctx, 6, 10, 244, 44, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);
        sprite.userData.tex.needsUpdate = true;
    }

    // ── Multiplayer: remote players ──────────────────────────
    function addRemotePlayer(pData) {
        if (!pData || !pData.id || remotePlayers.has(pData.id)) return;
        const group = createTankModel(true);
        group.position.set(pData.x || 0, 0, pData.z || 0);
        group.rotation.y = pData.rotY || 0;
        const turret = group.userData.turret;
        turret.rotation.y = pData.turretY || 0;

        const label = makeNameSprite(pData.name || ('Tank-' + pData.id));
        group.add(label);

        if (!pData.alive) group.visible = false;
        scene.add(group);

        remotePlayers.set(pData.id, {
            id: pData.id,
            name: pData.name || ('Tank-' + pData.id),
            group, turret,
            label,
            hp: (typeof pData.hp === 'number') ? pData.hp : PLAYER_MAX_HP,
            kills: pData.kills || 0,
            alive: pData.alive !== false,
            // interpolation targets
            tx: group.position.x, ty: 0, tz: group.position.z,
            trotY: group.rotation.y, tturretY: turret.rotation.y,
        });
    }

    function removeRemotePlayer(id) {
        const rp = remotePlayers.get(id);
        if (!rp) return;
        scene.remove(rp.group);
        rp.group.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                else o.material.dispose();
            }
        });
        if (rp.label && rp.label.userData.tex) rp.label.userData.tex.dispose();
        remotePlayers.delete(id);
    }

    function updateRemotePlayers(dt) {
        const lerpRate = Math.min(1, dt * 12);
        for (const rp of remotePlayers.values()) {
            const g = rp.group;
            g.position.x += (rp.tx - g.position.x) * lerpRate;
            g.position.z += (rp.tz - g.position.z) * lerpRate;

            // shortest-path rotation lerp
            let rDiff = rp.trotY - g.rotation.y;
            while (rDiff > Math.PI) rDiff -= Math.PI * 2;
            while (rDiff < -Math.PI) rDiff += Math.PI * 2;
            g.rotation.y += rDiff * lerpRate;

            let tDiff = rp.tturretY - rp.turret.rotation.y;
            while (tDiff > Math.PI) tDiff -= Math.PI * 2;
            while (tDiff < -Math.PI) tDiff += Math.PI * 2;
            rp.turret.rotation.y += tDiff * lerpRate;
        }
    }

    // ── Multiplayer: firing ──────────────────────────────────
    function firePlayerLaserMP(origin, direction, damage) {
        const raycaster = new THREE.Raycaster(origin, direction, 0, MAX_LASER_RANGE);

        const targets = [];
        const meshToRemote = new Map();
        for (const rp of remotePlayers.values()) {
            if (!rp.alive) continue;
            rp.group.traverse(c => {
                if (c.isMesh && !c.isSprite) {
                    targets.push(c);
                    meshToRemote.set(c, rp);
                }
            });
        }
        structures.forEach(s => targets.push(s.mesh));

        const hits = raycaster.intersectObjects(targets, false);
        let hitPoint = origin.clone().add(direction.clone().multiplyScalar(MAX_LASER_RANGE));

        if (hits.length > 0) {
            hitPoint = hits[0].point.clone();
            const hitRemote = meshToRemote.get(hits[0].object);
            if (hitRemote) {
                spawnHitParticles(hitPoint, COL.laserGlow, 12);
                netSendHit(hitRemote.id, damage);
            } else {
                spawnHitParticles(hitPoint, 0xCCBB99, 6);
            }
        }

        createLaserBeam(origin, hitPoint, damage / MAX_LASER_DMG);
    }

    function renderRemoteFire(shooterId, origin, direction, damage) {
        const raycaster = new THREE.Raycaster(origin, direction, 0, MAX_LASER_RANGE);
        const targets = [];
        structures.forEach(s => targets.push(s.mesh));
        // Let beams visually stop on our own tank and on other players
        if (playerGroup) {
            playerGroup.traverse(c => { if (c.isMesh && !c.isSprite) targets.push(c); });
        }
        for (const rp of remotePlayers.values()) {
            if (!rp.alive || rp.id === shooterId) continue;
            rp.group.traverse(c => { if (c.isMesh && !c.isSprite) targets.push(c); });
        }
        const hits = raycaster.intersectObjects(targets, false);
        let hitPoint = origin.clone().add(direction.clone().multiplyScalar(MAX_LASER_RANGE));
        if (hits.length > 0) {
            hitPoint = hits[0].point.clone();
            spawnHitParticles(hitPoint, COL.laserGlow, 6);
        }
        createLaserBeam(origin, hitPoint, damage / MAX_LASER_DMG);
    }

    // ── Multiplayer: networking ──────────────────────────────
    function netConnect(name, onReady, onError) {
        const loc = window.location;
        const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = proto + '//' + loc.host + '/ws';
        try {
            ws = new WebSocket(url);
        } catch (e) {
            onError && onError('Could not open WebSocket');
            return;
        }

        let ready = false;
        ws.addEventListener('open', () => {
            if (name) ws.send(JSON.stringify({ type: 'name', name }));
        });
        ws.addEventListener('message', (ev) => {
            let m;
            try { m = JSON.parse(ev.data); } catch { return; }
            handleServerMessage(m);
            if (!ready && m.type === 'welcome') {
                ready = true;
                onReady && onReady(m);
            }
        });
        ws.addEventListener('error', () => {
            if (!ready) onError && onError('Could not connect to server');
        });
        ws.addEventListener('close', () => {
            if (!ready) {
                onError && onError('Connection closed before welcome');
                return;
            }
            if (isMP) {
                addKillfeedEntry('Disconnected from server');
            }
        });
    }

    function netSendState() {
        if (!ws || ws.readyState !== 1 || !playerGroup) return;
        const turretY = playerGroup.userData.turret.rotation.y;
        ws.send(JSON.stringify({
            type: 'state',
            x: playerGroup.position.x,
            y: playerGroup.position.y,
            z: playerGroup.position.z,
            rotY: playerGroup.rotation.y,
            turretY,
            charge: chargeAmount,
        }));
    }

    function netSendFire(origin, dir, dmg) {
        if (!ws || ws.readyState !== 1) return;
        ws.send(JSON.stringify({
            type: 'fire',
            ox: origin.x, oy: origin.y, oz: origin.z,
            dx: dir.x, dy: dir.y, dz: dir.z,
            dmg,
        }));
    }

    function netSendHit(targetId, dmg) {
        if (!ws || ws.readyState !== 1) return;
        ws.send(JSON.stringify({ type: 'hit', targetId, dmg }));
    }

    function handleServerMessage(m) {
        switch (m.type) {
            case 'welcome': {
                myId = m.id;
                if (m.name) myName = m.name;
                (m.players || []).forEach(addRemotePlayer);
                break;
            }
            case 'join': {
                addRemotePlayer(m.player);
                addKillfeedEntry(m.player.name + ' joined');
                break;
            }
            case 'leave': {
                const rp = remotePlayers.get(m.id);
                if (rp) addKillfeedEntry(rp.name + ' left');
                removeRemotePlayer(m.id);
                break;
            }
            case 'name': {
                const rp = remotePlayers.get(m.id);
                if (rp) { rp.name = m.name; updateNameSprite(rp.label, m.name); }
                break;
            }
            case 'states': {
                for (const s of m.players) {
                    if (s.id === myId) continue;
                    const rp = remotePlayers.get(s.id);
                    if (!rp) continue;
                    rp.tx = s.x; rp.tz = s.z;
                    rp.trotY = s.rotY;
                    rp.tturretY = s.turretY;
                    if (typeof s.alive === 'boolean') {
                        rp.alive = s.alive;
                        rp.group.visible = s.alive;
                    }
                }
                break;
            }
            case 'fire': {
                if (m.id === myId) break;
                const origin = new THREE.Vector3(m.ox, m.oy, m.oz);
                const dir = new THREE.Vector3(m.dx, m.dy, m.dz);
                renderRemoteFire(m.id, origin, dir, m.dmg || 0);
                break;
            }
            case 'hp': {
                if (m.id === myId) {
                    const prevHp = playerTank ? playerTank.hp : PLAYER_MAX_HP;
                    if (playerTank) {
                        playerTank.hp = m.hp;
                        if (m.hp < prevHp) flashDamage();
                    }
                } else {
                    const rp = remotePlayers.get(m.id);
                    if (rp) rp.hp = m.hp;
                }
                break;
            }
            case 'kills': {
                if (m.id === myId) {
                    kills = m.kills;
                } else {
                    const rp = remotePlayers.get(m.id);
                    if (rp) rp.kills = m.kills;
                }
                break;
            }
            case 'death': {
                const killer = m.killerName || 'someone';
                const victim = m.victimName || 'a tank';
                if (m.id === myId) {
                    if (playerTank) playerTank.hp = 0;
                    pendingDead = true;
                    isCharging = false;
                    chargeAmount = 0;
                    if (playerGroup) {
                        spawnExplosion(playerGroup.position.clone().add(new THREE.Vector3(0, 2, 0)));
                        playerGroup.visible = false;
                    }
                    showRespawnBanner('DESTROYED', 'killed by ' + killer);
                    addKillfeedEntryStyled('You were destroyed by ' + killer, 'mp-you-died');
                } else if (m.killerId === myId) {
                    addKillfeedEntryStyled('You destroyed ' + victim, 'mp-you-killed');
                } else {
                    addKillfeedEntryStyled(killer + ' destroyed ' + victim, 'mp-kill');
                }
                const rp = remotePlayers.get(m.id);
                if (rp) {
                    spawnExplosion(rp.group.position.clone().add(new THREE.Vector3(0, 2, 0)));
                    rp.alive = false;
                    rp.hp = 0;
                    rp.group.visible = false;
                }
                break;
            }
            case 'respawn': {
                if (m.id === myId) {
                    pendingDead = false;
                    hideRespawnBanner();
                    if (playerTank) {
                        playerTank.hp = m.hp;
                        playerGroup.position.set(m.x, 0, m.z);
                        playerGroup.visible = true;
                    }
                } else {
                    const rp = remotePlayers.get(m.id);
                    if (rp) {
                        rp.alive = true;
                        rp.hp = m.hp;
                        rp.group.position.set(m.x, 0, m.z);
                        rp.tx = m.x; rp.tz = m.z;
                        rp.group.visible = true;
                    }
                }
                break;
            }
        }
    }

    function showRespawnBanner(title, sub) {
        if (!respawnBannerEl) return;
        respawnBannerTextEl.textContent = title;
        respawnBannerSubEl.textContent = sub;
        respawnBannerEl.style.display = 'block';
    }

    function hideRespawnBanner() {
        if (!respawnBannerEl) return;
        respawnBannerEl.style.display = 'none';
    }

    function addKillfeedEntryStyled(text, cls) {
        const el = document.createElement('div');
        el.className = 'killfeed-entry ' + (cls || '');
        el.textContent = text;
        hudKillfeed.prepend(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 1000);
        }, 3500);
    }

    function updatePlayersPanel() {
        if (!isMP || !playersListEl) return;
        const rows = [];
        rows.push({
            id: myId || 'me',
            name: myName + ' (you)',
            kills: kills,
            alive: !pendingDead,
            me: true,
        });
        for (const rp of remotePlayers.values()) {
            rows.push({
                id: rp.id, name: rp.name, kills: rp.kills,
                alive: rp.alive, me: false,
            });
        }
        rows.sort((a, b) => b.kills - a.kills);

        let html = '';
        for (const r of rows) {
            html += '<div class="player-row' + (r.alive ? '' : ' dead') + '">'
                + '<span class="player-name' + (r.me ? ' me' : '') + '">' + escapeHtml(r.name) + '</span>'
                + '<span class="player-kills">' + r.kills + '</span>'
                + '</div>';
        }
        playersListEl.innerHTML = html;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ── Camera ───────────────────────────────────────────────
    function updateCamera(dt) {
        const tankPos = playerGroup.position;
        const tankRot = playerGroup.rotation.y;
        const turret = playerGroup.userData.turret;
        const turretWorldAngle = tankRot + turret.rotation.y;

        // Barrel points in direction (-sin(θ), 0, -cos(θ))
        // Camera sits BEHIND the barrel: offset in (+sin(θ), 0, +cos(θ))
        const camDist = 16;
        const camHeight = 9;

        const targetX = tankPos.x + Math.sin(turretWorldAngle) * camDist;
        const targetZ = tankPos.z + Math.cos(turretWorldAngle) * camDist;
        const targetY = tankPos.y + camHeight;

        camera.position.lerp(
            new THREE.Vector3(targetX, targetY, targetZ),
            4 * dt
        );

        // Look toward where the barrel points (ahead of the tank)
        const lookTarget = new THREE.Vector3(
            tankPos.x - Math.sin(turretWorldAngle) * 20,
            tankPos.y + 2,
            tankPos.z - Math.cos(turretWorldAngle) * 20,
        );
        camera.lookAt(lookTarget);
    }

    // ── HUD ──────────────────────────────────────────────────
    function updateHUD() {
        if (!playerTank) return;

        // Charge bar
        hudCharge.style.width = (chargeAmount * 100) + '%';

        // Health
        const hpPct = Math.max(0, playerTank.hp / playerTank.maxHp * 100);
        hudHealth.style.width = hpPct + '%';

        if (hpPct > 60) {
            hudHealth.style.background = 'linear-gradient(90deg, #00cc44, #44ff66)';
        } else if (hpPct > 30) {
            hudHealth.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else {
            hudHealth.style.background = 'linear-gradient(90deg, #ff3333, #ff6644)';
        }

        hudHealthText.textContent = isSniper
            ? 'BODY ARMOR: ' + Math.ceil(hpPct) + '%'
            : 'HULL INTEGRITY: ' + Math.ceil(hpPct) + '%';

        // Score
        hudScore.textContent = 'KILLS: ' + kills;
        if (isMP) {
            hudWave.textContent = 'PLAYERS: ' + (remotePlayers.size + 1);
        } else {
            hudWave.textContent = 'WAVE ' + wave;
        }

        // Sniper-specific HUD overlays
        if (isSniper) {
            const scopeEl = document.getElementById('scope-overlay');
            const crossEl = document.getElementById('crosshair');
            if (scopeEl) scopeEl.style.display = sniperScoped ? 'block' : 'none';
            if (crossEl) crossEl.style.display = sniperScoped ? 'none' : 'block';
            if (sniperReloading) updateSniperHud();
        }
    }

    function flashDamage() {
        hudDamageFlash.style.background = 'rgba(255,0,0,0.3)';
        setTimeout(() => {
            hudDamageFlash.style.background = 'rgba(255,0,0,0)';
        }, 150);
    }

    function addKillfeedEntry(text) {
        const el = document.createElement('div');
        el.className = 'killfeed-entry';
        el.textContent = text;
        hudKillfeed.prepend(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 1000);
        }, 3000);
    }

    // ── Minimap ──────────────────────────────────────────────
    function updateMinimap() {
        const ctx = minimapCtx;
        const size = 160;
        const scale = size / MAP_SIZE;

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(194,166,107,0.3)';
        ctx.fillRect(0, 0, size, size);

        // Structures
        ctx.fillStyle = 'rgba(120,110,100,0.5)';
        for (const s of structures) {
            const sx = (s.mesh.position.x + HALF_MAP) * scale;
            const sz = (s.mesh.position.z + HALF_MAP) * scale;
            const bSize = s.box.getSize(new THREE.Vector3());
            ctx.fillRect(
                sx - bSize.x * scale / 2,
                sz - bSize.z * scale / 2,
                Math.max(2, bSize.x * scale),
                Math.max(2, bSize.z * scale)
            );
        }

        // Loot crates
        ctx.fillStyle = '#ffcc00';
        for (const l of lootCrates) {
            if (l.landed) {
                const lx = (l.group.position.x + HALF_MAP) * scale;
                const lz = (l.group.position.z + HALF_MAP) * scale;
                ctx.fillRect(lx - 2, lz - 2, 4, 4);
            }
        }

        // Enemies
        ctx.fillStyle = '#ff4444';
        for (const e of enemies) {
            const ex = (e.group.position.x + HALF_MAP) * scale;
            const ez = (e.group.position.z + HALF_MAP) * scale;
            ctx.beginPath();
            ctx.arc(ex, ez, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Remote players
        if (isMP) {
            ctx.fillStyle = '#ff9966';
            for (const rp of remotePlayers.values()) {
                if (!rp.alive) continue;
                const rx = (rp.group.position.x + HALF_MAP) * scale;
                const rz = (rp.group.position.z + HALF_MAP) * scale;
                ctx.beginPath();
                ctx.arc(rx, rz, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Player
        if (playerGroup) {
            const px = (playerGroup.position.x + HALF_MAP) * scale;
            const pz = (playerGroup.position.z + HALF_MAP) * scale;
            ctx.fillStyle = '#44ff44';
            ctx.beginPath();
            ctx.arc(px, pz, 4, 0, Math.PI * 2);
            ctx.fill();

            // Direction indicator
            const dir = playerGroup.rotation.y;
            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, pz);
            ctx.lineTo(px + Math.sin(dir) * -8, pz + Math.cos(dir) * -8);
            ctx.stroke();
        }
    }

    // ── Game Over ────────────────────────────────────────────
    function endGame() {
        gameOver = true;
        document.exitPointerLock();
        document.getElementById('final-kills').textContent = kills;
        document.getElementById('final-waves').textContent = wave;
        document.getElementById('game-over').style.display = 'flex';
    }

    function restartGame() {
        // Clean up
        enemies.forEach(e => scene.remove(e.group));
        enemies = [];
        laserBeams.forEach(lb => {
            scene.remove(lb.beam);
            scene.remove(lb.glowBeam);
        });
        laserBeams = [];
        particles.forEach(p => scene.remove(p.mesh));
        particles = [];
        lootCrates.forEach(l => scene.remove(l.group));
        lootCrates = [];
        removeShieldVisual();

        scene.remove(playerGroup);

        kills = 0;
        wave = 1;
        enemiesPerWave = INITIAL_ENEMIES;
        gameOver = false;
        chargeAmount = 0;
        isCharging = false;
        turretTargetAngle = 0;
        lootSpawnTimer = 8;
        activeBuffs = { speed: 0, shield: 0, damage: 0 };
        document.getElementById('buffs').innerHTML = '';

        if (isSniper) {
            // Detach old rifle from camera so we don't double-attach
            if (rifleGroup) {
                camera.remove(rifleGroup);
                rifleGroup.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) o.material.dispose();
                });
                rifleGroup = null;
            }
            createSniperPlayer();
            updateSniperHud();
        } else {
            createPlayer();
        }
        for (let i = 0; i < enemiesPerWave; i++) {
            spawnEnemy();
        }

        document.getElementById('game-over').style.display = 'none';
        renderer.domElement.requestPointerLock();
    }

    // ── Quit to main menu ────────────────────────────────────
    function quitToMenu() {
        // Hide menus / overlays
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('game-over').style.display = 'none';
        if (document.pointerLockElement) document.exitPointerLock();

        // Tear down enemies / projectiles / particles / loot
        enemies.forEach(e => scene.remove(e.group));
        enemies = [];
        laserBeams.forEach(lb => {
            scene.remove(lb.beam);
            scene.remove(lb.glowBeam);
            if (lb.beam.geometry) lb.beam.geometry.dispose();
            if (lb.glowBeam.geometry) lb.glowBeam.geometry.dispose();
            if (lb.mat) lb.mat.dispose();
            if (lb.glowMat) lb.glowMat.dispose();
        });
        laserBeams = [];
        particles.forEach(p => {
            scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mat) p.mat.dispose();
        });
        particles = [];
        lootCrates.forEach(l => scene.remove(l.group));
        lootCrates = [];
        removeShieldVisual();

        // Tear down sniper platform
        sniperPlatformMeshes.forEach(m => {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) {
                if (Array.isArray(m.material)) m.material.forEach(x => x.dispose());
                else m.material.dispose();
            }
        });
        sniperPlatformMeshes = [];
        sniperPlatformBuilt = false;

        // Restore boundary walls
        boundaryWalls.forEach(w => { w.visible = true; });

        // Tear down remote players (MP)
        for (const id of Array.from(remotePlayers.keys())) {
            removeRemotePlayer(id);
        }

        // Close WS if open
        if (ws) {
            try { ws.close(); } catch (e) {}
            ws = null;
        }

        // Tear down player + rifle
        if (playerGroup) {
            scene.remove(playerGroup);
            playerGroup = null;
        }
        playerTank = null;
        if (rifleGroup) {
            camera.remove(rifleGroup);
            rifleGroup.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                    else o.material.dispose();
                }
            });
            rifleGroup = null;
        }

        // Reset game state
        kills = 0;
        wave = 1;
        enemiesPerWave = INITIAL_ENEMIES;
        gameStarted = false;
        gameOver = false;
        paused = false;
        chargeAmount = 0;
        isCharging = false;
        turretTargetAngle = 0;
        lootSpawnTimer = 8;
        activeBuffs = { speed: 0, shield: 0, damage: 0 };
        pendingDead = false;
        myId = null;
        gameMode = null;
        isMP = false;
        isSniper = false;
        sniperScoped = false;
        sniperReloading = false;
        sniperFireCooldown = 0;
        sniperAmmo = SNIPER_MAG_SIZE;

        // Reset HUD visibility
        document.getElementById('buffs').innerHTML = '';
        document.getElementById('charge-container').style.display = '';
        document.getElementById('charge-label').style.display = '';
        if (sniperHud) sniperHud.style.display = 'none';
        const scopeEl = document.getElementById('scope-overlay');
        if (scopeEl) scopeEl.style.display = 'none';
        const crossEl = document.getElementById('crosshair');
        if (crossEl) crossEl.style.display = 'block';
        if (playersPanelEl) playersPanelEl.style.display = 'none';
        hideRespawnBanner();

        // Restore default camera FOV
        camera.fov = 60;
        camera.updateProjectionMatrix();

        // Show start screen
        document.getElementById('start-screen').style.display = 'flex';
        const cs = document.getElementById('connection-status');
        if (cs) cs.textContent = '';
    }

    // ── Game Loop ────────────────────────────────────────────
    function gameLoop() {
        requestAnimationFrame(gameLoop);
        if (!gameStarted) return;

        const dt = paused ? 0 : Math.min(clock.getDelta(), 0.05);
        // Keep clock in sync so dt doesn't spike on resume
        if (paused) clock.getDelta();

        if (!gameOver && !paused) {
            if (isSniper) {
                updateSniperPlayer(dt);
                updateEnemies(dt);
            } else {
                updatePlayer(dt);
                if (!isMP) {
                    updateEnemies(dt);
                    updateLootCrates(dt);
                    updateBuffs(dt);
                } else {
                    updateRemotePlayers(dt);
                    stateSendTimer += dt;
                    if (stateSendTimer >= STATE_SEND_INTERVAL) {
                        stateSendTimer = 0;
                        netSendState();
                    }
                }
            }
        }
        updateLaserBeams(dt);
        updateParticles(dt);
        updateHUD();
        updateMinimap();
        if (isMP) updatePlayersPanel();

        renderer.render(scene, camera);
    }

    // ── Settings / Pause ─────────────────────────────────────
    function showSettings() {
        if (!gameStarted || gameOver || paused) return;
        paused = true;
        document.getElementById('settings-menu').style.display = 'flex';
        if (document.pointerLockElement) document.exitPointerLock();
        // Clear scope state — mouseup may not fire after pointer unlock
        if (isSniper) sniperScoped = false;
    }

    function hideSettings() {
        if (!paused) return;
        paused = false;
        document.getElementById('settings-menu').style.display = 'none';
        if (gameStarted && !gameOver) {
            renderer.domElement.requestPointerLock();
        }
    }

    // ── Input ────────────────────────────────────────────────
    function setupInput() {
        document.addEventListener('keydown', (e) => {
            const keyLower = e.key.toLowerCase();
            const wasPressed = !!keys[keyLower];
            keys[keyLower] = true;

            if (e.key === 'Escape' && gameStarted && !gameOver) {
                if (paused) hideSettings();
                else showSettings();
                return;
            }
            if (isSniper) {
                if (e.code === 'Space' && !wasPressed && gameStarted && !gameOver && !paused) {
                    e.preventDefault();
                    if (sniperGrounded) {
                        sniperVy = SNIPER_JUMP_VELOCITY;
                        sniperGrounded = false;
                    }
                }
                if ((e.key === 'r' || e.key === 'R') && gameStarted && !gameOver && !paused) {
                    startSniperReload();
                }
                return;
            }
            if (e.code === 'Space' && !gameOver && gameStarted && !paused) {
                e.preventDefault();
                if (!isCharging) {
                    isCharging = true;
                    chargeAmount = 0;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
            if (isSniper) return;
            if (e.code === 'Space' && isCharging && !gameOver && gameStarted && !paused) {
                isCharging = false;
                firePlayerLaser();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!pointerLocked || gameOver || paused) return;
            if (isSniper) {
                const sens = sniperScoped ? aimSensitivity * 0.35 : aimSensitivity;
                sniperYaw -= e.movementX * sens;
                sniperPitch -= e.movementY * sens;
                const lim = Math.PI / 2 - 0.05;
                if (sniperPitch > lim) sniperPitch = lim;
                if (sniperPitch < -lim) sniperPitch = -lim;
            } else {
                turretTargetAngle -= e.movementX * aimSensitivity;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (!isSniper || !gameStarted || gameOver || paused || !pointerLocked) return;
            if (e.button === 0) {
                fireSniperRifle();
            } else if (e.button === 2) {
                sniperScoped = true;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (!isSniper) return;
            if (e.button === 2) sniperScoped = false;
        });

        document.addEventListener('contextmenu', (e) => {
            if (isSniper && pointerLocked) e.preventDefault();
        });

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = !!document.pointerLockElement;
        });

        // Click to re-lock pointer during gameplay
        renderer.domElement.addEventListener('click', () => {
            if (gameStarted && !gameOver && !pointerLocked && !paused) {
                renderer.domElement.requestPointerLock();
            }
        });

        // Settings controls
        const sensSlider = document.getElementById('sens-slider');
        const sensValue = document.getElementById('sens-value');
        const sliderVal = aimSensitivity * 1000;
        sensSlider.value = sliderVal;
        sensValue.textContent = sliderVal.toFixed(2);
        sensSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            aimSensitivity = v / 1000;
            sensValue.textContent = v.toFixed(2);
            localStorage.setItem('aimSensitivity', aimSensitivity);
            const ss = document.getElementById('start-sens-slider');
            const sv = document.getElementById('start-sens-value');
            if (ss) ss.value = v;
            if (sv) sv.textContent = v.toFixed(2);
        });
        document.getElementById('resume-btn').addEventListener('click', hideSettings);
        document.getElementById('quit-menu-btn').addEventListener('click', quitToMenu);
    }

    // ── Sniper Mode ──────────────────────────────────────────
    function trackPlatform(mesh) {
        scene.add(mesh);
        sniperPlatformMeshes.push(mesh);
        return mesh;
    }

    function createSniperPlatform() {
        if (sniperPlatformBuilt) return;
        sniperPlatformBuilt = true;

        const conTex = makeConcreteTexture();
        const floorMat = new THREE.MeshStandardMaterial({
            map: conTex, color: COL.concrete, roughness: 0.85, metalness: 0.05
        });
        const baseMat = new THREE.MeshStandardMaterial({
            map: conTex, color: COL.concreteDk, roughness: 0.9, metalness: 0.05
        });
        const railMat = new THREE.MeshStandardMaterial({
            color: COL.concreteDk, roughness: 0.9, metalness: 0.05
        });
        const sandbagMat = new THREE.MeshStandardMaterial({
            color: COL.sandDark, roughness: 0.95, metalness: 0
        });

        const cx = (SNIPER_INNER + SNIPER_OUTER) / 2;
        const width = SNIPER_OUTER - SNIPER_INNER;
        const length = (SNIPER_OUTER * 2) + 4;            // long enough to cover corners
        const yCenter = SNIPER_PLATFORM_TOP - 0.5;        // top at y=11
        const baseHeight = SNIPER_PLATFORM_TOP - 0.5;     // foundation top meets floor underside
        const baseY = baseHeight / 2;                    // center of foundation

        function addFloor(x, z, w, h, d) {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, floorMat);
            mesh.position.set(x, yCenter, z);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            trackPlatform(mesh);
        }

        function addBase(x, z, w, d) {
            const geo = new THREE.BoxGeometry(w, baseHeight, d);
            const mesh = new THREE.Mesh(geo, baseMat);
            mesh.position.set(x, baseY, z);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            trackPlatform(mesh);
        }

        // Foundation columns (visible "tower" under the walkway, ground → platform)
        addBase(0, -cx, length, width);
        addBase(0,  cx, length, width);
        addBase(-cx, 0, width, length);
        addBase( cx, 0, width, length);

        // Walkway top
        addFloor(0, -cx, length, 1, width);
        addFloor(0,  cx, length, 1, width);
        addFloor(-cx, 0, width, 1, length);
        addFloor( cx, 0, width, 1, length);

        // Inner low railing (knee-high)
        const railH = 0.6;
        const railThick = 0.4;
        const railY = SNIPER_PLATFORM_TOP + railH / 2;
        const railLen = 2 * SNIPER_INNER - 8;     // spans inner edge, leaves corners open

        function addRail(x, z, w, d) {
            const geo = new THREE.BoxGeometry(w, railH, d);
            const mesh = new THREE.Mesh(geo, railMat);
            mesh.position.set(x, railY, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            trackPlatform(mesh);
        }
        addRail(0, -SNIPER_INNER, railLen, railThick);
        addRail(0,  SNIPER_INNER, railLen, railThick);
        addRail(-SNIPER_INNER, 0, railThick, railLen);
        addRail( SNIPER_INNER, 0, railThick, railLen);

        // Sandbag stacks (cover at the inner edge, facing the map)
        function addSandbag(x, y, z, w, h, d, ry) {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, sandbagMat);
            mesh.position.set(x, y, z);
            mesh.rotation.y = ry || 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            trackPlatform(mesh);
        }
        const bagStride = 30;
        const bagRange = SNIPER_INNER - 18;   // skip corners
        // South / north strips — bag length runs along x
        for (let v = -bagRange; v <= bagRange; v += bagStride) {
            for (let row = 0; row < 2; row++) {
                for (let i = 0; i < 3; i++) {
                    const x = v + (i - 1) * 1.25 + row * 0.4;
                    const y = SNIPER_PLATFORM_TOP + 0.25 + row * 0.45;
                    addSandbag(x, y, -SNIPER_INNER + 0.6, 1.2, 0.45, 0.7, (i - 1) * 0.05);
                    addSandbag(x, y,  SNIPER_INNER - 0.6, 1.2, 0.45, 0.7, (i - 1) * 0.05);
                }
            }
        }
        // East / west strips — bag length runs along z
        for (let v = -bagRange; v <= bagRange; v += bagStride) {
            for (let row = 0; row < 2; row++) {
                for (let i = 0; i < 3; i++) {
                    const z = v + (i - 1) * 1.25 + row * 0.4;
                    const y = SNIPER_PLATFORM_TOP + 0.25 + row * 0.45;
                    addSandbag(-SNIPER_INNER + 0.6, y, z, 0.7, 0.45, 1.2, (i - 1) * 0.05);
                    addSandbag( SNIPER_INNER - 0.6, y, z, 0.7, 0.45, 1.2, (i - 1) * 0.05);
                }
            }
        }

        // Corner watchtowers (small raised crates the sniper can stand on)
        const corners = [
            [ SNIPER_OUTER - 4,  SNIPER_OUTER - 4],
            [ SNIPER_OUTER - 4, -(SNIPER_OUTER - 4)],
            [-(SNIPER_OUTER - 4),  SNIPER_OUTER - 4],
            [-(SNIPER_OUTER - 4), -(SNIPER_OUTER - 4)],
        ];
        for (const [cxp, czp] of corners) {
            const tower = new THREE.Mesh(
                new THREE.BoxGeometry(3, 1.4, 3),
                railMat
            );
            tower.position.set(cxp, SNIPER_PLATFORM_TOP + 0.7, czp);
            tower.castShadow = true;
            tower.receiveShadow = true;
            trackPlatform(tower);
        }
    }

    function createSniperRifleViewmodel() {
        const g = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1f, roughness: 0.7, metalness: 0.05 });
        const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });
        const scope = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.8 });

        // Stock (wood)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.45), wood);
        stock.position.set(0, -0.04, 0.18);
        g.add(stock);
        // Receiver
        const recv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.25), metal);
        recv.position.set(0, 0, -0.05);
        g.add(recv);
        // Barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 10), metal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.005, -0.5);
        g.add(barrel);
        // Scope
        const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), scope);
        scopeBody.rotation.x = Math.PI / 2;
        scopeBody.position.set(0, 0.07, -0.05);
        g.add(scopeBody);
        // Scope rings
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12), metal);
        ring1.position.set(0, 0.07, 0.04); ring1.rotation.x = Math.PI / 2;
        g.add(ring1);
        const ring2 = ring1.clone();
        ring2.position.z = -0.14;
        g.add(ring2);
        // Magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.07), metal);
        mag.position.set(0, -0.07, -0.02);
        g.add(mag);
        // Trigger guard
        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 10, Math.PI), metal);
        guard.position.set(0, -0.05, 0.04);
        guard.rotation.x = Math.PI / 2;
        g.add(guard);

        return g;
    }

    function createRoundedAvatar() {
        const group = new THREE.Group();

        const skin      = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.6, metalness: 0 });
        const skinDk    = new THREE.MeshStandardMaterial({ color: 0xa67854, roughness: 0.7, metalness: 0 });
        const fatigue   = new THREE.MeshStandardMaterial({ color: 0x556b3f, roughness: 0.9, metalness: 0 });
        const fatigueDk = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.9, metalness: 0 });
        const helmMat   = new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 0.7, metalness: 0.15 });
        const bootMat   = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.85, metalness: 0 });
        const strapMat  = new THREE.MeshStandardMaterial({ color: 0x2a2a22, roughness: 0.85, metalness: 0.05 });
        const visorMat  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 });

        // ── HIPS / TORSO ─────────────────────────────────────
        const hips = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), fatigueDk);
        hips.position.y = 0.95;
        hips.scale.set(1.25, 0.7, 0.85);
        hips.castShadow = true;
        group.add(hips);

        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 14), fatigue);
        torso.position.y = 1.32;
        torso.scale.set(1.18, 1, 0.78);
        torso.castShadow = true;
        group.add(torso);

        const vest = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), fatigueDk);
        vest.position.set(0, 1.32, -0.08);
        vest.scale.set(1.08, 0.85, 0.45);
        vest.castShadow = true;
        group.add(vest);

        // Belt
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 18), fatigueDk);
        belt.position.y = 0.96;
        belt.rotation.x = Math.PI / 2;
        belt.scale.set(1.1, 1, 0.7);
        group.add(belt);

        // Diagonal sling
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 5, 16, Math.PI), strapMat);
        strap.position.y = 1.3;
        strap.rotation.set(Math.PI / 2, 0, 0.7);
        group.add(strap);

        // ── NECK / HEAD ──────────────────────────────────────
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 12), skinDk);
        neck.position.y = 1.7;
        neck.castShadow = true;
        group.add(neck);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skin);
        head.position.y = 1.85;
        head.scale.set(0.95, 1.05, 1);
        head.castShadow = true;
        group.add(head);

        const helm = new THREE.Mesh(
            new THREE.SphereGeometry(0.235, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
            helmMat
        );
        helm.position.y = 1.93;
        helm.castShadow = true;
        group.add(helm);

        // Helmet visor band (front strip)
        const visor = new THREE.Mesh(
            new THREE.CylinderGeometry(0.235, 0.235, 0.05, 18, 1, true, -0.55, 1.1),
            visorMat
        );
        visor.position.y = 1.86;
        group.add(visor);

        // ── SHOULDERS / ARMS (pivot groups) ──────────────────
        function makeArm(side) {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.36, 1.55, 0);
            // Holding-rifle base pose
            pivot.rotation.x = 0.95;
            pivot.rotation.z = side * 0.05;

            const upArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 10), fatigue);
            upArm.position.y = -0.2;
            upArm.castShadow = true;
            pivot.add(upArm);

            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fatigue);
            elbow.position.y = -0.42;
            pivot.add(elbow);

            const farmPivot = new THREE.Group();
            farmPivot.position.y = -0.42;
            farmPivot.rotation.x = -0.55;
            pivot.add(farmPivot);

            const farm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 10), fatigue);
            farm.position.y = -0.18;
            farm.castShadow = true;
            farmPivot.add(farm);

            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
            hand.position.y = -0.36;
            hand.castShadow = true;
            farmPivot.add(hand);

            return pivot;
        }
        const lShoulder = makeArm(-1);
        const rShoulder = makeArm(1);
        group.add(lShoulder);
        group.add(rShoulder);

        // ── HIP / LEGS (pivot groups for walk anim) ──────────
        function makeLeg(side) {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.13, 0.88, 0);

            const upLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 4, 12), fatigueDk);
            upLeg.position.y = -0.27;
            upLeg.castShadow = true;
            pivot.add(upLeg);

            const knee = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fatigueDk);
            knee.position.y = -0.52;
            pivot.add(knee);

            const lowLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 4, 12), fatigueDk);
            lowLeg.position.y = -0.72;
            lowLeg.castShadow = true;
            pivot.add(lowLeg);

            const boot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bootMat);
            boot.position.set(0, -0.92, 0.08);
            boot.scale.set(1, 0.6, 1.6);
            boot.castShadow = true;
            pivot.add(boot);

            return pivot;
        }
        const lHip = makeLeg(-1);
        const rHip = makeLeg(1);
        group.add(lHip);
        group.add(rHip);

        // ── RIFLE (held in front of chest) ───────────────────
        const rifle = createSniperRifleViewmodel();
        rifle.scale.setScalar(1.7);
        rifle.position.set(0.05, 1.18, -0.45);
        rifle.rotation.set(-0.05, 0.05, 0);
        group.add(rifle);

        group.userData = {
            head, helm, rifle,
            leftHip: lHip, rightHip: rHip,
            leftShoulder: lShoulder, rightShoulder: rShoulder,
        };
        return group;
    }

    function createSniperPlayer() {
        const group = createRoundedAvatar();
        // Spawn near the south edge of the perimeter, looking inward
        group.position.set(0, SNIPER_PLATFORM_TOP, SNIPER_OUTER - 4);
        scene.add(group);
        playerGroup = group;

        playerTank = {
            group: group,
            hp: PLAYER_MAX_HP,
            maxHp: PLAYER_MAX_HP,
            speed: SNIPER_WALK_SPEED,
            velocity: new THREE.Vector3(),
        };

        sniperYaw = Math.PI;     // facing -z
        sniperPitch = -0.1;
        sniperVy = 0;
        sniperGrounded = true;
        sniperCrouching = false;
        crouchT = 0;
        playerGroup.rotation.y = sniperYaw;

        rifleGroup = group.userData.rifle;

        sniperAmmo = SNIPER_MAG_SIZE;
        sniperReloading = false;
        sniperReloadTimer = 0;
        sniperFireCooldown = 0;
        sniperScoped = false;
        camera.fov = SNIPER_FOV_NORMAL;
        camera.updateProjectionMatrix();
    }

    function updateSniperPlayer(dt) {
        if (!playerTank || gameOver) return;

        // Cooldowns
        if (sniperFireCooldown > 0) sniperFireCooldown = Math.max(0, sniperFireCooldown - dt);
        if (sniperReloading) {
            sniperReloadTimer -= dt;
            if (sniperReloadTimer <= 0) {
                sniperReloading = false;
                sniperAmmo = SNIPER_MAG_SIZE;
            }
        }

        // Crouch (held key) — scope-aim disables jump but allows crouch
        sniperCrouching = !!(keys['c'] || keys['control']);
        const targetCrouch = sniperCrouching ? 1 : 0;
        crouchT += (targetCrouch - crouchT) * Math.min(1, dt * SNIPER_CROUCH_LERP);

        // XZ movement
        const forward = new THREE.Vector3(-Math.sin(sniperYaw), 0, -Math.cos(sniperYaw));
        const right = new THREE.Vector3(Math.cos(sniperYaw), 0, -Math.sin(sniperYaw));

        const moveDir = new THREE.Vector3();
        if (keys['w'] || keys['z'] || keys['arrowup']) moveDir.add(forward);
        if (keys['s'] || keys['arrowdown']) moveDir.sub(forward);
        if (keys['d'] || keys['arrowright']) moveDir.add(right);
        if (keys['a'] || keys['q'] || keys['arrowleft']) moveDir.sub(right);

        sniperRunning = !!keys['shift'] && !sniperCrouching && !sniperScoped;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            let speed = SNIPER_WALK_SPEED;
            if (sniperRunning) speed *= SNIPER_RUN_MULT;
            if (sniperScoped) speed *= SNIPER_SCOPED_MOVE_MULT;
            if (sniperCrouching) speed *= 0.55;
            const step = speed * dt;

            const pos = playerGroup.position;
            const tryMove = (dx, dz) => {
                const nx = pos.x + dx;
                const nz = pos.z + dz;
                const inOuter = Math.abs(nx) <= SNIPER_OUTER && Math.abs(nz) <= SNIPER_OUTER;
                const onPerim = Math.abs(nx) >= SNIPER_INNER || Math.abs(nz) >= SNIPER_INNER;
                if (inOuter && onPerim) { pos.x = nx; pos.z = nz; return true; }
                return false;
            };
            const dx = moveDir.x * step;
            const dz = moveDir.z * step;
            if (!tryMove(dx, dz)) { tryMove(dx, 0) || tryMove(0, dz); }
        }

        // Vertical physics (jump + gravity). Jump itself is started in keydown.
        if (!sniperGrounded || sniperVy !== 0) {
            sniperVy -= SNIPER_GRAVITY * dt;
            playerGroup.position.y += sniperVy * dt;
            if (playerGroup.position.y <= SNIPER_PLATFORM_TOP) {
                playerGroup.position.y = SNIPER_PLATFORM_TOP;
                sniperVy = 0;
                sniperGrounded = true;
            } else {
                sniperGrounded = false;
            }
        } else {
            playerGroup.position.y = SNIPER_PLATFORM_TOP;
        }

        playerGroup.rotation.y = sniperYaw;

        // Visual crouch — squash the avatar Y to indicate crouch
        const sy = 1 - crouchT * (1 - SNIPER_CROUCH_HEIGHT_FACTOR);
        playerGroup.scale.set(1, sy, 1);

        // Walk-cycle animation (legs swing while moving on the ground)
        const moving = (moveDir.lengthSq() > 0) && sniperGrounded;
        const targetSwing = moving ? 1 : 0;
        walkSwing += (targetSwing - walkSwing) * Math.min(1, dt * 10);
        if (moving) walkPhase += dt * (sniperRunning ? 13 : 9);
        const swing = Math.sin(walkPhase) * 0.6 * walkSwing;
        const ud = playerGroup.userData;
        if (ud && ud.leftHip)  ud.leftHip.rotation.x  =  swing;
        if (ud && ud.rightHip) ud.rightHip.rotation.x = -swing;
        // Subtle counter-sway in shoulders so the upper body feels alive
        if (ud && ud.leftShoulder)  ud.leftShoulder.rotation.x  = 0.95 - swing * 0.12;
        if (ud && ud.rightShoulder) ud.rightShoulder.rotation.x = 0.95 + swing * 0.12;

        // FOV scope lerp
        const targetFov = sniperScoped ? SNIPER_FOV_SCOPED : SNIPER_FOV_NORMAL;
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
        camera.updateProjectionMatrix();

        updateSniperCamera();
    }

    function effectiveEyeHeight() {
        // Eye drops with crouch (and avatar squash)
        return SNIPER_EYE_HEIGHT * (1 - crouchT * (1 - SNIPER_CROUCH_HEIGHT_FACTOR));
    }

    function updateSniperCamera() {
        const eyeY = playerGroup.position.y + effectiveEyeHeight();
        const cp = Math.cos(sniperPitch);
        const sp = Math.sin(sniperPitch);

        if (sniperScoped) {
            // First-person scope view
            camera.position.set(playerGroup.position.x, eyeY, playerGroup.position.z);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = sniperYaw;
            camera.rotation.x = sniperPitch;
            camera.rotation.z = 0;
            playerGroup.visible = false;
        } else {
            // Third-person orbit camera (behind & slightly above the player)
            playerGroup.visible = true;
            const dist = SNIPER_3P_CAM_DIST;
            const camX = playerGroup.position.x + Math.sin(sniperYaw) * dist * cp;
            const camY = eyeY + 0.3 - sp * dist;
            const camZ = playerGroup.position.z + Math.cos(sniperYaw) * dist * cp;
            camera.position.set(camX, camY, camZ);

            const lookAhead = 8;
            const lookX = playerGroup.position.x - Math.sin(sniperYaw) * lookAhead * cp;
            const lookY = eyeY + sp * lookAhead;
            const lookZ = playerGroup.position.z - Math.cos(sniperYaw) * lookAhead * cp;
            camera.lookAt(lookX, lookY, lookZ);
        }
    }

    function fireSniperRifle() {
        if (gameOver || paused || !pointerLocked) return;
        if (!sniperScoped) {
            flashAimHint();
            return;
        }
        if (sniperReloading) return;
        if (sniperFireCooldown > 0) return;
        if (sniperAmmo <= 0) { startSniperReload(); return; }

        sniperAmmo--;
        sniperFireCooldown = SNIPER_FIRE_COOLDOWN;

        // Origin: at the player's chest/eye, so the beam visually starts from the avatar
        const originY = playerGroup.position.y + effectiveEyeHeight() - 0.05;
        const origin = new THREE.Vector3(playerGroup.position.x, originY, playerGroup.position.z);
        const cp = Math.cos(sniperPitch);
        const dir = new THREE.Vector3(
            -Math.sin(sniperYaw) * cp,
             Math.sin(sniperPitch),
            -Math.cos(sniperYaw) * cp
        ).normalize();

        fireLaser(origin, dir, SNIPER_DAMAGE, true);

        // Recoil — pitch kicks up
        sniperPitch += 0.04 + Math.random() * 0.02;
        const lim = Math.PI / 2 - 0.05;
        if (sniperPitch > lim) sniperPitch = lim;

        if (sniperAmmo === 0) startSniperReload();
        updateSniperHud();
    }

    function startSniperReload() {
        if (sniperReloading || sniperAmmo === SNIPER_MAG_SIZE) return;
        sniperReloading = true;
        sniperReloadTimer = SNIPER_RELOAD_TIME;
        updateSniperHud();
    }

    function updateSniperHud() {
        if (!sniperHud) return;
        if (sniperReloading) {
            sniperHud.innerHTML = 'RELOADING<span class="reload">' + sniperReloadTimer.toFixed(1) + 's</span>';
        } else {
            sniperHud.innerHTML = 'AMMO ' + sniperAmmo + '/' + SNIPER_MAG_SIZE
                + '<span class="reload">R RELOAD &middot; HOLD RMB TO AIM</span>';
        }
    }

    let aimHintTimer = 0;
    function flashAimHint() {
        if (!sniperHud) return;
        sniperHud.innerHTML = 'AIM FIRST<span class="reload">HOLD RIGHT-CLICK</span>';
        sniperHud.style.color = '#ff5566';
        clearTimeout(aimHintTimer);
        aimHintTimer = setTimeout(() => {
            sniperHud.style.color = '';
            updateSniperHud();
        }, 700);
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        initScene();
        createTerrain();
        createMap();
        setupInput();

        // Cache HUD elements
        hudCharge = document.getElementById('charge-bar');
        hudHealth = document.getElementById('health-bar');
        hudHealthText = document.getElementById('health-text');
        hudScore = document.getElementById('score');
        hudWave = document.getElementById('wave-info');
        hudKillfeed = document.getElementById('killfeed');
        hudDamageFlash = document.getElementById('damage-flash');
        minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
        respawnBannerEl = document.getElementById('respawn-banner');
        respawnBannerTextEl = document.getElementById('respawn-banner-text');
        respawnBannerSubEl = document.getElementById('respawn-banner-sub');
        playersPanelEl = document.getElementById('players-panel');
        playersListEl = document.getElementById('players-list');

        // Start-screen sensitivity & name (shared with pause-menu slider)
        const savedName = localStorage.getItem('playerName') || '';
        const startSensSlider = document.getElementById('start-sens-slider');
        const startSensValue = document.getElementById('start-sens-value');
        const startNameInput = document.getElementById('start-name-input');
        const connStatus = document.getElementById('connection-status');
        const startSliderVal = aimSensitivity * 1000;
        startSensSlider.value = startSliderVal;
        startSensValue.textContent = startSliderVal.toFixed(2);
        startSensSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            aimSensitivity = v / 1000;
            startSensValue.textContent = v.toFixed(2);
            localStorage.setItem('aimSensitivity', aimSensitivity);
            // Keep pause-menu slider in sync
            const ps = document.getElementById('sens-slider');
            const pv = document.getElementById('sens-value');
            if (ps) { ps.value = v; }
            if (pv) { pv.textContent = v.toFixed(2); }
        });
        if (savedName) startNameInput.value = savedName;

        // Render one frame so the background shows
        renderer.render(scene, camera);

        function beginCoop() {
            gameMode = 'coop';
            isMP = false;
            document.getElementById('start-screen').style.display = 'none';
            playersPanelEl.style.display = 'none';
            gameStarted = true;

            createPlayer();
            for (let i = 0; i < enemiesPerWave; i++) {
                spawnEnemy();
            }

            renderer.domElement.requestPointerLock();
            clock.start();
        }

        function beginMultiplayer() {
            if (ws) return; // already connecting
            const name = (startNameInput.value || '').trim().slice(0, 16) || ('Tank-' + Math.floor(Math.random() * 900 + 100));
            localStorage.setItem('playerName', name);
            myName = name;
            connStatus.textContent = 'Connecting...';
            connStatus.style.color = '#ff9966';

            netConnect(name, (welcome) => {
                connStatus.textContent = '';
                gameMode = 'multiplayer';
                isMP = true;
                document.getElementById('start-screen').style.display = 'none';
                playersPanelEl.style.display = 'block';
                gameStarted = true;

                const spawn = welcome.spawn || { x: 0, z: 0 };
                createPlayer(spawn.x, spawn.z);

                renderer.domElement.requestPointerLock();
                clock.start();
                addKillfeedEntry('Connected as ' + myName);
            }, (err) => {
                connStatus.textContent = 'FAILED: ' + err + ' (is server running?)';
                connStatus.style.color = '#ff5555';
                if (ws) { try { ws.close(); } catch (e) {} }
                ws = null;
            });
        }

        function beginSniper() {
            gameMode = 'sniper';
            isMP = false;
            isSniper = true;
            document.getElementById('start-screen').style.display = 'none';
            playersPanelEl.style.display = 'none';
            // Hide tank charge UI
            document.getElementById('charge-container').style.display = 'none';
            document.getElementById('charge-label').style.display = 'none';
            // Show sniper ammo HUD
            sniperHud = document.getElementById('sniper-ammo');
            sniperHud.style.display = 'block';
            updateSniperHud();

            // Hide boundary walls so sniper has clean sightlines into the map
            boundaryWalls.forEach(w => { w.visible = false; });

            gameStarted = true;

            createSniperPlatform();
            createSniperPlayer();

            // Spawn enemy tanks down on the field
            for (let i = 0; i < enemiesPerWave; i++) {
                spawnEnemy();
            }

            renderer.domElement.requestPointerLock();
            clock.start();
            addKillfeedEntry('SNIPER MODE — defend the perimeter');
        }

        document.getElementById('start-coop-btn').addEventListener('click', beginCoop);
        document.getElementById('start-mp-btn').addEventListener('click', beginMultiplayer);
        document.getElementById('start-sniper-btn').addEventListener('click', beginSniper);

        document.getElementById('restart-btn').addEventListener('click', restartGame);

        gameLoop();
    }

    // Expose for HTML onclick fallback
    window.startGame = function () {
        document.getElementById('start-coop-btn').click();
    };
    window.restartGame = restartGame;

    // Go!
    init();
})();
