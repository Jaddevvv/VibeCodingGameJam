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
  mesh: THREE.Mesh;
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

type LevelCoinConfig = {
  x: number;
  y: number;
  z: number;
};

type LevelTemplate = {
  coins: LevelCoinConfig[];
  obstacles: LevelObstacleConfig[];
};

type CoinState = {
  baseY: number;
  collected: boolean;
  mesh: THREE.Group;
  spinOffset: number;
  x: number;
  y: number;
  z: number;
};

type FinishLineState = {
  bannerMaterial: THREE.MeshStandardMaterial;
  lineMaterial: THREE.MeshStandardMaterial;
  lineMesh: THREE.Mesh;
  pulseMesh: THREE.Mesh;
  z: number;
};

type CourseState = {
  coins: CoinState[];
  finishLine: FinishLineState;
  obstacles: CourseObstacle[];
  root: THREE.Group;
};

type GameState = {
  collectedCoins: number;
  currentLevel: number;
  pendingAdvanceAt: number | null;
  totalCoins: number;
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
const PLAYER_RADIUS = 0.38;
const PLAYER_START_Z = 14;
const RUN_SPEED = 7.2;
const JUMP_SPEED = 6.7;
const GRAVITY = 18;
const CAMERA_DISTANCE = 7.2;
const CAMERA_LOOK_HEIGHT = 2;
const CAMERA_PITCH_MIN = 0.18;
const CAMERA_PITCH_MAX = 0.8;
const LOOK_SENSITIVITY = 0.0048;
const FACE_TEXTURE_WIDTH = 512;
const FACE_TEXTURE_HEIGHT = 544;
const ROAD_WIDTH = 5.8;
const ROAD_HALF_WIDTH = ROAD_WIDTH * 0.5;
const ROAD_START_Z = 15.5;
const ROAD_END_Z = -15.5;
const ROAD_LENGTH = ROAD_START_Z - ROAD_END_Z;
const ROAD_CENTER_Z = (ROAD_START_Z + ROAD_END_Z) * 0.5;
const FINISH_TRIGGER_Z = ROAD_END_Z + 1.1;

const LEVEL_TEMPLATES: LevelTemplate[] = [
  {
    coins: [
      { x: 0, y: 1.1, z: 11.6 },
      { x: -1.2, y: 1.08, z: 8.8 },
      { x: 1.15, y: 1.1, z: 5.4 },
      { x: -0.7, y: 1.08, z: 1.4 },
      { x: 0, y: 1.14, z: -6.9 }
    ],
    obstacles: [
      { depth: 0.64, height: 0.42, width: 4.4, x: 0, z: 8.2 },
      { depth: 0.7, height: 0.5, width: 3.5, x: -0.55, z: 3.1 },
      { depth: 0.76, height: 0.62, width: 3.9, x: 0.6, z: -2.5 },
      { depth: 0.82, height: 0.72, width: 4.6, x: 0, z: -8.4 }
    ]
  },
  {
    coins: [
      { x: -1.05, y: 1.08, z: 11.1 },
      { x: 1.15, y: 1.08, z: 8.2 },
      { x: -1.15, y: 1.12, z: 4.6 },
      { x: 1.2, y: 1.12, z: 0.2 },
      { x: -0.55, y: 1.1, z: -4.9 },
      { x: 0.7, y: 1.12, z: -9.8 }
    ],
    obstacles: [
      { depth: 0.66, height: 0.48, width: 4.2, x: 0.55, z: 9.1 },
      { depth: 0.74, height: 0.56, width: 3.1, x: -0.95, z: 5.4 },
      { depth: 0.78, height: 0.64, width: 4.7, x: 0, z: 0.7 },
      { depth: 0.82, height: 0.74, width: 3.1, x: 1, z: -4.1 },
      { depth: 0.9, height: 0.82, width: 4.8, x: 0, z: -10.6 }
    ]
  },
  {
    coins: [
      { x: 0, y: 1.08, z: 12.1 },
      { x: -1.35, y: 1.1, z: 9.2 },
      { x: 1.35, y: 1.1, z: 6.4 },
      { x: -1.2, y: 1.16, z: 2.5 },
      { x: 1.2, y: 1.16, z: -1.2 },
      { x: 0, y: 1.12, z: -5.7 },
      { x: 0, y: 1.14, z: -10.9 }
    ],
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
    coins: [
      { x: -1.25, y: 1.1, z: 11.8 },
      { x: 1.25, y: 1.1, z: 9.3 },
      { x: 0, y: 1.12, z: 6.6 },
      { x: -1.35, y: 1.15, z: 3.4 },
      { x: 1.35, y: 1.15, z: 0.4 },
      { x: -1.1, y: 1.12, z: -3.3 },
      { x: 1.1, y: 1.12, z: -6.5 },
      { x: 0, y: 1.16, z: -11.3 }
    ],
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

const sceneRoot = getElement<HTMLDivElement>("sceneRoot");
const photoInput = getElement<HTMLInputElement>("photoInput");
const changePhotoButton = getElement<HTMLButtonElement>("changePhotoButton");
const coinCountValue = getElement<HTMLSpanElement>("coinCountValue");
const goalValue = getElement<HTMLSpanElement>("goalValue");
const levelValue = getElement<HTMLSpanElement>("levelValue");
const uploadModal = getElement<HTMLDivElement>("uploadModal");
const uploadStatus = getElement<HTMLSpanElement>("uploadStatus");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
sceneRoot.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#cfeaff");
scene.fog = new THREE.Fog("#cfeaff", 18, 60);

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
const cameraForwardVector = new THREE.Vector3();
const cameraRightVector = new THREE.Vector3();
const zeroVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

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
  pitch: 0.34,
  targetPitch: 0.34,
  targetYaw: 0,
  yaw: 0
};

const environment = createEnvironment(scene, renderer);
const grassTufts = environment.grassTufts;
const gameState: GameState = {
  collectedCoins: 0,
  currentLevel: 1,
  pendingAdvanceAt: null,
  totalCoins: 0
};
let currentCourse = createCourse(scene, gameState.currentLevel);
let activeFaceTexture = createDefaultFaceTexture();
const avatar = createAvatar(activeFaceTexture);
scene.add(avatar.root);
avatar.root.position.copy(motion.playerPosition);

camera.position.set(0, 4.3, PLAYER_START_Z + CAMERA_DISTANCE);
camera.lookAt(avatar.root.position);
syncHud();

let hasUploadedFace = false;
let hasPointerReference = false;
let lastPointerX = 0;
let lastPointerY = 0;
let jumpQueued = false;

renderer.domElement.addEventListener("click", () => {
  if (uploadModal.dataset.open === "true" || document.pointerLockElement === renderer.domElement) {
    return;
  }

  void renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener("mouseenter", (event) => {
  hasPointerReference = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});

renderer.domElement.addEventListener("mouseleave", () => {
  if (document.pointerLockElement !== renderer.domElement) {
    hasPointerReference = false;
  }
});

renderer.domElement.addEventListener("mousemove", (event) => {
  if (uploadModal.dataset.open === "true") {
    return;
  }

  const isLocked = document.pointerLockElement === renderer.domElement;
  if (!isLocked && !hasPointerReference) {
    hasPointerReference = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    return;
  }

  const deltaX = isLocked ? event.movementX : event.clientX - lastPointerX;
  const deltaY = isLocked ? event.movementY : event.clientY - lastPointerY;

  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  applyLookDelta(deltaX, deltaY);
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== renderer.domElement) {
    hasPointerReference = false;
  }
});

changePhotoButton.addEventListener("click", () => {
  if (document.pointerLockElement === renderer.domElement) {
    void document.exitPointerLock();
  }
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
  jumpQueued = false;
});

window.addEventListener("resize", handleResize);

animate();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateMotion(delta);
  updateCourse(elapsed);
  updateAvatar(delta, elapsed);
  updateGrass(elapsed);
  updateCamera(delta);

  renderer.render(scene, camera);
}

function updateMotion(delta: number): void {
  if (gameState.pendingAdvanceAt !== null) {
    motion.velocity.lerp(zeroVector, 1 - Math.exp(-delta * 12));
    motion.speed = 0;
    motion.moveBlend = damp(motion.moveBlend, 0, delta, 10);
    return;
  }

  if (jumpQueued && motion.isGrounded) {
    motion.verticalVelocity = JUMP_SPEED;
    motion.isGrounded = false;
  }
  jumpQueued = false;

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
    cameraForwardVector.set(-Math.sin(cameraState.targetYaw), 0, -Math.cos(cameraState.targetYaw));
    cameraRightVector.crossVectors(cameraForwardVector, upVector).normalize();
    moveDirection
      .copy(cameraRightVector)
      .multiplyScalar(moveInput.x)
      .addScaledVector(cameraForwardVector, -moveInput.z);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      motion.velocity.lerp(moveDirection.multiplyScalar(RUN_SPEED), 1 - Math.exp(-delta * 12));
    }
  } else {
    motion.velocity.lerp(zeroVector, 1 - Math.exp(-delta * 10));
  }

  motion.playerPosition.addScaledVector(motion.velocity, delta);
  motion.playerPosition.x = clamp(motion.playerPosition.x, -WORLD_LIMIT, WORLD_LIMIT);
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

  if (!motion.isGrounded || motion.verticalVelocity > 0) {
    motion.verticalVelocity -= GRAVITY * delta;
    motion.jumpHeight = Math.max(0, motion.jumpHeight + motion.verticalVelocity * delta);

    if (motion.jumpHeight === 0 && motion.verticalVelocity <= 0) {
      motion.verticalVelocity = 0;
      motion.isGrounded = true;
    }
  }

  motion.moveBlend = damp(motion.moveBlend, motion.speed > 0.2 ? 1 : 0, delta, 10);
  motion.runCycle += delta * (1.6 + motion.speed * 0.92);
}

