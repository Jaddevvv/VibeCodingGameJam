import * as THREE from "three";

type LimbRig = {
  pivot: THREE.Group;
  lowerPivot: THREE.Group;
  footPivot?: THREE.Group;
};

type AvatarRig = {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  face: THREE.Mesh;
  faceMaterial: THREE.MeshBasicMaterial;
  hairMaterial: THREE.MeshStandardMaterial;
  hairCap: THREE.Mesh;
  fringe: THREE.Mesh;
  leftSideHair: THREE.Mesh;
  rightSideHair: THREE.Mesh;
  backHair: THREE.Mesh;
  weaponGrip: THREE.Group;
  leftArm: LimbRig;
  rightArm: LimbRig;
  leftLeg: LimbRig;
  rightLeg: LimbRig;
};

type GrassTuft = {
  sway: THREE.Group;
  swayOffset: number;
  swayAmount: number;
  swaySpeed: number;
};

type CourseObstacle = {
  halfDepth: number;
  halfWidth: number;
  mesh: THREE.Object3D;
  requiredJumpHeight: number;
  x: number;
  z: number;
};

type EnvironmentState = {
  grassTufts: GrassTuft[];
};

type LevelObstacleConfig = {
  depth: number;
  height: number;
  width: number;
  x: number;
  z: number;
};

type LevelTemplate = {
  obstacles: LevelObstacleConfig[];
};

type FinishLineState = {
  bannerMaterial: THREE.MeshStandardMaterial;
  lineMaterial: THREE.MeshStandardMaterial;
  lineMesh: THREE.Mesh;
  pulseMesh: THREE.Mesh;
  z: number;
};

type CourseState = {
  finishLine: FinishLineState;
  obstacles: CourseObstacle[];
  root: THREE.Group;
  zombieRoot: THREE.Group;
};

type WeaponId = "katana" | "axe" | "glaive";

type WeaponProfile = {
  accent: string;
  arc: number;
  cooldown: number;
  damage: number;
  description: string;
  hitWidth: number;
  id: WeaponId;
  label: string;
  knockback: number;
  range: number;
  swingDuration: number;
};

type ZombieState = {
  attackCooldown: number;
  bodyMaterial: THREE.MeshStandardMaterial;
  damage: number;
  health: number;
  hitFlash: number;
  isGrounded: boolean;
  jumpHeight: number;
  lastHitAttackId: number;
  leftArm: THREE.Group;
  leftLeg: THREE.Group;
  maxHealth: number;
  radius: number;
  rightArm: THREE.Group;
  rightLeg: THREE.Group;
  root: THREE.Group;
  speed: number;
  stun: number;
  verticalVelocity: number;
  variant: "walker" | "brute";
  wobbleOffset: number;
};

type GameState = {
  currentLevel: number;
  damageFlash: number;
  hurtTimer: number;
  invulnerabilityTimer: number;
  pendingAdvanceAt: number | null;
  pendingRestartAt: number | null;
  playerHearts: number;
  teamCharge: number;
  teamChargeGoal: number;
  totalKills: number;
};

type CombatState = {
  activeWeaponId: WeaponId;
  attackCooldown: number;
  attackHitDone: boolean;
  attackQueued: boolean;
  attackSerial: number;
  attackTimer: number;
  spawnCooldown: number;
  zombies: ZombieState[];
};

type MotionState = {
  heading: number;
  isGrounded: boolean;
  jumpHeight: number;
  moveBlend: number;
  playerPosition: THREE.Vector3;
  runCycle: number;
  speed: number;
  velocity: THREE.Vector3;
  verticalVelocity: number;
};

type CameraState = {
  pitch: number;
  targetPitch: number;
  targetYaw: number;
  yaw: number;
};

type FaceBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type FaceCrop = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type HairProfile = {
  backScaleY: number;
  capScaleY: number;
  color: THREE.Color;
  fringeScaleY: number;
  sideScaleY: number;
};

type AvatarAppearance = {
  hairProfile: HairProfile;
  texture: THREE.CanvasTexture;
};

type FaceDetectionLike = {
  boundingBox: DOMRectReadOnly;
};

type FaceDetectorLike = {
  detect(source: CanvasImageSource): Promise<FaceDetectionLike[]>;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorLike;

const WORLD_LIMIT = 18;
const PLAYER_RADIUS = 0.34;
const PLAYER_START_Z = 14;
const RUN_SPEED = 7.9;
const JUMP_SPEED = 7.1;
const GRAVITY = 18;
const CAMERA_DISTANCE = 9.4;
const CAMERA_LOOK_HEIGHT = 1.55;
const CAMERA_SIDE_OFFSET = 1.08;
const CAMERA_FORWARD_LOOK = 2.3;
const PLAYER_MODEL_SCALE = 0.84;
const PLAYER_MAX_HEARTS = 2;
const PLAYER_HURT_DURATION = 0.42;
const PLAYER_HIT_INVULNERABILITY = 1.05;
const FACE_TEXTURE_WIDTH = 512;
const FACE_TEXTURE_HEIGHT = 544;
const PLAYER_ATTACK_RADIUS = 0.85;
const PLAYER_HIT_RADIUS = 0.98;
const ROAD_WIDTH = 5.8;
const ROAD_HALF_WIDTH = ROAD_WIDTH * 0.5;
const ROAD_START_Z = 15.5;
const ROAD_END_Z = -15.5;
const ROAD_LENGTH = ROAD_START_Z - ROAD_END_Z;
const ROAD_CENTER_Z = (ROAD_START_Z + ROAD_END_Z) * 0.5;
const FINISH_TRIGGER_Z = ROAD_END_Z + 1.1;
const ZOMBIE_JUMP_SPEED = 6.3;
const ZOMBIE_GRAVITY = 17;
const ZOMBIE_JUMP_LOOKAHEAD = 1.14;

const LEVEL_TEMPLATES: LevelTemplate[] = [
  {
    obstacles: [
      { depth: 0.64, height: 0.42, width: 4.4, x: 0, z: 8.2 },
      { depth: 0.7, height: 0.5, width: 3.5, x: -0.55, z: 3.1 },
      { depth: 0.76, height: 0.62, width: 3.9, x: 0.6, z: -2.5 },
      { depth: 0.82, height: 0.72, width: 4.6, x: 0, z: -8.4 }
    ]
  },
  {
    obstacles: [
      { depth: 0.66, height: 0.48, width: 4.2, x: 0.55, z: 9.1 },
      { depth: 0.74, height: 0.56, width: 3.1, x: -0.95, z: 5.4 },
      { depth: 0.78, height: 0.64, width: 4.7, x: 0, z: 0.7 },
      { depth: 0.82, height: 0.74, width: 3.1, x: 1, z: -4.1 },
      { depth: 0.9, height: 0.82, width: 4.8, x: 0, z: -10.6 }
    ]
  },
  {
    obstacles: [
      { depth: 0.7, height: 0.5, width: 2.8, x: -1.05, z: 10.3 },
      { depth: 0.7, height: 0.5, width: 2.8, x: 1.05, z: 8.2 },
      { depth: 0.78, height: 0.66, width: 4.8, x: 0, z: 4.2 },
      { depth: 0.82, height: 0.72, width: 2.9, x: -1.1, z: 0.6 },
      { depth: 0.82, height: 0.78, width: 2.9, x: 1.1, z: -3.1 },
      { depth: 0.94, height: 0.88, width: 4.9, x: 0, z: -8.9 }
    ]
  },
  {
    obstacles: [
      { depth: 0.72, height: 0.56, width: 3.1, x: -1.05, z: 10.4 },
      { depth: 0.72, height: 0.56, width: 3.1, x: 1.05, z: 8.5 },
      { depth: 0.82, height: 0.7, width: 5, x: 0, z: 4.9 },
      { depth: 0.84, height: 0.76, width: 3, x: 1.1, z: 1.2 },
      { depth: 0.84, height: 0.82, width: 3, x: -1.1, z: -2.2 },
      { depth: 0.9, height: 0.88, width: 5, x: 0, z: -6.7 },
      { depth: 0.98, height: 0.94, width: 4.6, x: 0, z: -11.2 }
    ]
  }
];

const WEAPON_ORDER: WeaponId[] = ["katana", "axe", "glaive"];

const WEAPON_PROFILES: Record<WeaponId, WeaponProfile> = {
  katana: {
    accent: "#ffe081",
    arc: 1.4,
    cooldown: 0.38,
    damage: 34,
    description: "Fast arc",
    hitWidth: 1.55,
    id: "katana",
    label: "Katana",
    knockback: 1.7,
    range: 1.95,
    swingDuration: 0.26
  },
  axe: {
    accent: "#ff8e65",
    arc: 1.08,
    cooldown: 0.54,
    damage: 52,
    description: "Heavy cleave",
    hitWidth: 1.38,
    id: "axe",
    label: "Axe",
    knockback: 2.2,
    range: 1.55,
    swingDuration: 0.34
  },
  glaive: {
    accent: "#6ce5ff",
    arc: 1.6,
    cooldown: 0.46,
    damage: 28,
    description: "Long reach",
    hitWidth: 1.82,
    id: "glaive",
    label: "Glaive",
    knockback: 1.5,
    range: 2.35,
    swingDuration: 0.3
  }
};

const sceneRoot = getElement<HTMLDivElement>("sceneRoot");
const photoInput = getElement<HTMLInputElement>("photoInput");
const changePhotoButton = getElement<HTMLButtonElement>("changePhotoButton");
const coinCountValue = getElement<HTMLSpanElement>("coinCountValue");
const goalValue = getElement<HTMLSpanElement>("goalValue");
const levelValue = getElement<HTMLSpanElement>("levelValue");
const weaponValue = getElement<HTMLSpanElement>("weaponValue");
const uploadModal = getElement<HTMLDivElement>("uploadModal");
const uploadStatus = getElement<HTMLSpanElement>("uploadStatus");
const damageOverlay = getElement<HTMLDivElement>("damageOverlay");
const weaponButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-weapon]"));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
sceneRoot.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#c8d6e2");
scene.fog = new THREE.Fog("#c8d6e2", 24, 78);

const camera = new THREE.PerspectiveCamera(
  42,
  sceneRoot.clientWidth / sceneRoot.clientHeight,
  0.1,
  120
);

const keys = new Set<string>();
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const moveInput = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const playerForwardVector = new THREE.Vector3();
const playerRightVector = new THREE.Vector3();
const zombieSeekVector = new THREE.Vector3();
const zombieRightVector = new THREE.Vector3();
const zombiePushVector = new THREE.Vector3();
const attackOffsetVector = new THREE.Vector3();
const obstacleOffsetVector = new THREE.Vector3();
const zeroVector = new THREE.Vector3();

