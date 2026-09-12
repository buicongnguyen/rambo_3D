# RAMBO 3D — Operation Nightfall

**Play:** https://buicongnguyen.github.io/rambo_3D/

A three.js / Blender solo action game with seven stages, three levels per stage, eleven weapons, and playable motorcycles, jeeps and tanks. Each stage begins with a 164 m zigzag approach, followed by a 202 m O loop with a choice of two arms or a 301 m U expedition, then a 372 m S or mirrored S finale (including 45-degree variants). Square maps measure 136 × 136 metres, or 196 × 196 metres for diagonal S routes. Permanent hills and volcanic basalt divide the road arms; all routes remain tank-accessible. Secure the relay, clear its counterattack, and follow the tactical map to extraction. Level three of each stage ends with command bosses: helicopters, climbing spiders, laser tanks, four-gun humanoids, rocket-and-gun humanoids or twin-launcher missile trucks. Existing bosses also have an independent light gun.

## Campaign

| Stage          | Terrain and combat                                                               |
| -------------- | -------------------------------------------------------------------------------- |
| White Horizon  | Broad ice patches, sliding momentum and snow-covered pine trees                  |
| Cinderfall     | Erupting volcano, visible falling rocks and warned impacts that hurt either side |
| Dune Lifeline  | Sand traps reduce movement to one quarter speed                                  |
| Canopy Hold    | Dense jungle with destructible trees and explosive fuel drums                    |
| Citadel Dawn   | Buildings, barricades, flanking streets and extra patrols                        |
| Faultline Zero | Periodic dust plumes and 1–2-second earthquake freezes for ground enemies        |
| Mire Crossing  | Muddy water holes gradually sink and slow the player; move out to recover        |

Choose a stage from the briefing selector, or continue your saved level. Changing stages starts at that stage's first level when you deploy. Each completed level offers an upgrade. Campaign progress saves between levels, not during combat. Old three-mission saves migrate to the expanded campaign start while keeping the best score.

| Difficulty | Base health | Soldiers | Bosses in each stage finale |
| ---------- | ----------: | -------: | --------------------------: |
| Easy       |         230 |       1× |                           1 |
| Normal     |         150 |       1× |                           1 |
| Hard       |         150 |       2× |                           2 |
| Crazy      |         150 |       4× |                           4 |

Normal retains the standard health and soldier damage. Base patrol counts increase from 24 to 32 through a stage's three levels; city levels add eight. Difficulty multiplies patrol and reinforcement counts. Every finale boss must be destroyed before extraction opens.

## Controls

| Input              | Action                                |
| ------------------ | ------------------------------------- |
| WASD / arrows      | Move or drive                         |
| Mouse + left click | Aim and fire                          |
| Hold Space         | Assisted aim and fire                 |
| Shift while moving | Dodge                                 |
| E                  | Interact, board or exit               |
| R                  | Reload                                |
| Q / SWAP WEAPON    | Cycle collected weapons / tank cannon |
| Escape             | Pause / resume                        |

Mobile has movement, FIRE, SWAP WEAPON, RELOAD, DODGE, BOARD/EXIT/USE and PAUSE buttons. Motorcycles use personal weapons; jeeps carry a mounted shotgun. Tanks start with six explosive cannon shells and can also fire collected weapons: Q / SWAP WEAPON cycles cannon → collected weapons → cannon. Picking up a weapon automatically selects the strongest usable loadout, including the tank cannon. Personal magazines/reserves and cannon shells remain separate across swaps and exits; shells cannot be reloaded. Empty cannon fire falls back to a personal weapon. Exit vehicles to activate objectives or extract; exit the jeep to switch personal weapons. Moving tanks and jeeps crush infantry, with the normal fall/fade and score; stationary contact and soldiers behind solid cover do not award kills. Bosses cannot be run over.

The motorcycle, jeep and tank appear in guarded roadside bays around 13%, 40% and 67% of the route. Sniper, rocket and laser caches also have nearby defenders drawn from the existing patrol quota. Permanent hills and basalt stop movement and fire in both graphics modes. Each deployment scatters nine purple weapon crates, six green medical crates and five blue shield crates along accessible roadsides. Walk or drive nearby to collect them. Green supplies heal the player and repair the occupied vehicle; full health/armor leaves supplies available. Blue crates add 40 personal shield points up to 80. Shields absorb personal damage before health and remain stored while vehicle armor takes hits. Shoot red fuel drums for chain explosions; the blast can hurt you too. Trees can be shot or blasted apart. Enemy helicopters fly and land to rearm behind cover; spiders climb across obstacles and pause to rest; laser tanks telegraph a locked 3.2-metre-wide beam. Gunships and spiders fire frequent light volleys, then a slower heavy salvo with three warned 3.4-metre blast zones. Leave the warning rings or use solid cover.

## Run and build

Use Node.js 22.18 or newer (tests use native TypeScript stripping):

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

The [routes, supplies and boss plan](docs/ROUTES_SUPPLIES_BOSSES.md) records design choices, review and validation.

The [square expedition plan](docs/SQUARE_EXPEDITIONS.md) describes the current S, mirrored S, L and U layouts, permanent terrain and guarded equipment encounters.

The current [O loops and command bosses plan](docs/LOOPS_COMMAND_BOSSES.md) documents route progression, Blender art, combat tuning and release validation.
