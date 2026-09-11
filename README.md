# RAMBO 3D — Operation Nightfall

A playable three.js / Blender reimagining of the original 2D commando game. Three short solo missions connect rescue, intelligence recovery, and a final blacksite assault.

**Play:** https://buicongnguyen.github.io/rambo_3D/

The game and its source repository are public. GitHub Actions deploys tested builds to GitHub Pages.

## Included

- Three real 3D maps, 27 original Blender-authored GLB assets, and editable `art/nightfall.blend` source.
- Jungle rescue and following companion with cover-aware navigation; river crossing and archive recovery; final launch-relay sabotage.
- Gunship fan attacks, fast barge volleys, and a tank with marked mortar strikes. Bosses escalate and call flank reinforcements at half health.
- Mouse aim and assisted aim, rifle/scattergun, reload, dodge, bullet-blocking cover, and health pickups.
- Briefing, mission HUD, minimap, radio story, pause/settings, upgrades, saved campaign continuation, retry and extraction endings.
- Responsive touch controls, Story/Standard difficulty, optional audio, low graphics, and reduced camera motion.

This is an **animated solo campaign** with playable motorcycles, jeeps and tanks, and eleven weapon types. Local co-op, skinned character animation, physical controller support and Android packaging remain future phases.

## Run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. `npm run build` creates the standalone static site in `dist`. `npm run preview` serves that production build. GLBs are already committed; Blender is not needed to play or build the site.

## Controls

| Input              | Action                                             |
| ------------------ | -------------------------------------------------- |
| WASD / arrows      | Move                                               |
| Mouse + left click | Aim and fire                                       |
| Hold Space         | Assisted aim and fire                              |
| Shift while moving | Dodge                                              |
| E                  | Interact / board / exit vehicle |
| R                  | Reload                                             |
| Q                  | Cycle collected weapons                          |
| Escape             | Pause / resume                                     |

Complete the yellow objective, defeat the boss, then reach the green extraction pad. In mission 1, Mara must arrive too. Press Q or click the SWAP WEAPON button beside the ammo display on PC. Touch devices have a highlighted SWAP WEAPON button above FIRE. Switching works on foot and on motorcycles; exit a jeep or tank to switch personal weapons. Touch devices display movement and action buttons. Green drops restore health. Orange rings warn of attacks; move out of tank mortar markers before they detonate. The river slows you outside the bridge.

Progress saves **after choosing an upgrade** at the first two debriefs and at final campaign completion. Restarting a mission restarts that mission; it is not a mid-combat checkpoint. Saves are local to the browser and site origin. Denied storage access does not prevent play.

## Blender pipeline

```powershell
# Use your installed Blender executable, or the downloaded local portable runtime:
.tools/blender-4.5.3-windows-x64/blender.exe --background --python-exit-code 1 --python art/build_assets.py
```

This exports `public/models/*.glb` and rebuilds `art/nightfall.blend`. The Python authoring script is the reproducible source; regeneration replaces manual changes to the gallery. Work on a copy if you want to author variants by hand. The portable Blender runtime under `.tools/` is ignored by Git.

Models use flat PBR materials and meter-scale pivots. Static scenery is batched by material to reduce draw calls; actor meshes retain their subparts. Characters now have authored hip, knee, shoulder and elbow pivots, driven by distance-based procedural animation: idle breathing, walk, run, aimed movement, recoil, reload, dodge and hit reactions. Deaths collapse, hold for two seconds and fade out over two seconds. These are articulated rigid-part animations, not motion-captured or skinned skeletal clips. Helicopter rotors and tank turrets have independent pivots.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Node tests cover swept collision, dash movement, follower routing, save/upgrade progression, and binary GLB validity. Browser tests cover keyboard input, reload, pause/retry, full campaign state transitions, persistent upgrades, touch input, and a full Story-mode rescue using ordinary simulated weapon damage. The controlled campaign transition test injects a lethal projectile to exercise endings; it is not a difficulty playtest.

See [validation notes](docs/VALIDATION.md) and the [detailed evaluation, design, implementation, and expansion plan](docs/3D_GAME_PLAN.md).

## Publishing

The repository uses the SSH remote `git@github.com:buicongnguyen/rambo_3D.git`. Push `main` to run `.github/workflows/deploy.yml`: clean install → unit tests → production build → browser tests. After all checks pass, the workflow publishes the build to GitHub Pages.

Relative Vite asset URLs support the `/rambo_3D/` project path. Google Fonts is used for optional UI typography; system fonts are the fallback if unavailable. All models and gameplay are self-hosted in the deployment.

## Original project and assets

Built separately from `buicongnguyen/rambo_game`. No changes to the original checkout are required. Story, models and synthesized sound effects are authored for this prototype. RAMBO is used as the requested project name; this is an unofficial prototype with no film, commercial soundtrack, or ripped game assets.

## Animation and logic review

See [the resolved review findings](docs/ANIMATION_REVIEW.md) and [the pose reference](docs/animation-poses.png). Movement automatically runs; firing while moving slows to an aimed walk. Death animations complete before the retry screen.

## Playable vehicles and weapons

Motorcycles, jeeps and tanks can be boarded with E / BOARD and exited with E / EXIT. Collect the purple weapon pickups and use Q / WEAPON to cycle eleven weapon types. See [controls, behavior and validation](docs/VEHICLES_WEAPONS.md).
