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

type MotionState = {
  heading: number;
  moveBlend: number;
  playerPosition: THREE.Vector3;
  runCycle: number;
  speed: number;
  velocity: THREE.Vector3;
};

type CameraState = {
  pitch: number;
  targetPitch: number;
  targetYaw: number;
  yaw: number;
};

const WORLD_LIMIT = 18;
const RUN_SPEED = 7.2;
const CAMERA_DISTANCE = 7.2;
const CAMERA_LOOK_HEIGHT = 2;
const CAMERA_PITCH_MIN = 0.18;
const CAMERA_PITCH_MAX = 0.8;
const LOOK_SENSITIVITY = 0.0048;

const sceneRoot = getElement<HTMLDivElement>("sceneRoot");
const photoInput = getElement<HTMLInputElement>("photoInput");
const changePhotoButton = getElement<HTMLButtonElement>("changePhotoButton");
const uploadModal = getElement<HTMLDivElement>("uploadModal");
const uploadStatus = getElement<HTMLSpanElement>("uploadStatus");
const hintText = getElement<HTMLParagraphElement>("hintText");

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
  moveBlend: 0,
  playerPosition: new THREE.Vector3(0, 0, 0),
  runCycle: 0,
  speed: 0,
  velocity: new THREE.Vector3()
};

const cameraState: CameraState = {
  pitch: 0.34,
  targetPitch: 0.34,
  targetYaw: 0,
  yaw: 0
};

const grassTufts = createEnvironment(scene, renderer);
let activeFaceTexture = createDefaultFaceTexture();
const avatar = createAvatar(activeFaceTexture);
scene.add(avatar.root);

camera.position.set(0, 4.3, CAMERA_DISTANCE);
camera.lookAt(avatar.root.position);

let hasUploadedFace = false;
let hasPointerReference = false;
let lastPointerX = 0;
let lastPointerY = 0;

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
    const nextTexture = await buildFaceTextureFromFile(file);
    activeFaceTexture.dispose();
    activeFaceTexture = nextTexture;
    avatar.faceMaterial.map = activeFaceTexture;
    avatar.faceMaterial.needsUpdate = true;
    hasUploadedFace = true;
    uploadStatus.textContent = "Face loaded. Close-up is now on the avatar.";
    hintText.textContent = "Move the mouse to look around. Click the field to lock the cursor. Use WASD, ZQSD, or arrow keys to run.";
    setModalOpen(false);
  } catch {
    uploadStatus.textContent = "The browser could not decode that image.";
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
  const key = event.key.toLowerCase();

  if (isMovementKey(key)) {
    keys.add(key);
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (isMovementKey(key)) {
    keys.delete(key);
    event.preventDefault();
  }
});

window.addEventListener("blur", () => {
  keys.clear();
});

window.addEventListener("resize", handleResize);

animate();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateMotion(delta);
  updateAvatar(delta, elapsed);
  updateGrass(elapsed);
  updateCamera(delta);

  renderer.render(scene, camera);
}

function updateMotion(delta: number): void {
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
  motion.speed = motion.velocity.length();
  if (motion.speed > 0.12) {
    motion.heading = dampAngle(
      motion.heading,
      Math.atan2(-motion.velocity.x, -motion.velocity.z),
      delta,
      14
    );
  }
  motion.moveBlend = damp(motion.moveBlend, motion.speed > 0.2 ? 1 : 0, delta, 10);
  motion.runCycle += delta * (1.6 + motion.speed * 0.92);
}