function updateCourse(elapsed: number): void {
  animateCoins(elapsed);
  animateFinishLine(elapsed);
  collectCoins();

  if (gameState.pendingAdvanceAt !== null) {
    if (elapsed >= gameState.pendingAdvanceAt) {
      startLevel(gameState.currentLevel + 1);
    }
    syncHud();
    return;
  }

  if (gameState.collectedCoins >= gameState.totalCoins && motion.playerPosition.z <= currentCourse.finishLine.z) {
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

  avatar.root.position.copy(motion.playerPosition);
  avatar.root.position.y = motion.jumpHeight;
  avatar.root.rotation.y = motion.heading;

  avatar.hips.position.y = 1.52 + bounce * 0.055 * motion.moveBlend + idle * 0.018 * (1 - motion.moveBlend) - airBlend * 0.05;
  avatar.torso.rotation.x = 0.16 * motion.moveBlend + bounce * 0.03 * motion.moveBlend + idle * 0.02 * (1 - motion.moveBlend) - airLift * 0.1;
  avatar.torso.rotation.z = gait * 0.035 * motion.moveBlend + idleSway * 0.015 * (1 - motion.moveBlend);
  avatar.head.rotation.x = -0.06 * motion.moveBlend - idle * 0.015 + airLift * 0.08;
  avatar.head.rotation.z = -gait * 0.015 * motion.moveBlend;

  avatar.leftArm.pivot.rotation.x = oppositeGait * 0.95 * motion.moveBlend + idle * 0.08 * (1 - motion.moveBlend) - airLift * 0.18;
  avatar.rightArm.pivot.rotation.x = gait * 0.95 * motion.moveBlend - idle * 0.08 * (1 - motion.moveBlend) - airLift * 0.18;
  avatar.leftArm.lowerPivot.rotation.x = 0.22 + Math.max(0, -oppositeGait) * 0.46 * motion.moveBlend;
  avatar.rightArm.lowerPivot.rotation.x = 0.22 + Math.max(0, -gait) * 0.46 * motion.moveBlend;

  avatar.leftLeg.pivot.rotation.x = gait * 0.88 * motion.moveBlend + airLift * 0.2;
  avatar.rightLeg.pivot.rotation.x = oppositeGait * 0.88 * motion.moveBlend + airLift * 0.2;
  avatar.leftLeg.lowerPivot.rotation.x = Math.max(0, -gait) * 0.7 * motion.moveBlend + airLift * 0.36;
  avatar.rightLeg.lowerPivot.rotation.x = Math.max(0, -oppositeGait) * 0.7 * motion.moveBlend + airLift * 0.36;

  if (avatar.leftLeg.footPivot && avatar.rightLeg.footPivot) {
    avatar.leftLeg.footPivot.rotation.x = Math.max(0, gait) * 0.26 * motion.moveBlend;
    avatar.rightLeg.footPivot.rotation.x = Math.max(0, oppositeGait) * 0.26 * motion.moveBlend;
  }
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
  cameraOffset.set(
    Math.sin(cameraState.yaw) * horizontalDistance,
    1.7 + Math.sin(cameraState.pitch) * CAMERA_DISTANCE,
    Math.cos(cameraState.yaw) * horizontalDistance
  );

  cameraTarget
    .copy(motion.playerPosition)
    .add(new THREE.Vector3(0, CAMERA_LOOK_HEIGHT + motion.jumpHeight * 0.82, 0));

  if (motion.speed > 0.2) {
    cameraTarget.addScaledVector(motion.velocity, 0.08);
  }

  desiredCameraPosition.copy(motion.playerPosition).add(cameraOffset);
  desiredCameraPosition.y += motion.jumpHeight * 0.35;

  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 4.5));
  camera.lookAt(cameraTarget);
}

