# RAMBO 3D — Operation Nightfall

**Play:** https://buicongnguyen.github.io/rambo_3D/

A three.js / Blender solo action game with seven stages, three levels per stage, eleven weapons, and playable motorcycles, jeeps and tanks. Each level runs along a roughly 144-metre battlefield. Secure the relay, clear its counterattack, and reach northern extraction. Level three of each stage ends with command bosses.

## Campaign

| Stage | Terrain and combat |
| --- | --- |
| White Horizon | Broad ice patches, sliding momentum and snow-covered pine trees |
| Cinderfall | Erupting volcano, visible falling rocks and warned impacts that hurt either side |
| Dune Lifeline | Sand traps reduce movement to one quarter speed |
| Canopy Hold | Dense jungle with destructible trees and explosive fuel drums |
| Citadel Dawn | Buildings, barricades, flanking streets and extra patrols |
| Faultline Zero | Periodic dust plumes and 1–2-second earthquake freezes for ground enemies |
| Mire Crossing | Muddy water holes gradually sink and slow the player; move out to recover |

Choose a stage from the briefing selector, or continue your saved level. Changing stages starts at that stage's first level when you deploy. Each completed level offers an upgrade. Campaign progress saves between levels, not during combat. Old three-mission saves migrate to the expanded campaign start while keeping the best score.

| Difficulty | Base health | Soldiers | Bosses in each stage finale |
| --- | ---: | ---: | ---: |
| Easy | 230 | 1× | 1 |
| Normal | 150 | 1× | 1 |
| Hard | 150 | 2× | 2 |
| Crazy | 150 | 4× | 4 |

Normal retains the existing damage and weapon tuning. Base patrol counts increase from 24 to 32 through a stage's three levels; city levels add eight. Difficulty multiplies patrol and reinforcement counts. Every finale boss must be destroyed before extraction opens.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move or drive |
| Mouse + left click | Aim and fire |
| Hold Space | Assisted aim and fire |
| Shift while moving | Dodge |
| E | Interact, board or exit |
| R | Reload |
| Q / SWAP WEAPON | Cycle collected personal weapons |
| Escape | Pause / resume |

Mobile has movement, FIRE, SWAP WEAPON, RELOAD, DODGE, BOARD/EXIT/USE and PAUSE buttons. Motorcycles use personal weapons; jeeps and tanks use mounted weapons. Exit them to switch personal weapons, activate objectives or extract. Moving tanks crush infantry; stationary contact does not award kills. Vehicle collision still respects solid cover.

Drive or walk over purple weapon pickups. Green supplies heal the player and repair the occupied vehicle; full health/armor leaves supplies available. Shoot red fuel drums for chain explosions; the blast can hurt you too. Trees can be shot or blasted apart. Enemy helicopters fly and land to rearm behind cover; spiders climb across obstacles and pause to rest; laser tanks telegraph their locked firing line before firing.

## Run and build

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Production output is `dist`; `npm run preview` serves it. Low graphics limits resolution, shadows, decoration and effects. Terrain mechanics, enemies and controls stay the same. Browser tests using software rendering do not establish frame rates on physical phones or PCs.

## Blender

32 original GLB models and editable `art/nightfall.blend` are committed. Regenerate with:

```powershell
.tools/blender-4.5.3-windows-x64/blender.exe --background --python-exit-code 1 --python art/build_assets.py
```

The authoring script is the reproducible source. Regeneration replaces manual gallery edits; work on a copy for hand-authored variants. Models use articulated rigid joints for procedural motion, rather than skinned or motion-captured animation. The model library is approximately 6.7 MB, with a checked 7.5 MB budget.

## Publishing

SSH remote: `git@github.com:buicongnguyen/rambo_3D.git`. Pushing `main` runs unit tests, builds the game, runs browser tests and publishes to GitHub Pages. Relative asset URLs support `/rambo_3D/`. The repository and game are public.

See [campaign expansion plan and behavior](docs/CAMPAIGN_EXPANSION.md), [vehicle and weapon details](docs/VEHICLES_WEAPONS.md), and the [original design plan](docs/3D_GAME_PLAN.md). Historical review documents describe earlier releases.

Built separately from `buicongnguyen/rambo_game`. Models, story and synthesized effects are authored for this unofficial prototype; it includes no film assets or commercial soundtrack. Local co-op, physical controller integration and Android packaging remain future work.