const motion: MotionState = {
  heading: Math.PI,
  isGrounded: true,
  jumpHeight: 0,
  moveBlend: 0,
  playerPosition: new THREE.Vector3(0, 0, PLAYER_START_Z),
  runCycle: 0,
  speed: 0,
  velocity: new THREE.Vector3(),
  verticalVelocity: 0
};

const cameraState: CameraState = {
  pitch: 0.47,
  targetPitch: 0.47,
  targetYaw: 0,
  yaw: 0
};

const environment = createEnvironment(scene, renderer);
const grassTufts = environment.grassTufts;
const gameState: GameState = {
  currentLevel: 1,
  damageFlash: 0,
  hurtTimer: 0,
  invulnerabilityTimer: 0,
  pendingAdvanceAt: null,
  pendingRestartAt: null,
  playerHearts: PLAYER_MAX_HEARTS,
  teamCharge: 0,
  teamChargeGoal: getChargeGoal(1),
  totalKills: 0
};
const combatState: CombatState = {
  activeWeaponId: "katana",
  attackCooldown: 0,
  attackHitDone: false,
  attackQueued: false,
  attackSerial: 0,
  attackTimer: 0,
  spawnCooldown: 0.7,
  zombies: []
};
let currentCourse = createCourse(scene, gameState.currentLevel);
let activeFaceTexture = createDefaultFaceTexture();
const avatar = createAvatar(activeFaceTexture);
scene.add(avatar.root);
avatar.root.position.copy(motion.playerPosition);
setWeapon("katana");

camera.position.set(CAMERA_SIDE_OFFSET, 5.25, PLAYER_START_Z + CAMERA_DISTANCE);
camera.lookAt(motion.playerPosition.x, CAMERA_LOOK_HEIGHT, motion.playerPosition.z - CAMERA_FORWARD_LOOK);
syncHud();

let hasUploadedFace = false;
let jumpQueued = false;

for (const weaponButton of weaponButtons) {
  weaponButton.addEventListener("click", () => {
    const weaponId = weaponButton.dataset.weapon as WeaponId | undefined;

    if (!weaponId) {
      return;
    }

    setWeapon(weaponId);
  });
}

renderer.domElement.addEventListener("pointerdown", () => {
  if (uploadModal.dataset.open === "true") {
    return;
  }

  combatState.attackQueued = true;
});

changePhotoButton.addEventListener("click", () => {
  setModalOpen(true);
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    uploadStatus.textContent = "That file is not a usable image.";
    photoInput.value = "";
    return;
  }

  uploadStatus.textContent = "Loading image...";

  try {
    const appearance = await buildAvatarAppearanceFromFile(file);
    activeFaceTexture.dispose();
    activeFaceTexture = appearance.texture;
    avatar.faceMaterial.map = activeFaceTexture;
    avatar.faceMaterial.needsUpdate = true;
    applyHairProfile(avatar, appearance.hairProfile);
    hasUploadedFace = true;
    uploadStatus.textContent = "Face cropped and fitted to the avatar.";
    setModalOpen(false);
  } catch {
    uploadStatus.textContent = "The browser could not isolate the face from that image.";
  } finally {
    photoInput.value = "";
  }
});

uploadModal.addEventListener("click", (event) => {
  if (event.target === uploadModal && hasUploadedFace) {
    setModalOpen(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    if (!event.repeat && uploadModal.dataset.open !== "true") {
      jumpQueued = true;
    }
    event.preventDefault();
    return;
  }

  const key = event.key.toLowerCase();

  if (uploadModal.dataset.open !== "true") {
    if (!event.repeat && (key === "f" || key === "e")) {
      combatState.attackQueued = true;
      event.preventDefault();
      return;
    }

    if (key === "1" || key === "2" || key === "3") {
      setWeapon(WEAPON_ORDER[Number(key) - 1]);
      event.preventDefault();
      return;
    }
  }

  if (isMovementKey(key)) {
    keys.add(key);
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    return;
  }

  const key = event.key.toLowerCase();

  if (isMovementKey(key)) {
    keys.delete(key);
    event.preventDefault();
  }
});

window.addEventListener("blur", () => {
  keys.clear();
  combatState.attackQueued = false;
  jumpQueued = false;
});

window.addEventListener("resize", handleResize);

animate();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateMotion(delta);
  updateCombat(delta, elapsed);
  updateCourse(elapsed);
  updateAvatar(delta, elapsed);
  updateGrass(elapsed);
  updateCamera(delta);

  renderer.render(scene, camera);
}

function updateMotion(delta: number): void {
  const isTransitioning = gameState.pendingAdvanceAt !== null || gameState.pendingRestartAt !== null;

  if (jumpQueued && motion.isGrounded && !isTransitioning) {
    motion.verticalVelocity = JUMP_SPEED;
    motion.isGrounded = false;
  }
  jumpQueued = false;

  if (!motion.isGrounded || motion.verticalVelocity > 0) {
    motion.verticalVelocity -= GRAVITY * delta;
    motion.jumpHeight = Math.max(0, motion.jumpHeight + motion.verticalVelocity * delta);

    if (motion.jumpHeight === 0 && motion.verticalVelocity <= 0) {
      motion.verticalVelocity = 0;
      motion.isGrounded = true;
    }
  }

  if (isTransitioning) {
    motion.velocity.lerp(zeroVector, 1 - Math.exp(-delta * 12));
    motion.speed = 0;
    motion.moveBlend = damp(motion.moveBlend, 0, delta, 10);
    return;
  }

  const previousX = motion.playerPosition.x;
  const previousZ = motion.playerPosition.z;

  moveInput.set(0, 0, 0);

  if (keys.has("a") || keys.has("q") || keys.has("arrowleft")) {
    moveInput.x -= 1;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    moveInput.x += 1;
  }
  if (keys.has("w") || keys.has("z") || keys.has("arrowup")) {
    moveInput.z -= 1;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    moveInput.z += 1;
  }

  if (moveInput.lengthSq() > 0) {
    moveInput.normalize();
    moveDirection.set(moveInput.x, 0, moveInput.z);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      motion.velocity.lerp(
        moveDirection.multiplyScalar(motion.isGrounded ? RUN_SPEED : RUN_SPEED * 0.78),
        1 - Math.exp(-delta * (motion.isGrounded ? 15 : 8))
      );
    }
  } else {
    motion.velocity.lerp(zeroVector, 1 - Math.exp(-delta * 10));
  }

  motion.playerPosition.addScaledVector(motion.velocity, delta);
  motion.playerPosition.x = clamp(motion.playerPosition.x, -ROAD_HALF_WIDTH + PLAYER_RADIUS, ROAD_HALF_WIDTH - PLAYER_RADIUS);
  motion.playerPosition.z = clamp(motion.playerPosition.z, -WORLD_LIMIT, WORLD_LIMIT);
  resolveCourseCollisions(previousX, previousZ);
  motion.velocity.set(
    (motion.playerPosition.x - previousX) / Math.max(delta, 0.0001),
    0,
    (motion.playerPosition.z - previousZ) / Math.max(delta, 0.0001)
  );
  motion.speed = motion.velocity.length();
  if (motion.speed > 0.12) {
    motion.heading = dampAngle(
      motion.heading,
      Math.atan2(-motion.velocity.x, -motion.velocity.z),
      delta,
      14
    );
  }

  const lateralLead = clamp(motion.velocity.x / RUN_SPEED, -1, 1);
  const laneOffset = clamp(motion.playerPosition.x / Math.max(ROAD_HALF_WIDTH - PLAYER_RADIUS, 0.01), -1, 1);
  cameraState.targetYaw = clamp(laneOffset * 0.08 + lateralLead * 0.22, -0.26, 0.26);
  cameraState.targetPitch = 0.47;

  motion.moveBlend = damp(motion.moveBlend, motion.speed > 0.2 ? 1 : 0, delta, 10);
  motion.runCycle += delta * (1.8 + motion.speed * 0.84);
}