function resolveCourseCollisions(previousX: number, previousZ: number): void {
  for (const obstacle of currentCourse.obstacles) {
    if (motion.jumpHeight >= obstacle.requiredJumpHeight) {
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
        motion.playerPosition.x = previousX;
      } else {
        motion.playerPosition.z = previousZ;
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

function animateCoins(elapsed: number): void {
  for (const coin of currentCourse.coins) {
    if (coin.collected) {
      continue;
    }

    coin.mesh.rotation.y = elapsed * 2.6 + coin.spinOffset;
    coin.mesh.position.y = coin.baseY + Math.sin(elapsed * 2.4 + coin.spinOffset) * 0.16;
  }
}

function animateFinishLine(elapsed: number): void {
  const unlocked = gameState.collectedCoins >= gameState.totalCoins;
  currentCourse.finishLine.lineMaterial.color.set(unlocked ? "#5ad06a" : "#df7b47");
  currentCourse.finishLine.lineMaterial.emissive.set(unlocked ? "#c8ff9e" : "#ffb36b");
  currentCourse.finishLine.lineMaterial.emissiveIntensity = unlocked ? 0.6 : 0.28;
  currentCourse.finishLine.bannerMaterial.color.set(unlocked ? "#e9ffd8" : "#fff1dd");
  currentCourse.finishLine.bannerMaterial.emissive.set(unlocked ? "#99ffb3" : "#ffe0b0");
  currentCourse.finishLine.bannerMaterial.emissiveIntensity = unlocked ? 0.36 : 0.18;
  currentCourse.finishLine.pulseMesh.scale.x = 1 + Math.sin(elapsed * 3.2) * (unlocked ? 0.1 : 0.04);
  currentCourse.finishLine.pulseMesh.scale.z = 1 + Math.sin(elapsed * 3.2) * (unlocked ? 0.1 : 0.04);
}

function collectCoins(): void {
  const collectorHeight = 1.2 + motion.jumpHeight;

  for (const coin of currentCourse.coins) {
    if (coin.collected) {
      continue;
    }

    const distance = Math.hypot(
      motion.playerPosition.x - coin.x,
      (collectorHeight - coin.y) * 0.6,
      motion.playerPosition.z - coin.z
    );

    if (distance > 0.9) {
      continue;
    }

    coin.collected = true;
    coin.mesh.visible = false;
    gameState.collectedCoins += 1;
  }
}

function startLevel(level: number): void {
  scene.remove(currentCourse.root);
  currentCourse = createCourse(scene, level);
  gameState.currentLevel = level;
  gameState.collectedCoins = 0;
  gameState.totalCoins = currentCourse.coins.length;
  gameState.pendingAdvanceAt = null;
  jumpQueued = false;
  keys.clear();
  motion.playerPosition.set(0, 0, PLAYER_START_Z);
  motion.velocity.set(0, 0, 0);
  motion.heading = Math.PI;
  motion.isGrounded = true;
  motion.jumpHeight = 0;
  motion.verticalVelocity = 0;
  motion.moveBlend = 0;
  avatar.root.position.copy(motion.playerPosition);
  camera.position.set(0, 4.3, PLAYER_START_Z + CAMERA_DISTANCE);
  syncHud();
}

function syncHud(): void {
  levelValue.textContent = `Lv ${gameState.currentLevel}`;
  coinCountValue.textContent = `Coins ${gameState.collectedCoins}/${gameState.totalCoins}`;

  if (gameState.pendingAdvanceAt !== null) {
    goalValue.textContent = `Level ${gameState.currentLevel} clear`;
    return;
  }

  goalValue.textContent = gameState.collectedCoins >= gameState.totalCoins
    ? "Reach finish line"
    : "Collect all coins";
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
    new THREE.MeshBasicMaterial({ color: "#dbf1ff", side: THREE.BackSide })
  );
  targetScene.add(sky);

  const hemisphereLight = new THREE.HemisphereLight("#fef7d8", "#5e8b3a", 1.8);
  targetScene.add(hemisphereLight);

  const sunLight = new THREE.DirectionalLight("#fff4ce", 2.2);
  sunLight.position.set(10, 15, 6);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -24;
  sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 50;
  targetScene.add(sunLight);

  const fillLight = new THREE.DirectionalLight("#b6f0ff", 0.7);
  fillLight.position.set(-9, 8, -12);
  targetScene.add(fillLight);

  const groundTexture = createGroundTexture(targetRenderer);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(42, 96),
    new THREE.MeshStandardMaterial({
      color: "#8ccf69",
      map: groundTexture,
      roughness: 1
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  targetScene.add(ground);

  const underLayer = new THREE.Mesh(
    new THREE.CircleGeometry(46, 96),
    new THREE.MeshStandardMaterial({
      color: "#5e8f43",
      roughness: 1
    })
  );
  underLayer.rotation.x = -Math.PI / 2;
  underLayer.position.y = -0.04;
  targetScene.add(underLayer);
  createRoadShell(targetScene);

  const flowerGeometry = new THREE.CylinderGeometry(0.07, 0.11, 0.9, 6);
  const flowerMaterial = new THREE.MeshStandardMaterial({ color: "#7cb04d", roughness: 1 });
  for (let index = 0; index < 18; index += 1) {
    const patch = new THREE.Mesh(flowerGeometry, flowerMaterial);
    const angle = (index / 18) * Math.PI * 2;
    const radius = 15 + (index % 4) * 1.8;
    patch.position.set(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
    patch.rotation.z = 0.08 * (index % 2 === 0 ? 1 : -1);
    patch.castShadow = true;
    targetScene.add(patch);
  }

  return {
    grassTufts: createGrassTufts(targetScene)
  };
}

function createRoadShell(targetScene: THREE.Scene): void {
  const roadBase = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH, 0.08, ROAD_LENGTH),
    new THREE.MeshStandardMaterial({ color: "#d7c28b", roughness: 1 })
  );
  roadBase.position.set(0, 0.04, ROAD_CENTER_Z);
  roadBase.receiveShadow = true;
  targetScene.add(roadBase);

  const roadGlow = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH - 0.8, 0.03, ROAD_LENGTH - 0.8),
    new THREE.MeshStandardMaterial({
      color: "#efe2b7",
      emissive: "#ead38a",
      emissiveIntensity: 0.18,
      roughness: 0.96
    })
  );
  roadGlow.position.set(0, 0.095, ROAD_CENTER_Z);
  roadGlow.receiveShadow = true;
  targetScene.add(roadGlow);

  const laneEdgeMaterial = new THREE.MeshStandardMaterial({ color: "#b59a66", roughness: 0.95 });
  for (const side of [-1, 1] as const) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, ROAD_LENGTH + 0.3), laneEdgeMaterial);
    edge.position.set(side * (ROAD_HALF_WIDTH + 0.08), 0.11, ROAD_CENTER_Z);
    edge.castShadow = true;
    edge.receiveShadow = true;
    targetScene.add(edge);
  }

  const markerMaterial = new THREE.MeshStandardMaterial({
    color: "#fff3c8",
    emissive: "#fff0a0",
    emissiveIntensity: 0.22,
    roughness: 0.92
  });
  for (let z = ROAD_START_Z - 2; z >= ROAD_END_Z + 2; z -= 2.6) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.2), markerMaterial);
    marker.position.set(0, 0.11, z);
    marker.receiveShadow = true;
    targetScene.add(marker);
  }

  const startPad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.18, 8),
    new THREE.MeshStandardMaterial({
      color: "#f7d481",
      emissive: "#ffd26a",
      emissiveIntensity: 0.2,
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

  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: "#b35e32", roughness: 0.93 });
  const obstacleCapMaterial = new THREE.MeshStandardMaterial({ color: "#d08c52", roughness: 0.88 });
  const obstacles = definition.obstacles.map((config) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(config.width, config.height, config.depth),
      obstacleMaterial
    );
    mesh.position.set(config.x, config.height * 0.5, config.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    courseRoot.add(mesh);

    const hurdleCap = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + 0.18, 0.14, config.depth + 0.14),
      obstacleCapMaterial
    );
    hurdleCap.position.set(config.x, config.height + 0.07, config.z);
    hurdleCap.castShadow = true;
    hurdleCap.receiveShadow = true;
    courseRoot.add(hurdleCap);

    return {
      halfDepth: config.depth * 0.5,
      halfWidth: config.width * 0.5,
      mesh,
      requiredJumpHeight: config.height * 0.9,
      x: config.x,
      z: config.z
    };
  });

  const coins = definition.coins.map((coinConfig, index) => createCoin(courseRoot, coinConfig, index, level));
  const finishLine = createFinishLine(courseRoot, FINISH_TRIGGER_Z);

  gameState.totalCoins = coins.length;

  return {
    coins,
    finishLine,
    obstacles,
    root: courseRoot
  };
}

