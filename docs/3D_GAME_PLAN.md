# RAMBO 3D — Operation Nightfall: design and delivery plan

## 1. Evaluation of the original

Source evaluated: `C:/Users/n/source/repos/rambo_game`, particularly `README.md`, `src/game/data/stages.ts`, `src/game/scenes/BattleScene.ts`, and `src/game/ui/InterfaceController.ts`. The README understates the current source: the implementation also contains rescue bunkers, followers, vehicles, weapon variants, terrain effects, difficulty selection, and touch support. Existing uncommitted Android and documentation work belongs to the original project and must not be moved or committed here.

Strengths to preserve:

- Fast commando combat and understandable overhead movement.
- Three themed missions: Emerald Killbox, River Run, Blacksite Siege.
- Gunship, barge, and command-tank escalation.
- Rescue allies and a satisfying power fantasy.
- Readable DOM interface and browser distribution.

Design opportunities (source-based assessment, not claims from a player study):

- Long lists of fixed enemy encounters make missions structurally similar. Give every map a spatial objective and an extraction condition.
- Many abilities compete for attention. Teach movement/shooting first, then interaction, reload, and dodge through a persistent compact control legend.
- Auto-targeting reduces mouse-aim agency. Offer manual mouse aiming plus hold-Space assisted fire for keyboard/touch accessibility.
- Military codenames establish mood but little personal motivation. Give the rescue a named contact and a campaign consequence.
- Sprite scale and HUD density do not directly translate into 3D. Use a fixed, elevated perspective camera, grounded silhouettes, restrained UI, and explicit objective markers.
- One large battle scene mixes rendering, simulation, and progression. Separate simulation rules, mission data, asset loading, world construction, input, and interface.

## 2. Product direction

**Fantasy:** one commando goes back for the people the command center abandoned.
**Title:** RAMBO 3D / Operation Nightfall. An unofficial original browser prototype; no film footage, franchise models, commercial music, or ripped game assets.
**View:** true 3D low-poly world with an elevated perspective camera. Horizontal X/Z movement keeps combat legible while Blender geometry, lighting, shadows, depth, and animated models provide the third dimension.
**Session:** three compact missions, approximately 3–6 minutes on a first attempt; target duration is a design estimate, to be tuned with playtesting.
**Design pillars:** readable danger; meaningful rescue; immediate response; complete missions rather than endless waves.

## 3. Story and campaign

A mercenary network called HELIX is moving a targeting archive through the valley. Radio operator Mara Vale discovered that the archive includes civilian evacuation routes. Her last transmission reached an off-grid veteran: you. Retrieve Mara, stop the convoy, and destroy the launch controller before the valley goes dark.

| Mission              | Setting               | Required action                                | Boss                     | Ending beat                                                   |
| -------------------- | --------------------- | ---------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| 01 — Emerald Killbox | Sunset jungle outpost | Reach Mara and free her with E                 | Cobra Fang gunship       | Mara reveals the river convoy route; escort her to extraction |
| 02 — River Run       | Flooded supply route  | Reach the relay and recover the archive with E | Iron Viper patrol barge  | Archive points to the blacksite; extract with the data        |
| 03 — Blacksite Siege | Fortified upland      | Disable the launch relay with E                | War Mammoth command tank | Destroy launch capability and reach the final extraction      |

Mission flow: briefing → infiltration → interact with objective → boss encounter → extraction → debrief/upgrade → next mission. Objective completion is preserved during the current mission; a defeat offers a clean mission retry. Completed missions and campaign upgrades are saved locally at debrief. No hidden claim of mid-combat save persistence.

## 4. First playable release: implementation scope