function updateCombat(delta: number, elapsed: number): void {
  const weapon = WEAPON_PROFILES[combatState.activeWeaponId];
  gameState.invulnerabilityTimer = Math.max(0, gameState.invulnerabilityTimer - delta);
  gameState.hurtTimer = Math.max(0, gameState.hurtTimer - delta);
  gameState.damageFlash = Math.max(0, gameState.damageFlash - delta * 1.7);
  damageOverlay.style.opacity = `${gameState.damageFlash}`;

  if (combatState.attackCooldown > 0) {
    combatState.attackCooldown = Math.max(0, combatState.attackCooldown - delta);
  }

  if (combatState.attackQueued && gameState.pendingAdvanceAt === null && gameState.pendingRestartAt === null) {
    tryStartAttack();
  }
  combatState.attackQueued = false;

  if (combatState.attackTimer > 0) {
    combatState.attackTimer = Math.max(0, combatState.attackTimer - delta);
    const attackProgress = 1 - combatState.attackTimer / weapon.swingDuration;

    if (!combatState.attackHitDone && attackProgress >= 0.38) {
      resolveWeaponHits(weapon);
      combatState.attackHitDone = true;
    }
  }

  if (
    gameState.pendingAdvanceAt === null &&
    gameState.pendingRestartAt === null &&
    gameState.teamCharge < gameState.teamChargeGoal
  ) {
    combatState.spawnCooldown -= delta;

    if (combatState.spawnCooldown <= 0) {
      spawnZombie(elapsed);
      combatState.spawnCooldown = getZombieSpawnDelay();
    }
  }

  for (let index = combatState.zombies.length - 1; index >= 0; index -= 1) {
    const zombie = combatState.zombies[index];
    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - delta);
    zombie.stun = Math.max(0, zombie.stun - delta);
    zombie.hitFlash = Math.max(0, zombie.hitFlash - delta);
    zombie.bodyMaterial.emissiveIntensity = zombie.hitFlash > 0 ? 0.42 : zombie.variant === "brute" ? 0.12 : 0.06;

    if (!zombie.isGrounded || zombie.verticalVelocity > 0) {
      zombie.verticalVelocity -= ZOMBIE_GRAVITY * delta;
      zombie.jumpHeight = Math.max(0, zombie.jumpHeight + zombie.verticalVelocity * delta);

      if (zombie.jumpHeight === 0 && zombie.verticalVelocity <= 0) {
        zombie.verticalVelocity = 0;
        zombie.isGrounded = true;
      }
    }

    if (zombie.health <= 0) {
      defeatZombie(index, zombie);
      continue;
    }

    zombieSeekVector.set(
      motion.playerPosition.x - zombie.root.position.x,
      0,
      motion.playerPosition.z - zombie.root.position.z
    );

    const distanceBeforeMove = zombieSeekVector.length();
    if (distanceBeforeMove > 0.0001) {
      zombieSeekVector.multiplyScalar(1 / distanceBeforeMove);
    }

    if (
      gameState.pendingAdvanceAt === null &&
      gameState.pendingRestartAt === null &&
      zombie.stun === 0 &&
      distanceBeforeMove > 0.88
    ) {
      tryStartZombieJump(zombie, zombieSeekVector);
      const sway = Math.sin(elapsed * 4.8 + zombie.wobbleOffset) * (zombie.isGrounded ? 0.16 : 0.07);
      const moveSpeed = zombie.speed * (zombie.isGrounded ? 1 : 0.92);
      zombie.root.position.x += (zombieSeekVector.x + sway) * moveSpeed * delta;
      zombie.root.position.z += zombieSeekVector.z * moveSpeed * delta;
      zombie.root.position.x = clamp(zombie.root.position.x, -ROAD_HALF_WIDTH + zombie.radius, ROAD_HALF_WIDTH - zombie.radius);
    }

    resolveZombieObstacleCollisions(zombie);

    zombieSeekVector.set(
      motion.playerPosition.x - zombie.root.position.x,
      0,
      motion.playerPosition.z - zombie.root.position.z
    );
    const distanceToPlayer = zombieSeekVector.length();

    if (distanceToPlayer > 0.0001) {
      zombieSeekVector.multiplyScalar(1 / distanceToPlayer);
    }

    if (
      distanceToPlayer <= PLAYER_HIT_RADIUS + zombie.radius * 0.12 &&
      zombie.attackCooldown === 0 &&
      gameState.pendingAdvanceAt === null &&
      gameState.pendingRestartAt === null
    ) {
      zombie.attackCooldown = zombie.variant === "brute" ? 1.1 : 0.78;

      if (gameState.invulnerabilityTimer === 0) {
        gameState.playerHearts = Math.max(0, gameState.playerHearts - 1);
        gameState.damageFlash = 1;
        gameState.hurtTimer = PLAYER_HURT_DURATION;
        gameState.invulnerabilityTimer = PLAYER_HIT_INVULNERABILITY;
        motion.playerPosition.addScaledVector(zombieSeekVector, -0.48);
        motion.playerPosition.x = clamp(
          motion.playerPosition.x,
          -ROAD_HALF_WIDTH + PLAYER_RADIUS,
          ROAD_HALF_WIDTH - PLAYER_RADIUS
        );
        motion.playerPosition.z = clamp(motion.playerPosition.z, -WORLD_LIMIT, WORLD_LIMIT);
      }
    }

    zombie.root.rotation.y = Math.atan2(zombieSeekVector.x, zombieSeekVector.z);
    updateZombieAnimation(zombie, elapsed, distanceToPlayer);
  }

  if (gameState.playerHearts <= 0 && gameState.pendingRestartAt === null) {
    gameState.pendingRestartAt = elapsed + 1.1;
  }
}

function updateCourse(elapsed: number): void {
  animateFinishLine(elapsed);

  if (gameState.pendingRestartAt !== null) {
    if (elapsed >= gameState.pendingRestartAt) {
      startLevel(gameState.currentLevel);
    }
    syncHud();
    return;
  }

  if (gameState.pendingAdvanceAt !== null) {
    if (elapsed >= gameState.pendingAdvanceAt) {
      startLevel(gameState.currentLevel + 1);
    }
    syncHud();
    return;
  }

  if (gameState.teamCharge >= gameState.teamChargeGoal && motion.playerPosition.z <= currentCourse.finishLine.z) {
    gameState.pendingAdvanceAt = elapsed + 0.9;
  }

  syncHud();
}

function updateAvatar(_delta: number, elapsed: number): void {
  const gait = Math.sin(motion.runCycle);
  const oppositeGait = Math.sin(motion.runCycle + Math.PI);
  const bounce = Math.sin(motion.runCycle * 2);
  const idle = Math.sin(elapsed * 1.8);
  const idleSway = Math.sin(elapsed * 1.35);
  const airBlend = motion.isGrounded ? 0 : 1;
  const airLift = clamp(motion.jumpHeight / 1.5, 0, 1);
  const weapon = WEAPON_PROFILES[combatState.activeWeaponId];
  const attackProgress = weapon.swingDuration > 0
    ? 1 - combatState.attackTimer / weapon.swingDuration
    : 0;
  const attackSweep = clamp(attackProgress, 0, 1);
  const attackBlend = combatState.attackTimer > 0
    ? Math.sin(attackSweep * Math.PI)
    : 0;
  const attackYaw = combatState.attackTimer > 0
    ? THREE.MathUtils.lerp(0.82, -0.62, attackSweep)
    : 0;
  const attackRoll = combatState.attackTimer > 0
    ? THREE.MathUtils.lerp(0.4, -0.36, attackSweep)
    : 0;
  const hurtProgress = gameState.hurtTimer > 0 ? 1 - gameState.hurtTimer / PLAYER_HURT_DURATION : 0;
  const hurtBlend = gameState.hurtTimer > 0 ? Math.sin(clamp(hurtProgress, 0, 1) * Math.PI) : 0;

  avatar.root.position.copy(motion.playerPosition);
  avatar.root.position.y = motion.jumpHeight;
  avatar.root.rotation.y = motion.heading;

  avatar.hips.position.y = 1.52 + bounce * 0.055 * motion.moveBlend + idle * 0.018 * (1 - motion.moveBlend) - airBlend * 0.05;
  avatar.torso.rotation.x = 0.16 * motion.moveBlend + bounce * 0.03 * motion.moveBlend + idle * 0.02 * (1 - motion.moveBlend) - airLift * 0.1 - hurtBlend * 0.24;
  avatar.torso.rotation.y = attackYaw * 0.22 + hurtBlend * 0.26;
  avatar.torso.rotation.z = gait * 0.035 * motion.moveBlend + idleSway * 0.015 * (1 - motion.moveBlend) - hurtBlend * 0.18;
  avatar.head.rotation.x = -0.06 * motion.moveBlend - idle * 0.015 + airLift * 0.08 + hurtBlend * 0.2;
  avatar.head.rotation.y = -attackYaw * 0.14 - hurtBlend * 0.16;
  avatar.head.rotation.z = -gait * 0.015 * motion.moveBlend + hurtBlend * 0.12;

  avatar.leftArm.pivot.rotation.x = oppositeGait * 0.95 * motion.moveBlend + idle * 0.08 * (1 - motion.moveBlend) - airLift * 0.18 - attackBlend * 0.2 + hurtBlend * 0.46;
  avatar.leftArm.pivot.rotation.y = -attackYaw * 0.16 - hurtBlend * 0.22;
  avatar.rightArm.pivot.rotation.x = gait * 0.95 * motion.moveBlend - idle * 0.08 * (1 - motion.moveBlend) - airLift * 0.18 - 0.38 - attackBlend * 1.18 - hurtBlend * 0.68;
  avatar.rightArm.pivot.rotation.y = attackYaw;
  avatar.rightArm.pivot.rotation.z = 0.1 - attackRoll * 0.18;
  avatar.leftArm.lowerPivot.rotation.x = 0.22 + Math.max(0, -oppositeGait) * 0.46 * motion.moveBlend + attackBlend * 0.18;
  avatar.rightArm.lowerPivot.rotation.x = 0.32 + Math.max(0, -gait) * 0.42 * motion.moveBlend + attackBlend * 1.08;

  avatar.leftLeg.pivot.rotation.x = gait * 0.88 * motion.moveBlend + airLift * 0.2;
  avatar.rightLeg.pivot.rotation.x = oppositeGait * 0.88 * motion.moveBlend + airLift * 0.2;
  avatar.leftLeg.lowerPivot.rotation.x = Math.max(0, -gait) * 0.7 * motion.moveBlend + airLift * 0.36;
  avatar.rightLeg.lowerPivot.rotation.x = Math.max(0, -oppositeGait) * 0.7 * motion.moveBlend + airLift * 0.36;

  if (avatar.leftLeg.footPivot && avatar.rightLeg.footPivot) {
    avatar.leftLeg.footPivot.rotation.x = Math.max(0, gait) * 0.26 * motion.moveBlend;
    avatar.rightLeg.footPivot.rotation.x = Math.max(0, oppositeGait) * 0.26 * motion.moveBlend;
  }

  avatar.weaponGrip.rotation.x = -0.38 - attackBlend * 0.88 + hurtBlend * 0.18;
  avatar.weaponGrip.rotation.y = attackYaw * 0.88;
  avatar.weaponGrip.rotation.z = attackRoll;
}

function updateGrass(elapsed: number): void {
  for (const tuft of grassTufts) {
    tuft.sway.rotation.z = Math.sin(elapsed * tuft.swaySpeed + tuft.swayOffset) * tuft.swayAmount;
    tuft.sway.rotation.x = Math.cos(elapsed * (tuft.swaySpeed * 0.72) + tuft.swayOffset) * tuft.swayAmount * 0.25;
  }
}

function updateCamera(delta: number): void {
  cameraState.yaw = dampAngle(cameraState.yaw, cameraState.targetYaw, delta, 10);
  cameraState.pitch = damp(cameraState.pitch, cameraState.targetPitch, delta, 10);

  const horizontalDistance = Math.cos(cameraState.pitch) * CAMERA_DISTANCE;
  const laneOffset = clamp(motion.playerPosition.x / Math.max(ROAD_HALF_WIDTH - PLAYER_RADIUS, 0.01), -1, 1);
  const shoulderOffset = CAMERA_SIDE_OFFSET + laneOffset * 0.22 + clamp(motion.velocity.x * 0.03, -0.12, 0.14);
  cameraOffset.set(
    Math.sin(cameraState.yaw) * horizontalDistance + shoulderOffset,
    2.18 + Math.sin(cameraState.pitch) * CAMERA_DISTANCE,
    Math.cos(cameraState.yaw) * horizontalDistance
  );

  cameraTarget
    .copy(motion.playerPosition)
    .add(new THREE.Vector3(laneOffset * 0.42, CAMERA_LOOK_HEIGHT + motion.jumpHeight * 0.72, -CAMERA_FORWARD_LOOK));

  if (motion.speed > 0.2) {
    cameraTarget.addScaledVector(motion.velocity, 0.08);
  }

  desiredCameraPosition.copy(motion.playerPosition).add(cameraOffset);
  desiredCameraPosition.x += laneOffset * 0.28;
  desiredCameraPosition.z += 0.78 + clamp(motion.velocity.z * 0.03, -0.12, 0.18);
  desiredCameraPosition.y += motion.jumpHeight * 0.24;

  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 4.8));
  camera.lookAt(cameraTarget);
}