function getLevelDefinition(level: number): LevelTemplate {
  const templateIndex = (level - 1) % LEVEL_TEMPLATES.length;
  const cycle = Math.floor((level - 1) / LEVEL_TEMPLATES.length);
  const template = LEVEL_TEMPLATES[templateIndex];

  return {
    coins: [
      ...template.coins.map((coin, index) => ({
        x: clamp(coin.x + Math.sin(level * 0.8 + index * 1.7) * 0.12 * cycle, -ROAD_HALF_WIDTH + 0.65, ROAD_HALF_WIDTH - 0.65),
        y: coin.y,
        z: coin.z
      })),
      ...Array.from({ length: Math.min(cycle, 3) }, (_, extraIndex) => ({
        x: extraIndex % 2 === 0 ? -0.95 : 0.95,
        y: 1.14,
        z: 7.2 - extraIndex * 4.1
      }))
    ],
    obstacles: template.obstacles.map((obstacle, index) => {
      const width = clamp(obstacle.width - cycle * 0.12, 2.65, ROAD_WIDTH - 0.34);
      const xLimit = ROAD_HALF_WIDTH - width * 0.5 - 0.14;
      return {
        depth: Math.min(1.08, obstacle.depth + cycle * 0.04),
        height: Math.min(1.02, obstacle.height + cycle * 0.08),
        width,
        x: clamp(obstacle.x + Math.sin(level * 1.13 + index * 0.84) * 0.28 * cycle, -xLimit, xLimit),
        z: obstacle.z
      };
    })
  };
}