- Three fully playable themed maps sharing a maintained simulation engine.
- WASD/arrows movement, mouse aim + click fire, Space assisted fire, R reload, Shift dodge, E interact, Q change weapon, Escape pause.
- Touch directional pad, assisted fire, interact, dodge, reload, and weapon controls; responsive overlays.
- Rifle (accurate, forgiving) and scattergun (close-range burst), finite magazines with unlimited reserve and timed reload.
- Enemy riflemen advance, stationary sentries anchor cover; boss patterns use aimed and fan projectiles with warning time.
- Swept projectile collision with cover and actors; circle-vs-box movement so actors cannot walk through crates and buildings.
- Dodge consumes a cooldown and grants a short invulnerability window. Health pickups reward defeated enemies.
- Required mission interaction, a following rescue companion in mission 1, and marked extraction only after the boss is defeated.
- Between-mission upgrade choice: reinforced armor, tuned weapons, or shorter dodge cooldown.
- Mission-local elapsed time, kills, score, best score, and saved campaign continuation.
- Pause/settings, sound toggle, reduced-motion option, quality selector, failure/retry, campaign completion.
- Original Blender-authored low-poly commando, enemy, palm, rock, crate, tent, tower, helicopter, and tank/barge model assets; GLB loading and editable source.
- A cohesive briefing dashboard, tactical HUD, objective checklist, minimap, boss health, radio messages, and debrief.

Explicitly deferred to a production expansion: local/network co-op, drivable vehicles, skeletal animation retargeting, Android packaging, cinematic voice acting, dynamic destructible terrain, controller support, full stealth/visibility simulation, and a branching campaign. These original-system features are not implied to be implemented by the 3D conversion. First ship a complete solo campaign, then port them deliberately.

## 5. Art direction and Blender pipeline

A miniature battlefield: dark pine/olive foliage, warm sand paths, blue-green water, muted military equipment, rust accents, warm orange enemy tracers, and lime/cyan objective lights. Use a fixed sun, soft contact shadows, atmospheric fog, and layered terrain to keep silhouettes separated. The menu frames the rendered environment with editorial typography rather than a flat placeholder image.

Asset contract:

- Blender source is reproducible with `art/build_assets.py` and saved as `art/nightfall.blend`.
- One Blender unit represents one meter. Ground contacts at local Z=0; Blender glTF export converts to three.js Y-up. Models face Blender -Y (three.js +Z).
- Low-poly flat-shaded PBR materials with a shared visual palette; no downloaded texture dependencies.
- Export one self-contained GLB per asset into `public/models`. Keep pivots centered at the feet/base; name meaningful subparts for later animation.
- Target approximately <10k triangles per hero/boss, <2k per prop, and <5 MB combined initial models. Actual export sizes recorded in validation.
- Build once in Blender background mode; ship GLBs so players and ordinary developers do not need Blender installed.
- Future pass: armature with idle/run/aim/reload clips, silhouette review at gameplay scale, LODs, instanced vegetation, compressed textures if textured materials are introduced.

Regenerate: `.tools/blender-4.5.3-windows-x64/blender.exe --background --python art/build_assets.py` or use any compatible installed Blender 4.5 executable. Portable runtime/download are gitignored, not part of source history.

## 6. Technical architecture

- Vite + TypeScript + three.js WebGLRenderer; static deployment with relative asset URLs for GitHub Pages subpaths.
- `src/rules.mjs`: deterministic collision and campaign persistence validation; covered by Node tests.
- `src/missions.ts`: mission definitions, colors, objective positions, boss configuration, and radio text.
- `src/world.ts`: GLTFLoader, reusable prefabs, map composition, lighting, mesh effects.
- `src/game.ts`: fixed-step simulation, actors, weapons, enemy AI, bullets, mission state, extraction, and snapshots.
- `src/main.ts`: lifecycle, DOM panels/HUD, keyboard/pointer/touch input, local preferences and campaign integration.
- `src/style.css`: design tokens, responsive layouts, focus treatment, motion preferences.
- WebAudio synthesized cues start only after a user gesture; no autoplay dependency.
- Share geometry/materials for prefabs and merge static terrain by material; dispose temporary effects and world-owned resources on mission changes. Cap pixel ratio and provide a low quality mode.
- Simulation runs at 60 Hz with bounded catch-up; swept segment collision prevents fast projectiles tunneling through cover.
- localStorage reads/writes are guarded and untrusted saved values are validated; failure cannot prevent play.