function resolveCourseCollisions(previousX: number, previousZ: number): void {
  for (const obstacle of currentCourse.obstacles) {
    const jumpClearance = motion.jumpHeight + Math.max(0, motion.verticalVelocity) * 0.08;
    if (jumpClearance >= obstacle.requiredJumpHeight - 0.06) {
      continue;
    }

    if (!intersectsCourseObstacle(motion.playerPosition.x, motion.playerPosition.z, obstacle)) {
      continue;
    }

    const freeOnX = !intersectsCourseObstacle(previousX, motion.playerPosition.z, obstacle);
    const freeOnZ = !intersectsCourseObstacle(motion.playerPosition.x, previousZ, obstacle);

    if (freeOnX && !freeOnZ) {
      motion.playerPosition.x = previousX;
      continue;
    }

    if (!freeOnX && freeOnZ) {
      motion.playerPosition.z = previousZ;
      continue;
    }

    if (freeOnX && freeOnZ) {
      const xPenetration = obstacle.halfWidth + PLAYER_RADIUS - Math.abs(motion.playerPosition.x - obstacle.x);
      const zPenetration = obstacle.halfDepth + PLAYER_RADIUS - Math.abs(motion.playerPosition.z - obstacle.z);

      if (xPenetration < zPenetration) {
        motion.playerPosition.x = obstacle.x + Math.sign(motion.playerPosition.x - obstacle.x || previousX - obstacle.x || 1) * (obstacle.halfWidth + PLAYER_RADIUS + 0.01);
      } else {
        motion.playerPosition.z = obstacle.z + Math.sign(motion.playerPosition.z - obstacle.z || previousZ - obstacle.z || 1) * (obstacle.halfDepth + PLAYER_RADIUS + 0.01);
      }

      continue;
    }

    motion.playerPosition.x = previousX;
    motion.playerPosition.z = previousZ;
  }
}

function intersectsCourseObstacle(x: number, z: number, obstacle: CourseObstacle): boolean {
  return (
    Math.abs(x - obstacle.x) < obstacle.halfWidth + PLAYER_RADIUS &&
    Math.abs(z - obstacle.z) < obstacle.halfDepth + PLAYER_RADIUS
  );
}

function animateFinishLine(elapsed: number): void {
  const unlocked = gameState.teamCharge >= gameState.teamChargeGoal;
  const pulseMaterial = currentCourse.finishLine.pulseMesh.material as THREE.MeshStandardMaterial;
  currentCourse.finishLine.lineMaterial.color.set(unlocked ? "#65dfb4" : "#d96b4c");
  currentCourse.finishLine.lineMaterial.emissive.set(unlocked ? "#8dfff2" : "#ff9e70");
  currentCourse.finishLine.lineMaterial.emissiveIntensity = unlocked ? 0.72 : 0.28;
  currentCourse.finishLine.bannerMaterial.color.set(unlocked ? "#dafef1" : "#ffefe4");
  currentCourse.finishLine.bannerMaterial.emissive.set(unlocked ? "#8efbe0" : "#ffcf9b");
  currentCourse.finishLine.bannerMaterial.emissiveIntensity = unlocked ? 0.42 : 0.18;
  pulseMaterial.opacity = unlocked ? 0.94 : 0.52;
  currentCourse.finishLine.pulseMesh.scale.x = 1 + Math.sin(elapsed * 3.2) * (unlocked ? 0.16 : 0.04);
  currentCourse.finishLine.pulseMesh.scale.z = 1 + Math.sin(elapsed * 3.2) * (unlocked ? 0.18 : 0.04);
}

function startLevel(level: number): void {
  scene.remove(currentCourse.root);
  currentCourse = createCourse(scene, level);
  gameState.currentLevel = level;
  gameState.damageFlash = 0;
  gameState.hurtTimer = 0;
  gameState.invulnerabilityTimer = 0;
  gameState.pendingAdvanceAt = null;
  gameState.pendingRestartAt = null;
  gameState.playerHearts = PLAYER_MAX_HEARTS;
  gameState.teamCharge = 0;
  gameState.teamChargeGoal = getChargeGoal(level);
  jumpQueued = false;
  keys.clear();
  combatState.attackCooldown = 0;
  combatState.attackHitDone = false;
  combatState.attackQueued = false;
  combatState.attackTimer = 0;
  combatState.spawnCooldown = 0.65;
  combatState.zombies = [];
  motion.playerPosition.set(0, 0, PLAYER_START_Z);
  motion.velocity.set(0, 0, 0);
  motion.heading = Math.PI;
  motion.isGrounded = true;
  motion.jumpHeight = 0;
  motion.verticalVelocity = 0;
  motion.moveBlend = 0;
  avatar.root.position.copy(motion.playerPosition);
  damageOverlay.style.opacity = "0";
  camera.position.set(CAMERA_SIDE_OFFSET, 5.25, PLAYER_START_Z + CAMERA_DISTANCE);
  camera.lookAt(motion.playerPosition.x, CAMERA_LOOK_HEIGHT, motion.playerPosition.z - CAMERA_FORWARD_LOOK);
  syncHud();
}

function syncHud(): void {
  const weapon = WEAPON_PROFILES[combatState.activeWeaponId];
  const threat = Math.max(
    gameState.currentLevel,
    gameState.currentLevel + Math.floor(combatState.zombies.length * 0.5 + gameState.teamCharge / 4)
  );

  levelValue.textContent = `Zone ${gameState.currentLevel} | Threat ${threat}`;
  coinCountValue.textContent = `Hearts ${gameState.playerHearts}/${PLAYER_MAX_HEARTS} | Gate ${gameState.teamCharge}/${gameState.teamChargeGoal}`;
  weaponValue.textContent = `${weapon.label} | ${weapon.description}`;

  if (gameState.pendingRestartAt !== null) {
    goalValue.textContent = "You were overrun. Regrouping...";
    return;
  }

  if (gameState.pendingAdvanceAt !== null) {
    goalValue.textContent = `Zone ${gameState.currentLevel} secured`;
    return;
  }

  goalValue.textContent = gameState.teamCharge >= gameState.teamChargeGoal
    ? "Extraction ready. Reach the gate."
    : `Hold the lane. ${combatState.zombies.length} undead on the road.`;
}

function handleResize(): void {
  const width = sceneRoot.clientWidth;
  const height = sceneRoot.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function createEnvironment(targetScene: THREE.Scene, targetRenderer: THREE.WebGLRenderer): EnvironmentState {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 32, 16),
    new THREE.MeshBasicMaterial({ color: "#bfd2df", side: THREE.BackSide })
  );
  targetScene.add(sky);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 18, 18),
    new THREE.MeshBasicMaterial({ color: "#fff2d4" })
  );
  moon.position.set(-18, 22, -28);
  targetScene.add(moon);

  const hemisphereLight = new THREE.HemisphereLight("#f3efe2", "#6d7d69", 1.85);
  targetScene.add(hemisphereLight);

  const sunLight = new THREE.DirectionalLight("#fff4da", 2.25);
  sunLight.position.set(12, 18, 9);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -30;
  sunLight.shadow.camera.right = 30;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -30;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 64;
  targetScene.add(sunLight);

  const fillLight = new THREE.DirectionalLight("#95b8d9", 0.7);
  fillLight.position.set(-12, 8, -16);
  targetScene.add(fillLight);

  const groundTexture = createGroundTexture(targetRenderer);
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 86, 120, 120),
    new THREE.MeshStandardMaterial({
      color: "#7f8970",
      map: groundTexture,
      roughness: 1
    })
  );
  const terrainPositions = terrain.geometry.attributes.position;

  for (let index = 0; index < terrainPositions.count; index += 1) {
    const x = terrainPositions.getX(index);
    const z = terrainPositions.getY(index);
    const shoulderDistance = Math.max(0, Math.abs(x) - (ROAD_HALF_WIDTH + 0.7));
    const mountainSlope = shoulderDistance > 0
      ? 0.2 + shoulderDistance * shoulderDistance * 0.085
      : 0;
    const terrainNoise =
      Math.sin(z * 0.16) * 0.48 +
      Math.cos(x * 0.35) * 0.24 +
      Math.sin((x + z) * 0.11) * 0.46;
    const valleyNoise = shoulderDistance > 0 ? terrainNoise * Math.min(0.22 + shoulderDistance * 0.08, 1.15) : terrainNoise * 0.02;
    terrainPositions.setZ(index, mountainSlope + valleyNoise);
  }

  terrain.geometry.computeVertexNormals();
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.35;
  terrain.receiveShadow = true;
  targetScene.add(terrain);

  const bedrock = new THREE.Mesh(
    new THREE.CircleGeometry(48, 96),
    new THREE.MeshStandardMaterial({
      color: "#6c6a63",
      roughness: 1
    })
  );
  bedrock.rotation.x = -Math.PI / 2;
  bedrock.position.y = -0.9;
  targetScene.add(bedrock);

  createRoadShell(targetScene);

  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: "#7f8077",
    roughness: 1
  });
  for (let index = 0; index < 12; index += 1) {
    const ridge = new THREE.Mesh(
      new THREE.ConeGeometry(5 + (index % 3) * 1.3, 12 + (index % 4) * 2.4, 8),
      mountainMaterial
    );
    const angle = (index / 12) * Math.PI * 2;
    const radius = 29 + (index % 3) * 3.4;
    ridge.position.set(Math.cos(angle) * radius, 4.8, Math.sin(angle) * radius - 8);
    ridge.scale.x = 1.2 + (index % 2) * 0.35;
    ridge.scale.z = 1.05 + (index % 4) * 0.12;
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    targetScene.add(ridge);
  }

  for (let index = 0; index < 28; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * randomBetween(ROAD_HALF_WIDTH + 2.2, 20);
    const z = randomBetween(ROAD_END_Z - 18, ROAD_START_Z + 18);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(randomBetween(0.35, 1.25), 1),
      new THREE.MeshStandardMaterial({
        color: index % 3 === 0 ? "#8e8d83" : "#6f6a61",
        roughness: 1
      })
    );
    rock.position.set(x, randomBetween(0.18, 1.15), z);
    rock.rotation.set(randomBetween(0, Math.PI), randomBetween(0, Math.PI), randomBetween(0, Math.PI));
    rock.scale.set(randomBetween(0.9, 1.45), randomBetween(0.6, 1.2), randomBetween(0.75, 1.5));
    rock.castShadow = true;
    rock.receiveShadow = true;
    targetScene.add(rock);
  }

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#6f513d", roughness: 1 });
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: "#6e8465", roughness: 1 });
  for (let index = 0; index < 24; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const root = new THREE.Group();
    const x = side * randomBetween(ROAD_HALF_WIDTH + 3.4, 22);
    const z = randomBetween(ROAD_END_Z - 16, ROAD_START_Z + 16);
    root.position.set(x, randomBetween(0.12, 0.55), z);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.1, 8), trunkMaterial);
    trunk.position.y = 1.05;
    trunk.castShadow = true;
    root.add(trunk);

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.7, 10), foliageMaterial);
    canopy.position.y = 2.65;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    root.add(canopy);

    const canopyMid = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2, 10), foliageMaterial);
    canopyMid.position.y = 1.95;
    canopyMid.castShadow = true;
    canopyMid.receiveShadow = true;
    root.add(canopyMid);

    targetScene.add(root);
  }

  return {
    grassTufts: createGrassTufts(targetScene)
  };
}