function createCoin(
  parent: THREE.Group,
  coinConfig: LevelCoinConfig,
  index: number,
  level: number
): CoinState {
  const coinGroup = new THREE.Group();
  coinGroup.position.set(coinConfig.x, coinConfig.y, coinConfig.z);
  parent.add(coinGroup);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: "#f7d764",
    emissive: "#ffd35a",
    emissiveIntensity: 0.32,
    metalness: 0.1,
    roughness: 0.38
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: "#fff7c5",
    emissive: "#fff3b2",
    emissiveIntensity: 0.42,
    roughness: 0.28
  });

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 10, 18), rimMaterial);
  rim.rotation.y = Math.PI / 2;
  rim.castShadow = true;
  coinGroup.add(rim);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 6), coreMaterial);
  core.rotation.z = Math.PI / 2;
  coinGroup.add(core);

  return {
    baseY: coinConfig.y,
    collected: false,
    mesh: coinGroup,
    spinOffset: index * 0.74 + level * 0.51,
    x: coinConfig.x,
    y: coinConfig.y,
    z: coinConfig.z
  };
}

function createFinishLine(parent: THREE.Group, z: number): FinishLineState {
  const finishRoot = new THREE.Group();
  parent.add(finishRoot);

  const postMaterial = new THREE.MeshStandardMaterial({ color: "#7eb5cf", roughness: 0.9 });
  for (const side of [-1, 1] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.5, 0.26), postMaterial);
    post.position.set(side * 1.6, 1.25, z - 0.1);
    post.castShadow = true;
    post.receiveShadow = true;
    finishRoot.add(post);
  }

  const bannerMaterial = new THREE.MeshStandardMaterial({
    color: "#fff1dd",
    emissive: "#ffe0b0",
    emissiveIntensity: 0.18,
    roughness: 0.8
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.28, 0.24), bannerMaterial);
  banner.position.set(0, 2.52, z - 0.1);
  banner.castShadow = true;
  finishRoot.add(banner);

  const lineMaterial = new THREE.MeshStandardMaterial({
    color: "#df7b47",
    emissive: "#ffb36b",
    emissiveIntensity: 0.28,
    roughness: 0.74
  });
  const lineMesh = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH - 0.42, 0.08, 0.42), lineMaterial);
  lineMesh.position.set(0, 0.12, z);
  lineMesh.receiveShadow = true;
  finishRoot.add(lineMesh);

  const pulseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH - 0.9, 0.03, 1.18),
    new THREE.MeshStandardMaterial({
      color: "#fff3ca",
      emissive: "#fff0be",
      emissiveIntensity: 0.18,
      opacity: 0.76,
      roughness: 0.9,
      transparent: true
    })
  );
  pulseMesh.position.set(0, 0.11, z);
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
    color: "#4f922f",
    roughness: 1,
    side: THREE.DoubleSide
  });

  for (let index = 0; index < 240; index += 1) {
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

  const hips = new THREE.Group();
  hips.position.y = 1.52;
  root.add(hips);

  const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#d96844", roughness: 0.92 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: "#415d83", roughness: 0.96 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#efc6a8", roughness: 1 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: "#2b241f", roughness: 0.9 });

  const torso = new THREE.Group();
  torso.position.y = 0.58;
  hips.add(torso);

  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.18, 0.62),
    shirtMaterial
  );
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), skinMaterial);
  neck.position.y = 0.68;
  neck.castShadow = true;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.94;
  torso.add(head);

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: "#40261d",
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    roughness: 0.96
  });

  const headMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.86, 0.82),
    skinMaterial
  );
  headMesh.position.y = 0.38;
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
  face.position.set(0, 0.37, -0.417);
  face.rotation.y = Math.PI;
  face.renderOrder = 2;
  head.add(face);

  const hairCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.3, 0.9),
    hairMaterial
  );
  hairCap.position.set(0, 0.73, 0.01);
  hairCap.castShadow = true;
  hairCap.receiveShadow = true;
  head.add(hairCap);

  const fringe = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.16, 0.18),
    hairMaterial
  );
  fringe.position.set(0, 0.59, -0.37);
  fringe.castShadow = true;
  head.add(fringe);

  const leftSideHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 0.36),
    hairMaterial
  );
  leftSideHair.position.set(-0.39, 0.39, 0.01);
  leftSideHair.castShadow = true;
  head.add(leftSideHair);

  const rightSideHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 0.36),
    hairMaterial
  );
  rightSideHair.position.set(0.39, 0.39, 0.01);
  rightSideHair.castShadow = true;
  head.add(rightSideHair);

  const backHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.56, 0.18),
    hairMaterial
  );
  backHair.position.set(0, 0.33, 0.42);
  backHair.castShadow = true;
  backHair.receiveShadow = true;
  head.add(backHair);

  const leftArm = createArm(torso, -1, shirtMaterial, skinMaterial);
  const rightArm = createArm(torso, 1, shirtMaterial, skinMaterial);
  const leftLeg = createLeg(hips, -1, pantsMaterial, shoeMaterial);
  const rightLeg = createLeg(hips, 1, pantsMaterial, shoeMaterial);

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
    new THREE.BoxGeometry(0.28, 0.66, 0.28),
    sleeveMaterial
  );
  upperArm.position.y = -0.33;
  upperArm.castShadow = true;
  upperArm.receiveShadow = true;
  pivot.add(upperArm);

  const lowerPivot = new THREE.Group();
  lowerPivot.position.y = -0.64;
  pivot.add(lowerPivot);

  const lowerArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.58, 0.24),
    skinMaterial
  );
  lowerArm.position.y = -0.29;
  lowerArm.castShadow = true;
  lowerArm.receiveShadow = true;
  lowerPivot.add(lowerArm);

  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.22),
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
    new THREE.BoxGeometry(0.34, 0.72, 0.34),
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
    new THREE.BoxGeometry(0.28, 0.68, 0.28),
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
    new THREE.BoxGeometry(0.34, 0.16, 0.58),
    shoeMaterial
  );
  foot.position.set(0, -0.08, -0.08);
  foot.castShadow = true;
  foot.receiveShadow = true;
  footPivot.add(foot);

  return { pivot, lowerPivot, footPivot };
}