## 7. UI and accessibility

Briefing: permanent campaign identity, three mission cards with location/operation status, a clear Deploy action, difficulty selector, and control summary. Game: compact mission HUD at top, status/ammo at bottom, objective marker and minimap, high-contrast interaction prompt near bottom center. Pause: Resume, restart, sound, graphics, reduced motion, and return to briefing.

Use semantic buttons, visible focus rings, legible text over opaque panels, pointer-cancel cleanup, and automatic pause on visibility/focus loss. Never communicate objective state by color alone. Keyboard-only assisted aiming and touch fire are functional alternatives to precision mouse input. Reduced motion removes shake/cinematic camera drift. Low quality disables shadows and limits resolution. Screen readers can read menus/status, but spatial real-time combat is not claimed to be fully screen-reader accessible.

## 8. Delivery sequence and acceptance

1. Establish separate repository and write this plan. No edits to the 2D source.
2. Generate/validate Blender source and GLB asset set.
3. Build world renderer and playable first mission; verify movement, shooting, collision, damage, reload, and interaction.
4. Add distinct remaining missions, bosses, extraction, upgrades, save continuation, defeat, and campaign completion.
5. Build polished briefing/game/debrief layouts and touch controls.
6. Run unit tests for swept collision, movement boundaries, save validation and campaign transitions; TypeScript/build checks; browser smoke tests for rendering, launch, input, pause/retry, and asset loading. Test full mission progression in a controlled simulation in addition to manual interaction; do not present automated completion as a human difficulty/playability study.
7. Inspect desktop and narrow viewport screenshots. Record limitations and actual validation in `docs/VALIDATION.md`.
8. Commit into the new repo, create `buicongnguyen/rambo_3D` if absent, push through `git@github.com:buicongnguyen/rambo_3D.git`, deploy static build to GitHub Pages using Actions, then check the live URL and its assets.

Release gates: successful clean build/tests; no missing GLBs; real movement/combat; all three objectives/bosses/extractions reachable; keyboard and touch UI usable; saved campaign resumes; no secrets in source; workflow succeeds; published game responds.

## 9. Expansion roadmap (not first-release promises)

A. Playtest and tuning: recruit players, record first-death locations and completion times with consent, tune enemy sightlines and damage, add authored tutorial beats.
B. Authored animation/audio: rigged commando, hit reactions, contextual voice radio, layered original soundtrack, proper spatial audio mix.
C. Reintroduce original breadth: rescue squad combat, jeep/tank driving with enter/exit rules, more weapon pickups, optional objectives and side routes.
D. Co-op: establish shared deterministic state, camera rules and revive loop before choosing local split-screen or network authority.
E. Production: persistent campaign slots, gamepad remapping, localization, performance profiles on physical Android hardware, Capacitor wrapper, licensed branding/assets if commercially distributed.

## 10. References

Official technical references checked during implementation:

- https://threejs.org/docs/pages/WebGLRenderer.html — renderer and shadow controls.
- https://threejs.org/docs/pages/GLTFLoader.html — GLB loading.
- https://threejs.org/manual/en/load-gltf.html — glTF integration.
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html — background scripting.
- https://download.blender.org/release/Blender4.5/ — official portable Blender distribution.

These references inform the pipeline; the design recommendations above are original assessments of the supplied source.

## 11. Delivery status

The first playable release is implemented, including all three mission endings and upgrade progression. The final pass adds A* cover navigation for Mara with required escort extraction, river water slowdown outside the bridge, fast barge volleys, tank mortar markers, half-health boss reinforcements, and batched static scenery. See `VALIDATION.md` for actual results and limits, including the distinction between automated progression and human playtesting. The expansion roadmap is intentionally not marked complete.