function createRoadShell(targetScene: THREE.Scene): void {
  const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 10, 80);
  const roadPositions = roadGeometry.attributes.position;
  for (let index = 0; index < roadPositions.count; index += 1) {
    const x = roadPositions.getX(index);
    const z = roadPositions.getY(index);
    const camber = 0.06 - Math.abs(x) * 0.018;
    const wear = Math.sin(z * 0.32) * 0.012 + Math.cos(x * 2.1) * 0.008;
    roadPositions.setZ(index, camber + wear);
  }
  roadGeometry.computeVertexNormals();

  const roadBase = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      color: "#62625a",
      roughness: 0.96
    })
  );
  roadBase.rotation.x = -Math.PI / 2;
  roadBase.position.set(0, 0.08, ROAD_CENTER_Z);
  roadBase.receiveShadow = true;
  targetScene.add(roadBase);

  const dirtShoulderMaterial = new THREE.MeshStandardMaterial({ color: "#95866d", roughness: 1 });
  for (const side of [-1, 1] as const) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(1.65, ROAD_LENGTH, 3, 40), dirtShoulderMaterial);
    const shoulderPositions = shoulder.geometry.attributes.position;
    for (let index = 0; index < shoulderPositions.count; index += 1) {
      const x = shoulderPositions.getX(index);
      const z = shoulderPositions.getY(index);
      shoulderPositions.setZ(index, 0.05 + Math.abs(x) * 0.08 + Math.sin(z * 0.2 + side) * 0.03);
    }
    shoulder.geometry.computeVertexNormals();
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * (ROAD_HALF_WIDTH + 0.82), 0.03, ROAD_CENTER_Z);
    shoulder.receiveShadow = true;
    targetScene.add(shoulder);

    for (let z = ROAD_START_Z - 1.5; z >= ROAD_END_Z + 1.5; z -= 2.8) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(randomBetween(0.12, 0.24), 0),
        new THREE.MeshStandardMaterial({ color: "#9e9a8f", roughness: 1 })
      );
      stone.position.set(side * (ROAD_HALF_WIDTH + randomBetween(0.12, 0.32)), 0.18, z + randomBetween(-0.28, 0.28));
      stone.castShadow = true;
      stone.receiveShadow = true;
      targetScene.add(stone);
    }
  }

  const markerMaterial = new THREE.MeshStandardMaterial({
    color: "#f1eee7",
    roughness: 0.88
  });
  for (let z = ROAD_START_Z - 2; z >= ROAD_END_Z + 2; z -= 2.6) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.14, 10), markerMaterial);
    marker.rotation.x = Math.PI / 2;
    marker.position.set(0, 0.11, z);
    marker.receiveShadow = true;
    targetScene.add(marker);
  }

  const startPad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2, 0.22, 18),
    new THREE.MeshStandardMaterial({
      color: "#d9d5c6",
      emissive: "#bdefff",
      emissiveIntensity: 0.12,
      roughness: 0.88
    })
  );
  startPad.position.set(0, 0.1, PLAYER_START_Z + 1.1);
  startPad.receiveShadow = true;
  targetScene.add(startPad);
}

function createCourse(targetScene: THREE.Scene, level: number): CourseState {
  const definition = getLevelDefinition(level);
  const courseRoot = new THREE.Group();
  courseRoot.name = `course-level-${level}`;
  targetScene.add(courseRoot);

  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: "#7a5f42", roughness: 0.96 });
  const supportMaterial = new THREE.MeshStandardMaterial({ color: "#5f4634", roughness: 0.98 });
  const wrapMaterial = new THREE.MeshStandardMaterial({
    color: "#d5cdc0",
    roughness: 0.96
  });
  const obstacles = definition.obstacles.map((config) => {
    const mesh = new THREE.Group();
    mesh.position.set(config.x, 0, config.z);
    courseRoot.add(mesh);

    for (let row = 0; row < 3; row += 1) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, config.width * 0.96, 12),
        obstacleMaterial
      );
      log.rotation.z = Math.PI * 0.5 + (row - 1) * 0.04;
      log.position.set(0, 0.18 + row * Math.max(config.height * 0.3, 0.16), 0);
      log.castShadow = true;
      log.receiveShadow = true;
      mesh.add(log);
    }

    for (const side of [-1, 1] as const) {
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, config.height * 1.5, 10),
        supportMaterial
      );
      support.position.set(side * (config.width * 0.42), config.height * 0.5, 0);
      support.rotation.z = side * 0.4;
      support.castShadow = true;
      support.receiveShadow = true;
      mesh.add(support);

      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10), supportMaterial);
      spike.position.set(side * (config.width * 0.52), config.height * 0.94, 0);
      spike.rotation.z = side * 0.34;
      spike.castShadow = true;
      mesh.add(spike);
    }

    const wrap = new THREE.Mesh(
      new THREE.PlaneGeometry(config.width * 0.74, Math.max(config.height * 0.75, 0.36), 8, 3),
      wrapMaterial
    );
    const wrapPositions = wrap.geometry.attributes.position;
    for (let index = 0; index < wrapPositions.count; index += 1) {
      const x = wrapPositions.getX(index);
      wrapPositions.setZ(index, Math.sin((x / Math.max(config.width * 0.74, 0.01)) * Math.PI) * 0.08);
    }
    wrap.geometry.computeVertexNormals();
    wrap.position.set(0, config.height * 0.6, config.depth * 0.18);
    wrap.castShadow = true;
    wrap.receiveShadow = true;
    mesh.add(wrap);

    return {
      halfDepth: config.depth * 0.5,
      halfWidth: config.width * 0.5,
      mesh,
      requiredJumpHeight: config.height * 0.74,
      x: config.x,
      z: config.z
    };
  });

  const finishLine = createFinishLine(courseRoot, FINISH_TRIGGER_Z);
  const zombieRoot = new THREE.Group();
  zombieRoot.name = `zombies-level-${level}`;
  courseRoot.add(zombieRoot);
  gameState.teamChargeGoal = getChargeGoal(level);

  return {
    finishLine,
    obstacles,
    root: courseRoot,
    zombieRoot
  };
}

function getLevelDefinition(level: number): LevelTemplate {
  const templateIndex = (level - 1) % LEVEL_TEMPLATES.length;
  const cycle = Math.floor((level - 1) / LEVEL_TEMPLATES.length);
  const template = LEVEL_TEMPLATES[templateIndex];

  return {
    obstacles: [
      ...template.obstacles.map((obstacle, index) => {
        const width = clamp(obstacle.width - cycle * 0.12, 2.55, ROAD_WIDTH - 0.34);
        const xLimit = ROAD_HALF_WIDTH - width * 0.5 - 0.14;
        return {
          depth: Math.min(1.16, obstacle.depth + cycle * 0.04),
          height: Math.min(1.08, obstacle.height + cycle * 0.06),
          width,
          x: clamp(obstacle.x + Math.sin(level * 1.13 + index * 0.84) * 0.22 * cycle, -xLimit, xLimit),
          z: obstacle.z
        };
      }),
      ...Array.from({ length: Math.min(2, cycle) }, (_, extraIndex) => {
        const width = 2.4 + (extraIndex % 2) * 0.4;
        const x = extraIndex % 2 === 0 ? -1.2 : 1.2;
        return {
          depth: 0.72 + cycle * 0.03,
          height: 0.58 + cycle * 0.05,
          width,
          x,
          z: 6.2 - extraIndex * 7.8
        };
      })
    ]
  };
}

function createFinishLine(parent: THREE.Group, z: number): FinishLineState {
  const finishRoot = new THREE.Group();
  parent.add(finishRoot);

  const postMaterial = new THREE.MeshStandardMaterial({
    color: "#787066",
    roughness: 0.94
  });
  for (const side of [-1, 1] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.6, 12), postMaterial);
    post.position.set(side * 1.6, 1.25, z - 0.1);
    post.castShadow = true;
    post.receiveShadow = true;
    finishRoot.add(post);
  }

  const arch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.5, 12),
    postMaterial
  );
  arch.rotation.z = Math.PI / 2;
  arch.position.set(0, 2.48, z - 0.1);
  arch.castShadow = true;
  finishRoot.add(arch);

  const bannerMaterial = new THREE.MeshStandardMaterial({
    color: "#f2f1ec",
    emissive: "#c0e7ff",
    emissiveIntensity: 0.08,
    roughness: 0.88
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 0.7, 12, 1), bannerMaterial);
  banner.position.set(0, 2.46, z - 0.24);
  const bannerPositions = banner.geometry.attributes.position;
  for (let index = 0; index < bannerPositions.count; index += 1) {
    const x = bannerPositions.getX(index);
    bannerPositions.setZ(index, Math.sin((x / 3.15) * Math.PI) * 0.08);
  }
  banner.geometry.computeVertexNormals();
  banner.castShadow = true;
  finishRoot.add(banner);

  const lineMaterial = new THREE.MeshStandardMaterial({
    color: "#eff5f7",
    emissive: "#9bd8ff",
    emissiveIntensity: 0.2,
    roughness: 0.84
  });
  const lineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ROAD_WIDTH - 0.42, 12), lineMaterial);
  lineMesh.rotation.z = Math.PI / 2;
  lineMesh.position.set(0, 0.18, z);
  lineMesh.receiveShadow = true;
  finishRoot.add(lineMesh);

  const pulseMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.9, ROAD_HALF_WIDTH - 0.1, 40),
    new THREE.MeshStandardMaterial({
      color: "#fdfcf8",
      emissive: "#dbf2ff",
      emissiveIntensity: 0.18,
      opacity: 0.76,
      roughness: 0.9,
      transparent: true
    })
  );
  pulseMesh.rotation.x = -Math.PI / 2;
  pulseMesh.position.set(0, 0.12, z);
  pulseMesh.receiveShadow = true;
  finishRoot.add(pulseMesh);

  return {
    bannerMaterial,
    lineMaterial,
    lineMesh,
    pulseMesh,
    z
  };
}