function updateAvatar(_delta: number, elapsed: number): void {
  const gait = Math.sin(motion.runCycle);
  const oppositeGait = Math.sin(motion.runCycle + Math.PI);
  const bounce = Math.sin(motion.runCycle * 2);
  const idle = Math.sin(elapsed * 1.8);
  const idleSway = Math.sin(elapsed * 1.35);

  avatar.root.position.copy(motion.playerPosition);
  avatar.root.rotation.y = motion.heading;

  avatar.hips.position.y = 1.52 + bounce * 0.055 * motion.moveBlend + idle * 0.018 * (1 - motion.moveBlend);
  avatar.torso.rotation.x = 0.16 * motion.moveBlend + bounce * 0.03 * motion.moveBlend + idle * 0.02 * (1 - motion.moveBlend);
  avatar.torso.rotation.z = gait * 0.035 * motion.moveBlend + idleSway * 0.015 * (1 - motion.moveBlend);
  avatar.head.rotation.x = -0.06 * motion.moveBlend - idle * 0.015;
  avatar.head.rotation.z = -gait * 0.015 * motion.moveBlend;

  avatar.leftArm.pivot.rotation.x = oppositeGait * 0.95 * motion.moveBlend + idle * 0.08 * (1 - motion.moveBlend);
  avatar.rightArm.pivot.rotation.x = gait * 0.95 * motion.moveBlend - idle * 0.08 * (1 - motion.moveBlend);
  avatar.leftArm.lowerPivot.rotation.x = 0.22 + Math.max(0, -oppositeGait) * 0.46 * motion.moveBlend;
  avatar.rightArm.lowerPivot.rotation.x = 0.22 + Math.max(0, -gait) * 0.46 * motion.moveBlend;

  avatar.leftLeg.pivot.rotation.x = gait * 0.88 * motion.moveBlend;
  avatar.rightLeg.pivot.rotation.x = oppositeGait * 0.88 * motion.moveBlend;
  avatar.leftLeg.lowerPivot.rotation.x = Math.max(0, -gait) * 0.7 * motion.moveBlend;
  avatar.rightLeg.lowerPivot.rotation.x = Math.max(0, -oppositeGait) * 0.7 * motion.moveBlend;

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
    .add(new THREE.Vector3(0, CAMERA_LOOK_HEIGHT, 0));

  if (motion.speed > 0.2) {
    cameraTarget.addScaledVector(motion.velocity, 0.08);
  }

  desiredCameraPosition.copy(motion.playerPosition).add(cameraOffset);

  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 4.5));
  camera.lookAt(cameraTarget);
}

function handleResize(): void {
  const width = sceneRoot.clientWidth;
  const height = sceneRoot.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function createEnvironment(targetScene: THREE.Scene, targetRenderer: THREE.WebGLRenderer): GrassTuft[] {
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

  return createGrassTufts(targetScene);
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

  const hairMaterial = new THREE.MeshStandardMaterial({ color: "#40261d", roughness: 0.96 });

  const headMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.86, 0.82),
    skinMaterial
  );
  headMesh.position.y = 0.38;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.72), faceMaterial);
  face.position.set(0, 0.38, -0.416);
  face.rotation.y = Math.PI;
  head.add(face);

  const hairCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.3, 0.9),
    hairMaterial
  );
  hairCap.position.set(0, 0.73, 0.04);
  hairCap.castShadow = true;
  hairCap.receiveShadow = true;
  head.add(hairCap);

  const fringe = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.16, 0.18),
    hairMaterial
  );
  fringe.position.set(0, 0.59, -0.33);
  fringe.castShadow = true;
  head.add(fringe);

  const leftSideHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 0.36),
    hairMaterial
  );
  leftSideHair.position.set(-0.37, 0.39, 0.02);
  leftSideHair.castShadow = true;
  head.add(leftSideHair);

  const rightSideHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.48, 0.36),
    hairMaterial
  );
  rightSideHair.position.set(0.37, 0.39, 0.02);
  rightSideHair.castShadow = true;
  head.add(rightSideHair);

  const backHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.56, 0.16),
    hairMaterial
  );
  backHair.position.set(0, 0.33, 0.34);
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
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, "#fff7d9");
  gradient.addColorStop(1, "#ffc8a7");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  context.fillStyle = "rgba(46, 90, 32, 0.18)";
  context.beginPath();
  context.arc(128, 120, 72, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#21351f";
  context.font = '700 26px "Space Grotesk", sans-serif';
  context.textAlign = "center";
  context.fillText("UPLOAD", 128, 214);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function buildFaceTextureFromFile(file: File): Promise<THREE.CanvasTexture> {
  const image = await loadImage(URL.createObjectURL(file));
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D context unavailable");
  }

  context.fillStyle = "#f7efd9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
