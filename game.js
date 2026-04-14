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

    const keys = {};
    let mouseX = 0, mouseY = 0;
    let isCharging = false;
    let chargeAmount = 0;
    let pointerLocked = false;
    let turretTargetAngle = 0;
    let cameraPitch = 0.35;   // slight downward look

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
        // Ground plane
        const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 80, 80);
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

        // Rear engine deck (flat, grilled look)
        const rearGeo = new THREE.BoxGeometry(4.2, 0.5, 1.8);
        const rear = new THREE.Mesh(rearGeo, hullDkMat);
        rear.position.set(0, 1.85, 3.2);
        rear.castShadow = true;
        group.add(rear);

        // Engine exhaust vents
        for (let x = -1; x <= 1; x += 2) {
            const ventGeo = new THREE.BoxGeometry(1.2, 0.15, 1.0);
            const vent = new THREE.Mesh(ventGeo, new THREE.MeshStandardMaterial({
                color: 0x2A2A2A, roughness: 0.8, metalness: 0.4
            }));
            vent.position.set(x * 1.1, 2.0, 3.3);
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

            // Mud flap / fender
            const fenderGeo = new THREE.BoxGeometry(0.8, 0.1, 6.8);
            const fender = new THREE.Mesh(fenderGeo, hullDkMat);
            fender.position.set(xOff, 1.52, 0);
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
    function createPlayer() {
        playerGroup = createTankModel(false);
        playerGroup.position.set(0, 0, 80);
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
            const angle = Math.random() * Math.PI * 2;
            dist = SPAWN_DISTANCE_MIN + Math.random() * 60;
            x = playerPos.x + Math.cos(angle) * dist;
            z = playerPos.z + Math.sin(angle) * dist;
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

        // Parachute (half-sphere)
        const chuteGeo = new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const chuteMat = new THREE.MeshStandardMaterial({
            color: 0xEEDDCC, roughness: 0.6, metalness: 0.0,
            side: THREE.DoubleSide, transparent: true, opacity: 0.85
        });
        const chute = new THREE.Mesh(chuteGeo, chuteMat);
        chute.position.y = 5;
        chute.rotation.x = Math.PI;
        group.add(chute);

        // Parachute cords (4 lines)
        const cordMat = new THREE.MeshBasicMaterial({ color: 0x887766 });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const cordGeo = new THREE.CylinderGeometry(0.02, 0.02, 4.5, 4);
            const cord = new THREE.Mesh(cordGeo, cordMat);
            cord.position.set(Math.cos(angle) * 1.0, 2.8, Math.sin(angle) * 1.0);
            const dx = Math.cos(angle) * 1.2;
            const dz = Math.sin(angle) * 1.2;
            cord.lookAt(new THREE.Vector3(
                cord.position.x + dx, cord.position.y + 4, cord.position.z + dz
            ));
            group.add(cord);
        }

        group.userData = {
            chute, marker, markerMat,
            cords: group.children.filter(c => c !== crate && c !== strapH && c !== strapV && c !== marker && c !== chute),
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
            if (distToPlayer < 80) {
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

            const rotSpeed = ENEMY_ROTATION_SPEED * dt;
            if (Math.abs(angleDiff) < rotSpeed) {
                enemy.group.rotation.y = angleToTarget;
            } else {
                enemy.group.rotation.y += Math.sign(angleDiff) * rotSpeed;
            }

            // Move forward (if roughly facing target)
            if (Math.abs(angleDiff) < 1.0) {
                const moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(
                    new THREE.Vector3(0, 1, 0), enemy.group.rotation.y
                );
                const speed = (enemy.state === 'attack' && distToPlayer < 25) ? 0 : enemy.speed;
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

        fireLaser(worldMuzzle, fireDir, damage, true);

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

        hudHealthText.textContent = 'HULL INTEGRITY: ' + Math.ceil(hpPct) + '%';

        // Score
        hudScore.textContent = 'KILLS: ' + kills;
        hudWave.textContent = 'WAVE ' + wave;
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

        createPlayer();
        for (let i = 0; i < enemiesPerWave; i++) {
            spawnEnemy();
        }

        document.getElementById('game-over').style.display = 'none';
        renderer.domElement.requestPointerLock();
    }

    // ── Game Loop ────────────────────────────────────────────
    function gameLoop() {
        requestAnimationFrame(gameLoop);
        if (!gameStarted) return;

        const dt = Math.min(clock.getDelta(), 0.05);

        if (!gameOver) {
            updatePlayer(dt);
            updateEnemies(dt);
            updateLootCrates(dt);
            updateBuffs(dt);
        }
        updateLaserBeams(dt);
        updateParticles(dt);
        updateHUD();
        updateMinimap();

        renderer.render(scene, camera);
    }

    // ── Input ────────────────────────────────────────────────
    function setupInput() {
        document.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            if (e.code === 'Space' && !gameOver && gameStarted) {
                e.preventDefault();
                if (!isCharging) {
                    isCharging = true;
                    chargeAmount = 0;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
            if (e.code === 'Space' && isCharging && !gameOver && gameStarted) {
                isCharging = false;
                firePlayerLaser();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!pointerLocked || gameOver) return;
            turretTargetAngle -= e.movementX * 0.003;
        });

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = !!document.pointerLockElement;
        });

        // Click to re-lock pointer during gameplay
        renderer.domElement.addEventListener('click', () => {
            if (gameStarted && !gameOver && !pointerLocked) {
                renderer.domElement.requestPointerLock();
            }
        });
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

        // Render one frame so the background shows
        renderer.render(scene, camera);

        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').style.display = 'none';
            gameStarted = true;

            createPlayer();
            for (let i = 0; i < enemiesPerWave; i++) {
                spawnEnemy();
            }

            renderer.domElement.requestPointerLock();
            clock.start();
        });

        document.getElementById('restart-btn').addEventListener('click', restartGame);

        gameLoop();
    }

    // Expose for HTML onclick fallback
    window.startGame = function () {
        document.getElementById('start-btn').click();
    };
    window.restartGame = restartGame;

    // Go!
    init();
})();