function createGrassTufts(targetScene: THREE.Scene): GrassTuft[] {
  const tufts: GrassTuft[] = [];
  const bladeGeometry = new THREE.PlaneGeometry(0.2, 1);
  bladeGeometry.translate(0, 0.5, 0);

  const lightBlade = new THREE.MeshStandardMaterial({
    color: "#8fda64",
    roughness: 1,
    side: THREE.DoubleSide
  });
  const darkBlade = new THREE.MeshStandardMaterial({
    color: "#395724",
    roughness: 1,
    side: THREE.DoubleSide
  });

  for (let index = 0; index < 170; index += 1) {
    const x = randomBetween(-34, 34);
    const z = randomBetween(-34, 34);

    if (Math.hypot(x, z) < 2) {
      continue;
    }

    if (Math.abs(x) < ROAD_HALF_WIDTH + 0.95 && z <= ROAD_START_Z + 0.8 && z >= ROAD_END_Z - 0.8) {
      continue;
    }

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = Math.random() * Math.PI;

    const sway = new THREE.Group();
    root.add(sway);

    const bladeA = new THREE.Mesh(bladeGeometry, index % 3 === 0 ? darkBlade : lightBlade);
    bladeA.position.y = 0;
    sway.add(bladeA);

    const bladeB = new THREE.Mesh(bladeGeometry, index % 2 === 0 ? lightBlade : darkBlade);
    bladeB.rotation.y = Math.PI / 2;
    sway.add(bladeB);

    const scale = randomBetween(0.65, 1.5);
    sway.scale.setScalar(scale);

    targetScene.add(root);
    tufts.push({
      sway,
      swayAmount: randomBetween(0.04, 0.09),
      swayOffset: randomBetween(0, Math.PI * 2),
      swaySpeed: randomBetween(0.7, 1.6)
    });
  }

  return tufts;
}

function createAvatar(faceTexture: THREE.Texture): AvatarRig {
  const root = new THREE.Group();
  root.scale.setScalar(PLAYER_MODEL_SCALE);

  const hips = new THREE.Group();
  hips.position.y = 1.52;
  root.add(hips);

  const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#c15d3d", roughness: 0.88 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: "#5f7289", roughness: 0.92 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#efc6a8", roughness: 0.98 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: "#4b443c", roughness: 0.82 });

  const torso = new THREE.Group();
  torso.position.y = 0.58;
  hips.add(torso);

  const torsoMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.74, 8, 14),
    shirtMaterial
  );
  torsoMesh.scale.set(1.26, 1.04, 0.88);
  torsoMesh.position.y = 0.04;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 12), skinMaterial);
  neck.position.y = 0.72;
  neck.castShadow = true;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.98;
  torso.add(head);

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: "#40261d",
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    roughness: 0.96
  });

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 18, 16),
    skinMaterial
  );
  headMesh.scale.set(0.96, 1.04, 0.92);
  headMesh.position.y = 0.42;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  const faceMaterial = new THREE.MeshBasicMaterial({
    alphaTest: 0.08,
    depthWrite: false,
    map: faceTexture,
    transparent: true
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.83), faceMaterial);
  face.position.set(0, 0.42, -0.39);
  face.rotation.y = Math.PI;
  face.renderOrder = 2;
  head.add(face);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMaterial
  );
  hairCap.scale.set(1.02, 0.78, 1.02);
  hairCap.position.set(0, 0.58, 0.01);
  hairCap.castShadow = true;
  hairCap.receiveShadow = true;
  head.add(hairCap);

  const fringe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.11, 0.66, 12),
    hairMaterial
  );
  fringe.rotation.z = Math.PI / 2;
  fringe.position.set(0, 0.56, -0.32);
  fringe.castShadow = true;
  head.add(fringe);

  const leftSideHair = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08, 0.22, 4, 8),
    hairMaterial
  );
  leftSideHair.position.set(-0.39, 0.34, 0.02);
  leftSideHair.castShadow = true;
  head.add(leftSideHair);

  const rightSideHair = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08, 0.22, 4, 8),
    hairMaterial
  );
  rightSideHair.position.set(0.39, 0.34, 0.02);
  rightSideHair.castShadow = true;
  head.add(rightSideHair);

  const backHair = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.44, 6, 10),
    hairMaterial
  );
  backHair.scale.set(1.35, 1.08, 0.55);
  backHair.position.set(0, 0.28, 0.34);
  backHair.castShadow = true;
  backHair.receiveShadow = true;
  head.add(backHair);

  const leftArm = createArm(torso, -1, shirtMaterial, skinMaterial);
  const rightArm = createArm(torso, 1, shirtMaterial, skinMaterial);
  const leftLeg = createLeg(hips, -1, pantsMaterial, shoeMaterial);
  const rightLeg = createLeg(hips, 1, pantsMaterial, shoeMaterial);
  const weaponGrip = new THREE.Group();
  weaponGrip.position.set(0, -0.58, -0.06);
  weaponGrip.rotation.z = 0.16;
  rightArm.lowerPivot.add(weaponGrip);

  return {
    root,
    hips,
    torso,
    head,
    face,
    faceMaterial,
    hairMaterial,
    hairCap,
    fringe,
    leftSideHair,
    rightSideHair,
    backHair,
    weaponGrip,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg
  };
}

function createArm(
  parent: THREE.Group,
  side: -1 | 1,
  sleeveMaterial: THREE.Material,
  skinMaterial: THREE.Material
): LimbRig {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.74, 0.45, 0);
  pivot.rotation.z = side * 0.1;
  parent.add(pivot);

  const upperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.42, 4, 8),
    sleeveMaterial
  );
  upperArm.position.y = -0.32;
  upperArm.castShadow = true;
  upperArm.receiveShadow = true;
  pivot.add(upperArm);

  const lowerPivot = new THREE.Group();
  lowerPivot.position.y = -0.64;
  pivot.add(lowerPivot);

  const lowerArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.36, 4, 8),
    skinMaterial
  );
  lowerArm.position.y = -0.29;
  lowerArm.castShadow = true;
  lowerArm.receiveShadow = true;
  lowerPivot.add(lowerArm);

  const hand = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    skinMaterial
  );
  hand.position.y = -0.6;
  hand.castShadow = true;
  lowerPivot.add(hand);

  return { pivot, lowerPivot };
}

function createLeg(
  parent: THREE.Group,
  side: -1 | 1,
  pantsMaterial: THREE.Material,
  shoeMaterial: THREE.Material
): LimbRig {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.28, 0, 0);
  parent.add(pivot);

  const upperLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.46, 5, 8),
    pantsMaterial
  );
  upperLeg.position.y = -0.36;
  upperLeg.castShadow = true;
  upperLeg.receiveShadow = true;
  pivot.add(upperLeg);

  const lowerPivot = new THREE.Group();
  lowerPivot.position.y = -0.72;
  pivot.add(lowerPivot);

  const lowerLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.44, 5, 8),
    pantsMaterial
  );
  lowerLeg.position.y = -0.34;
  lowerLeg.castShadow = true;
  lowerLeg.receiveShadow = true;
  lowerPivot.add(lowerLeg);

  const footPivot = new THREE.Group();
  footPivot.position.y = -0.68;
  lowerPivot.add(footPivot);

  const foot = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 0.3, 4, 8),
    shoeMaterial
  );
  foot.rotation.z = Math.PI / 2;
  foot.scale.set(1.35, 1, 1.5);
  foot.position.set(0.05, -0.08, -0.08);
  foot.castShadow = true;
  foot.receiveShadow = true;
  footPivot.add(foot);

  return { pivot, lowerPivot, footPivot };
}

function setWeapon(weaponId: WeaponId): void {
  combatState.activeWeaponId = weaponId;
  avatar.weaponGrip.clear();
  avatar.weaponGrip.add(createWeaponMesh(WEAPON_PROFILES[weaponId]));

  for (const weaponButton of weaponButtons) {
    weaponButton.dataset.active = weaponButton.dataset.weapon === weaponId ? "true" : "false";
  }

  syncHud();
}

function createWeaponMesh(profile: WeaponProfile): THREE.Group {
  const weaponGroup = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, profile.id === "glaive" ? 1.8 : 0.9, 8),
    new THREE.MeshStandardMaterial({ color: "#2d1f18", roughness: 0.92 })
  );
  handle.castShadow = true;
  handle.rotation.z = Math.PI * 0.5;
  weaponGroup.add(handle);

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: profile.accent,
    emissive: profile.accent,
    emissiveIntensity: 0.12,
    metalness: 0.42,
    roughness: 0.28
  });

  if (profile.id === "katana") {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 12), accentMaterial);
    guard.rotation.z = Math.PI / 2;
    guard.position.x = 0.1;
    guard.castShadow = true;
    weaponGroup.add(guard);

    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.055, 1.08, 10), accentMaterial);
    blade.rotation.z = -Math.PI / 2;
    blade.position.x = 0.66;
    blade.castShadow = true;
    weaponGroup.add(blade);
  } else if (profile.id === "axe") {
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 0.12, 18, 1, false, 0, Math.PI),
      accentMaterial
    );
    head.rotation.x = Math.PI / 2;
    head.rotation.z = Math.PI / 2;
    head.position.x = 0.36;
    head.castShadow = true;
    weaponGroup.add(head);

    const bite = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 8), accentMaterial);
    bite.position.set(0.52, 0, 0);
    bite.rotation.z = -Math.PI / 2;
    bite.castShadow = true;
    weaponGroup.add(bite);
  } else {
    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.46, 10), accentMaterial);
    spearHead.position.x = 1.06;
    spearHead.rotation.z = -Math.PI / 2;
    spearHead.castShadow = true;
    weaponGroup.add(spearHead);

    const sideBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.34, 10), accentMaterial);
    sideBlade.rotation.z = -0.55;
    sideBlade.position.set(0.86, 0.02, 0);
    sideBlade.castShadow = true;
    weaponGroup.add(sideBlade);
  }

  return weaponGroup;
}

function tryStartAttack(): void {
  if (combatState.attackCooldown > 0 || combatState.attackTimer > 0) {
    return;
  }

  const weapon = WEAPON_PROFILES[combatState.activeWeaponId];
  combatState.attackCooldown = weapon.cooldown;
  combatState.attackHitDone = false;
  combatState.attackSerial += 1;
  combatState.attackTimer = weapon.swingDuration;
}

