# Plan: Selfie to Voxel Avatar

## Goal
Build a frontend-only web experience where a player uploads a picture of themselves and the site transforms it into a Minecraft-style voxel avatar.

This should feel like a small, polished game or interactive toy, not a generic editor.

## Key Constraints
- Frontend only.
- No login or signup.
- No backend dependency for the first version.
- Fast first load and immediate interaction.
- Mobile friendly, but optimized for desktop first.
- Use an original voxel look inspired by block games, but do not copy Minecraft branding or assets.

## What We Learned From `todo.txt`
The current todo file describes a cozy 3D browser puzzle game with progressive levels, but the useful parts for this project are:
- browser-first delivery
- strong visual identity
- simple onboarding
- polished 3D presentation
- short, satisfying user sessions

For this version, the game should pivot into a single-player avatar forge.

## Core Experience
1. Player opens the site.
2. Player uploads a selfie or takes one with the camera.
3. Player crops or aligns the face.
4. The site runs a transformation animation.
5. A voxel avatar appears in a stylized 3D scene.
6. Player can rotate the avatar, tweak a few visual settings, and download or share the result.

## Design Direction
### Theme
Make it feel like a "mirror forge" or "avatar lab":
- the player walks into a glowing chamber
- the selfie is scanned
- cubes assemble into a blocky character
- the result feels personal, magical, and shareable

### Visual Style
- Deep navy or charcoal background.
- Bright cyan, teal, gold, and soft magenta accents.
- Floating particles and cube fragments.
- Soft glow, fog, and subtle bloom.
- Large, bold title treatment.
- Clean, glassy UI panels with strong contrast.

### Motion
- Use a short, dramatic transform sequence when the selfie is accepted.
- Have blocks assemble from the center outward.
- Add small camera drift and avatar idle motion.
- Keep animation crisp and purposeful, not noisy.

## MVP Scope
### Must Have
- Upload image from file input.
- Optional webcam capture if it is easy to support.
- Face crop / position step.
- Voxel-style avatar generation preview.
- 3D scene or strong 2.5D presentation.
- Download image or screenshot of the final avatar.
- Responsive layout.

### Nice to Have
- Background presets.
- Outfit or color presets.
- Simple expression or pose variants.
- Randomize button.
- Before/after toggle.

### Not in MVP
- Accounts.
- Online multiplayer.
- Backend rendering.
- Heavy AI pipeline.
- Complex social features.

## Technical Direction
Use a lightweight frontend stack that can ship quickly:
- React + TypeScript for structure.
- Three.js for the avatar preview and scene.
- Canvas for image preprocessing and pixelation.
- Local state only for the first version.

If the voxel conversion is too expensive to perfect immediately, start with a deterministic approximation:
- extract a color palette from the selfie
- map it onto a blocky head/body model
- use a pixelated texture or box-based geometry

This keeps the experience real and shippable while leaving room for better conversion later.

## Build Phases
### Phase 1: App Shell
- Create the landing page.
- Set the overall visual theme.
- Add the upload call to action.
- Make the page feel finished even before the avatar exists.

### Phase 2: Photo Intake
- Support file upload.
- Add crop and position controls.
- Add validation for bad or missing images.
- Keep this step simple and friendly.

### Phase 3: Avatar Generation
- Build a temporary voxel avatar pipeline.
- Start with a blocky humanoid model.
- Use sampled colors from the selfie.
- Add a transformation animation so the result feels earned.

### Phase 4: 3D Presentation
- Place the avatar in a small stylized scene.
- Add lighting, particles, and a premium camera angle.
- Add idle animation and rotate controls.

### Phase 5: Polish
- Make the UI feel intentional.
- Add transitions and feedback.
- Ensure mobile layout still works.
- Add download/share output.

## Suggested File Structure
- `src/app/` for the main experience shell.
- `src/components/UploadStage.tsx`
- `src/components/CropStage.tsx`
- `src/components/AvatarPreview.tsx`
- `src/components/TransformSequence.tsx`
- `src/lib/imageToPalette.ts`
- `src/lib/imageToVoxelAvatar.ts`
- `src/styles/`

If the repo uses a different stack, keep the same conceptual split:
- intake
- crop
- conversion
- preview
- export

## Success Criteria
- A user can start in a few seconds.
- The upload to avatar result feels smooth and deliberate.
- The avatar reads clearly as a voxel/block character.
- The UI looks like a finished product, not a prototype.
- The whole experience works without a backend.

## Immediate First Task For A New Agent
Start with the smallest usable vertical slice:
- build the landing screen
- add image upload
- show a placeholder avatar preview area
- wire a fake or basic transformation effect

Only after that should the conversion logic and polish be expanded.