function createGroundTexture(targetRenderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  context.fillStyle = "#78be52";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 1800; index += 1) {
    context.fillStyle = index % 4 === 0 ? "rgba(42, 100, 30, 0.2)" : "rgba(160, 223, 103, 0.15)";
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const width = randomBetween(2, 10);
    const height = randomBetween(1, 4);
    context.fillRect(x, y, width, height);
  }

  for (let index = 0; index < 260; index += 1) {
    context.fillStyle = "rgba(255, 240, 185, 0.08)";
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
  gradient.addColorStop(0, "#fff7d9");
  gradient.addColorStop(1, "#ffc8a7");
  context.fillStyle = gradient;
  context.fillRect(0, 0, FACE_TEXTURE_WIDTH, FACE_TEXTURE_HEIGHT);

  context.fillStyle = "rgba(46, 90, 32, 0.18)";
  context.beginPath();
  context.arc(FACE_TEXTURE_WIDTH * 0.5, FACE_TEXTURE_HEIGHT * 0.43, 110, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#21351f";
  context.font = '700 34px "Space Grotesk", sans-serif';
  context.textAlign = "center";
  context.fillText("UPLOAD", FACE_TEXTURE_WIDTH * 0.5, FACE_TEXTURE_HEIGHT * 0.82);

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
  if (open) {
    hasPointerReference = false;
  }
}

function applyLookDelta(deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) {
    return;
  }

  cameraState.targetYaw -= deltaX * LOOK_SENSITIVITY;
  cameraState.targetPitch = clamp(
    cameraState.targetPitch - deltaY * LOOK_SENSITIVITY * 0.75,
    CAMERA_PITCH_MIN,
    CAMERA_PITCH_MAX
  );
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