function resolveWeaponHits(profile: WeaponProfile): void {
  playerForwardVector.set(-Math.sin(motion.heading), 0, -Math.cos(motion.heading)).normalize();
  playerRightVector.set(-playerForwardVector.z, 0, playerForwardVector.x);

  for (const zombie of combatState.zombies) {
    if (zombie.lastHitAttackId === combatState.attackSerial || zombie.health <= 0) {
      continue;
    }

    attackOffsetVector.set(
      zombie.root.position.x - motion.playerPosition.x,
      0,
      zombie.root.position.z - motion.playerPosition.z
    );

    const distance = attackOffsetVector.length();
    if (distance > profile.range + zombie.radius) {
      continue;
    }

    const forwardDistance = attackOffsetVector.dot(playerForwardVector);
    const lateralDistance = Math.abs(attackOffsetVector.dot(playerRightVector));
    if (forwardDistance < -0.14 || forwardDistance > profile.range + zombie.radius * 0.6) {
      continue;
    }

    if (lateralDistance > profile.hitWidth * 0.5 + zombie.radius) {
      continue;
    }

    if (Math.hypot(forwardDistance, lateralDistance) > profile.range + zombie.radius * 0.5) {
      continue;
    }

    if (distance > 0.0001) {
      attackOffsetVector.multiplyScalar(1 / distance);
    }

    zombie.lastHitAttackId = combatState.attackSerial;
    zombie.health -= profile.damage * (zombie.variant === "brute" ? 0.82 : 1);
    zombie.hitFlash = 0.18;
    zombie.stun = 0.18;
    zombie.root.position.addScaledVector(attackOffsetVector, profile.knockback * 0.12);
  }
}

function tryStartZombieJump(zombie: ZombieState, moveDirection: THREE.Vector3): void {
  if (!zombie.isGrounded) {
    return;
  }

  zombieRightVector.set(-moveDirection.z, 0, moveDirection.x);

  for (const obstacle of currentCourse.obstacles) {
    if (obstacle.requiredJumpHeight > 1.06) {
      continue;
    }

    obstacleOffsetVector.set(
      obstacle.x - zombie.root.position.x,
      0,
      obstacle.z - zombie.root.position.z
    );
    const forwardDistance = obstacleOffsetVector.dot(moveDirection);

    if (forwardDistance < 0.04 || forwardDistance > ZOMBIE_JUMP_LOOKAHEAD + obstacle.halfDepth) {
      continue;
    }

    const lateralDistance = Math.abs(obstacleOffsetVector.dot(zombieRightVector));
    if (lateralDistance > obstacle.halfWidth + zombie.radius * 0.7) {
      continue;
    }

    zombie.verticalVelocity = ZOMBIE_JUMP_SPEED + (zombie.variant === "brute" ? 0.25 : 0);
    zombie.isGrounded = false;
    return;
  }
}

function getChargeGoal(level: number): number {
  return 8 + level * 4;
}

function getZombieSpawnDelay(): number {
  const pressure = gameState.teamChargeGoal > 0 ? gameState.teamCharge / gameState.teamChargeGoal : 0;
  return clamp(1.35 - gameState.currentLevel * 0.06 - pressure * 0.28, 0.38, 1.15);
}

function spawnZombie(elapsed: number): void {
  const bruteChance = gameState.currentLevel >= 3 ? Math.min(0.1 + gameState.currentLevel * 0.035, 0.42) : 0;
  const isBrute = Math.random() < bruteChance;
  const spawnBehindPlayer = gameState.currentLevel >= 4 && Math.random() < 0.18;
  const spawnX = randomBetween(-ROAD_HALF_WIDTH + 0.5, ROAD_HALF_WIDTH - 0.5);
  const spawnZ = spawnBehindPlayer ? PLAYER_START_Z + 2.6 : ROAD_END_Z - 2.4 - Math.random() * 1.6;
  const zombie = createZombie(spawnX, spawnZ, elapsed, isBrute);
  currentCourse.zombieRoot.add(zombie.root);
  combatState.zombies.push(zombie);
}

function createZombie(x: number, z: number, elapsed: number, isBrute: boolean): ZombieState {
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: isBrute ? "#6f6358" : "#566758",
    emissive: isBrute ? "#b18a6d" : "#89af90",
    emissiveIntensity: isBrute ? 0.08 : 0.04,
    roughness: 0.94
  });
  const limbMaterial = new THREE.MeshStandardMaterial({
    color: isBrute ? "#b4ad9c" : "#a3ad98",
    roughness: 0.98
  });

  const hips = new THREE.Group();
  hips.position.y = isBrute ? 1.42 : 1.24;
  root.add(hips);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(isBrute ? 0.34 : 0.28, isBrute ? 0.82 : 0.68, 8, 12),
    bodyMaterial
  );
  torso.scale.set(1.12, 1.14, 0.88);
  torso.rotation.x = 0.08;
  torso.castShadow = true;
  torso.receiveShadow = true;
  hips.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(isBrute ? 0.3 : 0.26, 16, 14),
    limbMaterial
  );
  head.position.y = isBrute ? 0.96 : 0.82;
  head.scale.set(0.96, 1.04, 0.92);
  head.castShadow = true;
  hips.add(head);

  const leftArm = new THREE.Group();
  leftArm.position.set(isBrute ? -0.54 : -0.44, isBrute ? 0.32 : 0.26, 0);
  hips.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(isBrute ? 0.54 : 0.44, isBrute ? 0.32 : 0.26, 0);
  hips.add(rightArm);

  for (const arm of [leftArm, rightArm]) {
    const armMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(isBrute ? 0.09 : 0.08, isBrute ? 0.58 : 0.48, 5, 8),
      limbMaterial
    );
    armMesh.position.y = -(isBrute ? 0.44 : 0.37);
    armMesh.castShadow = true;
    arm.add(armMesh);
  }

  const leftLeg = new THREE.Group();
  leftLeg.position.set(isBrute ? -0.2 : -0.16, -0.62, 0);
  hips.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(isBrute ? 0.2 : 0.16, -0.62, 0);
  hips.add(rightLeg);

  for (const leg of [leftLeg, rightLeg]) {
    const legMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(isBrute ? 0.11 : 0.09, isBrute ? 0.62 : 0.5, 5, 8),
      bodyMaterial
    );
    legMesh.position.y = -(isBrute ? 0.5 : 0.42);
    legMesh.castShadow = true;
    leg.add(legMesh);
  }

  const baseHealth = isBrute ? 92 : 44;
  const baseSpeed = isBrute ? 1.2 : 1.5;
  const radius = isBrute ? 0.48 : 0.38;

  return {
    attackCooldown: 0,
    bodyMaterial,
    damage: isBrute ? 11 + gameState.currentLevel : 5 + Math.floor(gameState.currentLevel * 0.6),
    health: baseHealth + gameState.currentLevel * (isBrute ? 12 : 6),
    hitFlash: 0,
    isGrounded: true,
    jumpHeight: 0,
    lastHitAttackId: -1,
    leftArm,
    leftLeg,
    maxHealth: baseHealth + gameState.currentLevel * (isBrute ? 12 : 6),
    radius,
    rightArm,
    rightLeg,
    root,
    speed: Math.min(baseSpeed + gameState.currentLevel * 0.06, isBrute ? 2.05 : 2.5),
    stun: 0,
    verticalVelocity: 0,
    variant: isBrute ? "brute" : "walker",
    wobbleOffset: elapsed + Math.random() * Math.PI * 2
  };
}

function updateZombieAnimation(zombie: ZombieState, elapsed: number, distanceToPlayer: number): void {
  const gaitSpeed = elapsed * (zombie.variant === "brute" ? 4 : 5.2) + zombie.wobbleOffset;
  const gait = Math.sin(gaitSpeed);
  const oppositeGait = Math.sin(gaitSpeed + Math.PI);
  const attackReach = distanceToPlayer <= PLAYER_ATTACK_RADIUS ? 0.42 : 0;
  const jumpLift = clamp(zombie.jumpHeight / 1.25, 0, 1);

  zombie.leftArm.rotation.x = oppositeGait * 0.44 - attackReach - jumpLift * 0.18;
  zombie.rightArm.rotation.x = gait * 0.44 - attackReach - jumpLift * 0.18;
  zombie.leftLeg.rotation.x = gait * 0.34 + jumpLift * 0.24;
  zombie.rightLeg.rotation.x = oppositeGait * 0.34 + jumpLift * 0.24;
  zombie.root.position.y = zombie.jumpHeight + Math.sin(gaitSpeed * 2) * (zombie.isGrounded ? 0.04 : 0.015);
}

function resolveZombieObstacleCollisions(zombie: ZombieState): void {
  for (const obstacle of currentCourse.obstacles) {
    const jumpClearance = zombie.jumpHeight + Math.max(0, zombie.verticalVelocity) * 0.06;
    if (jumpClearance >= obstacle.requiredJumpHeight - 0.04) {
      continue;
    }

    zombiePushVector.set(zombie.root.position.x - obstacle.x, 0, zombie.root.position.z - obstacle.z);
    const overlapX = obstacle.halfWidth + zombie.radius - Math.abs(zombiePushVector.x);
    const overlapZ = obstacle.halfDepth + zombie.radius - Math.abs(zombiePushVector.z);

    if (overlapX <= 0 || overlapZ <= 0) {
      continue;
    }

    if (overlapX < overlapZ) {
      zombie.root.position.x = obstacle.x + Math.sign(zombiePushVector.x || 1) * (obstacle.halfWidth + zombie.radius + 0.02);
    } else {
      zombie.root.position.z = obstacle.z + Math.sign(zombiePushVector.z || 1) * (obstacle.halfDepth + zombie.radius + 0.02);
    }
  }
}

function defeatZombie(index: number, zombie: ZombieState): void {
  currentCourse.zombieRoot.remove(zombie.root);
  combatState.zombies.splice(index, 1);
  gameState.totalKills += 1;
  gameState.teamCharge = Math.min(gameState.teamChargeGoal, gameState.teamCharge + (zombie.variant === "brute" ? 2 : 1));
}

function createGroundTexture(targetRenderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  context.fillStyle = "#42503d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 1800; index += 1) {
    context.fillStyle = index % 4 === 0 ? "rgba(23, 41, 24, 0.2)" : "rgba(98, 119, 84, 0.15)";
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const width = randomBetween(2, 10);
    const height = randomBetween(1, 4);
    context.fillRect(x, y, width, height);
  }

  for (let index = 0; index < 260; index += 1) {
    context.fillStyle = "rgba(255, 142, 78, 0.08)";
    context.beginPath();
    context.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      randomBetween(3, 12),
      0,
      Math.PI * 2
    );
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.anisotropy = targetRenderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createDefaultFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEXTURE_WIDTH;
  canvas.height = FACE_TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  const gradient = context.createLinearGradient(0, 0, FACE_TEXTURE_WIDTH, FACE_TEXTURE_HEIGHT);
  gradient.addColorStop(0, "#2f4255");
  gradient.addColorStop(1, "#ff8f57");
  context.fillStyle = gradient;
  context.fillRect(0, 0, FACE_TEXTURE_WIDTH, FACE_TEXTURE_HEIGHT);

  context.fillStyle = "rgba(255, 232, 200, 0.18)";
  context.beginPath();
  context.arc(FACE_TEXTURE_WIDTH * 0.5, FACE_TEXTURE_HEIGHT * 0.43, 110, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f5f7fb";
  context.font = '700 34px "Space Grotesk", sans-serif';
  context.textAlign = "center";
  context.fillText("SURVIVE", FACE_TEXTURE_WIDTH * 0.5, FACE_TEXTURE_HEIGHT * 0.82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function buildAvatarAppearanceFromFile(file: File): Promise<AvatarAppearance> {
  const image = await loadImage(URL.createObjectURL(file));
  const faceBounds = (await detectPrimaryFace(image)) ?? createFallbackFaceBounds(image.width, image.height);
  const crop = computeFaceCrop(faceBounds, image.width, image.height);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = image.width;
  sampleCanvas.height = image.height;
  const sampleContext = sampleCanvas.getContext("2d");

  if (!sampleContext) {
    throw new Error("2D context unavailable");
  }

  sampleContext.drawImage(image, 0, 0, image.width, image.height);

  return {
    hairProfile: buildHairProfile(sampleContext, faceBounds, crop),
    texture: buildMaskedFaceTexture(image, crop)
  };
}

function buildMaskedFaceTexture(image: HTMLImageElement, crop: FaceCrop): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEXTURE_WIDTH;
  canvas.height = FACE_TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();
  drawFaceMask(context, canvas.width, canvas.height);
  context.clip();
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function detectPrimaryFace(image: HTMLImageElement): Promise<FaceBounds | null> {
  const FaceDetector = (window as Window & { FaceDetector?: FaceDetectorConstructor }).FaceDetector;

  if (!FaceDetector) {
    return null;
  }

  try {
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
    const detections = await detector.detect(image);

    if (detections.length === 0) {
      return null;
    }

    const largest = detections.reduce((currentLargest, detection) => {
      const currentArea = currentLargest.boundingBox.width * currentLargest.boundingBox.height;
      const candidateArea = detection.boundingBox.width * detection.boundingBox.height;
      return candidateArea > currentArea ? detection : currentLargest;
    });

    return {
      height: largest.boundingBox.height,
      width: largest.boundingBox.width,
      x: largest.boundingBox.x,
      y: largest.boundingBox.y
    };
  } catch {
    return null;
  }
}

function createFallbackFaceBounds(imageWidth: number, imageHeight: number): FaceBounds {
  const size = Math.min(imageWidth, imageHeight) * 0.42;
  return {
    height: size * 1.14,
    width: size,
    x: imageWidth * 0.5 - size * 0.5,
    y: imageHeight * 0.16
  };
}

function computeFaceCrop(faceBounds: FaceBounds, imageWidth: number, imageHeight: number): FaceCrop {
  const textureAspect = FACE_TEXTURE_WIDTH / FACE_TEXTURE_HEIGHT;
  let cropHeight = faceBounds.height * 1.58;
  let cropWidth = cropHeight * textureAspect;

  if (cropWidth < faceBounds.width * 1.46) {
    cropWidth = faceBounds.width * 1.46;
    cropHeight = cropWidth / textureAspect;
  }

  const centerX = faceBounds.x + faceBounds.width * 0.5;
  const top = faceBounds.y - faceBounds.height * 0.28;

  cropWidth = Math.min(cropWidth, imageWidth);
  cropHeight = Math.min(cropHeight, imageHeight);

  return {
    height: cropHeight,
    width: cropWidth,
    x: clamp(centerX - cropWidth * 0.5, 0, imageWidth - cropWidth),
    y: clamp(top, 0, imageHeight - cropHeight)
  };
}

function drawFaceMask(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.beginPath();
  context.ellipse(width * 0.5, height * 0.5, width * 0.42, height * 0.47, 0, 0, Math.PI * 2);
  context.closePath();
}

function buildHairProfile(
  context: CanvasRenderingContext2D,
  faceBounds: FaceBounds,
  crop: FaceCrop
): HairProfile {
  const skinColor = sampleAverageColor(
    context,
    {
      height: faceBounds.height * 0.24,
      width: faceBounds.width * 0.34,
      x: faceBounds.x + faceBounds.width * 0.33,
      y: faceBounds.y + faceBounds.height * 0.36
    },
    null
  );

  const hairColor = sampleAverageColor(
    context,
    {
      height: faceBounds.height * 0.34,
      width: faceBounds.width * 0.68,
      x: faceBounds.x + faceBounds.width * 0.16,
      y: faceBounds.y - faceBounds.height * 0.25
    },
    skinColor
  );

  const sideCoverage = Math.max(
    measureHairCoverage(
      context,
      {
        height: faceBounds.height * 0.9,
        width: faceBounds.width * 0.24,
        x: faceBounds.x - faceBounds.width * 0.14,
        y: faceBounds.y + faceBounds.height * 0.14
      },
      skinColor
    ),
    measureHairCoverage(
      context,
      {
        height: faceBounds.height * 0.9,
        width: faceBounds.width * 0.24,
        x: faceBounds.x + faceBounds.width * 0.9,
        y: faceBounds.y + faceBounds.height * 0.14
      },
      skinColor
    )
  );

  const fringeCoverage = measureHairCoverage(
    context,
    {
      height: faceBounds.height * 0.22,
      width: faceBounds.width * 0.66,
      x: faceBounds.x + faceBounds.width * 0.17,
      y: faceBounds.y - faceBounds.height * 0.06
    },
    skinColor
  );

  const backCoverage = measureHairCoverage(
    context,
    {
      height: crop.height * 0.38,
      width: faceBounds.width * 0.84,
      x: faceBounds.x + faceBounds.width * 0.08,
      y: faceBounds.y + faceBounds.height * 0.38
    },
    skinColor
  );

  return {
    backScaleY: backCoverage > 0.3 || sideCoverage > 0.28 ? 1.45 : 1,
    capScaleY: fringeCoverage > 0.2 ? 1.08 : 1,
    color: tuneHairColor(hairColor),
    fringeScaleY: fringeCoverage > 0.25 ? 1.18 : 0.82,
    sideScaleY: sideCoverage > 0.28 ? 1.42 : 0.92
  };
}

function applyHairProfile(avatarRig: AvatarRig, hairProfile: HairProfile): void {
  avatarRig.hairMaterial.color.copy(hairProfile.color);

  avatarRig.hairCap.scale.y = hairProfile.capScaleY;
  avatarRig.hairCap.position.y = 0.73 + (hairProfile.capScaleY - 1) * 0.06;

  avatarRig.fringe.scale.y = hairProfile.fringeScaleY;
  avatarRig.fringe.position.y = 0.59 - (hairProfile.fringeScaleY - 1) * 0.05;

  avatarRig.leftSideHair.scale.y = hairProfile.sideScaleY;
  avatarRig.rightSideHair.scale.y = hairProfile.sideScaleY;
  avatarRig.leftSideHair.position.y = 0.39 - (hairProfile.sideScaleY - 1) * 0.12;
  avatarRig.rightSideHair.position.y = 0.39 - (hairProfile.sideScaleY - 1) * 0.12;

  avatarRig.backHair.scale.y = hairProfile.backScaleY;
  avatarRig.backHair.position.y = 0.33 - (hairProfile.backScaleY - 1) * 0.14;
}

function sampleAverageColor(
  context: CanvasRenderingContext2D,
  region: FaceCrop,
  skinColor: THREE.Color | null
): THREE.Color {
  const imageData = getRegionImageData(context, region);
  const pixels = imageData.data;
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let weightSum = 0;
  const skinRed = skinColor ? skinColor.r * 255 : 0;
  const skinGreen = skinColor ? skinColor.g * 255 : 0;
  const skinBlue = skinColor ? skinColor.b * 255 : 0;

  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha < 12) {
      continue;
    }

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    let weight = 1;

    if (skinColor) {
      const colorDistance = Math.hypot(red - skinRed, green - skinGreen, blue - skinBlue);
      weight = Math.max(0, colorDistance - 16) * 0.03 + Math.max(0, 165 - luminance) * 0.01 + saturation * 0.004;
    }

    if (weight <= 0) {
      continue;
    }

    redSum += red * weight;
    greenSum += green * weight;
    blueSum += blue * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return new THREE.Color("#4a2e23");
  }

  return new THREE.Color(redSum / (255 * weightSum), greenSum / (255 * weightSum), blueSum / (255 * weightSum));
}

function measureHairCoverage(
  context: CanvasRenderingContext2D,
  region: FaceCrop,
  skinColor: THREE.Color
): number {
  const imageData = getRegionImageData(context, region);
  const pixels = imageData.data;
  const skinRed = skinColor.r * 255;
  const skinGreen = skinColor.g * 255;
  const skinBlue = skinColor.b * 255;
  let covered = 0;
  let samples = 0;

  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha < 12) {
      continue;
    }

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const colorDistance = Math.hypot(red - skinRed, green - skinGreen, blue - skinBlue);

    if (colorDistance > 24 || luminance < 135) {
      covered += 1;
    }

    samples += 1;
  }

  if (samples === 0) {
    return 0;
  }

  return covered / samples;
}

function getRegionImageData(context: CanvasRenderingContext2D, region: FaceCrop): ImageData {
  const maxWidth = context.canvas.width;
  const maxHeight = context.canvas.height;
  const x = clamp(Math.floor(region.x), 0, maxWidth - 1);
  const y = clamp(Math.floor(region.y), 0, maxHeight - 1);
  const width = clamp(Math.floor(region.width), 1, maxWidth - x);
  const height = clamp(Math.floor(region.height), 1, maxHeight - y);
  return context.getImageData(x, y, width, height);
}

function tuneHairColor(color: THREE.Color): THREE.Color {
  const tuned = color.clone();
  const hsl = { h: 0, l: 0, s: 0 };
  tuned.getHSL(hsl);
  tuned.setHSL(hsl.h, clamp(hsl.s, 0.15, 0.7), clamp(hsl.l, 0.08, 0.62));
  return tuned;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Image load failed"));
    };
    image.src = source;
  });
}

function setModalOpen(open: boolean): void {
  uploadModal.dataset.open = String(open);
}

function isMovementKey(key: string): boolean {
  return [
    "a",
    "q",
    "d",
    "s",
    "w",
    "z",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "arrowup"
  ].includes(key);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function damp(current: number, target: number, delta: number, lambda: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

function dampAngle(current: number, target: number, delta: number, lambda: number): number {
  const difference = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + difference * (1 - Math.exp(-lambda * delta));
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element as T;
}
