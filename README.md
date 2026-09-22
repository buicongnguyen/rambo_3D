# RAMBO 3D — Operation Nightfall

**Play:** https://buicongnguyen.github.io/rambo_3D/

A three.js / Blender solo action game with seven stages, three levels per stage, eleven weapons, and playable motorcycles, jeeps and tanks. The first operation uses a compact 44 × 69 m map, with 12 soldiers and two relay guards on Normal. Start with a rifle and four arcing frag grenades; secure the relay and extract without needing to clear every patrol. Equipment and enemy density expand across the first three missions. Later stages begin with a 164 m zigzag approach, followed by a 202 m O loop with a choice of two arms or a 301 m U expedition, then a 372 m S or mirrored S finale (including 45-degree variants). Square maps measure 136 × 136 metres, or 196 × 196 metres for diagonal S routes. Small destructible trees divide the road arms; all routes remain tank-accessible. Approach the relay to secure it automatically, on foot or in a vehicle. Response guards walk out of nearby Blender-authored barracks in staggered waves. Clear the counterattack and follow the tactical map to extraction. See [relay houses and automatic securing](docs/RELAY_HOUSES.md). Level three of each stage ends with command bosses: helicopters, climbing spiders, laser tanks, four-gun humanoids, rocket-and-gun humanoids or twin-launcher missile trucks. Existing bosses also have an independent light gun.

## Rescue squad and recovered treasure

Approach cyan prison doors to free soldiers automatically. Up to three allies follow and fire alongside you, with their own ammunition and cyan identification marks. They travel with your vehicle and return on later missions after extraction. Rescue stops are optional and allies are protected support, keeping the arcade mission simple.

The opening has an early M249 cache with 60 bonus rounds. Collect banknotes (10 credits), gold (25) and rescue diamonds (75). Successful extraction banks treasure; the briefing Field Kit shop offers three permanent ranks, each giving +10 starting shield and +1 frag per mission, for 100 / 200 / 300 credits. Existing one-in-three enemy loot odds and difficulty-scaled special-ammo rewards remain unchanged. See the [rescue design, balance and verification plan](docs/RESCUE_SQUAD_PLAN.md).

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

After the opening raid (12 soldiers) and second mission (24 soldiers plus one tank), then the first finale (64 soldiers plus two tanks), patrols contain four times the original infantry population: 96–128 soldiers per normal stage level, with 32 additional soldiers in city levels. Regular enemy tanks add 3–5 more targets. Hard doubles these populations and Crazy quadruples them (640 soldiers plus 20 tanks in the city finale). Infantry fire two-round spreads; regular tanks combine heavy rockets and a light gun. The tactical balance pass gives the rifle 28 damage and M249 10 damage at 30 rounds/s; rockets and laser retain their heavy-target role. Difficulty also scales relay reinforcements. Every finale boss must be destroyed before extraction opens.

## Controls

| Input              | Action                                 |
| ------------------ | -------------------------------------- |
| WASD / arrows      | Move or drive                          |
| Mouse + left click | Aim and fire                           |
| Hold Space         | Assisted aim and fire                  |
| Hold B / BLAST     | Aim and fire at a safe explosive store |
| Shift while moving | Dodge                                  |
| E                  | Interact, board or exit                |
| R                  | Reload                                 |
| Q / SWAP WEAPON    | Cycle collected weapons / tank cannon  |
| F / TURBO          | Fire two weapons together for 3s       |
| Escape             | Pause / resume                         |

Mobile has a Tank-style analog movement joystick (drag gently to walk, farther to run; release to stop), FIRE, SWAP WEAPON, RELOAD, DODGE, TURBO, BOARD/EXIT/USE and PAUSE buttons. Motorcycles use personal weapons; jeeps carry a mounted shotgun. Playable tanks have 1,680 armor (previously 420), start with six explosive cannon shells and can also fire collected weapons: Q / SWAP WEAPON cycles cannon → collected weapons → cannon. Picking up a weapon automatically selects the strongest usable loadout, including the tank cannon. Personal magazines/reserves and cannon shells remain separate across swaps and exits; shells cannot be reloaded. Empty cannon fire falls back to a personal weapon. Relays and prison rescues activate automatically in vehicles too. Exit your vehicle to extract; exit the jeep to switch personal weapons. Moving tanks and jeeps crush infantry, with the normal fall/fade and score; stationary contact and soldiers behind solid cover do not award kills. Armored enemies and bosses cannot be run over.

The motorcycle, jeep and tank appear in guarded roadside bays around 13%, 40% and 67% of the route. Sniper, rocket and laser caches also have nearby defenders drawn from the existing patrol quota. Small multi-hit trees replace rock and concrete barriers in both graphics modes; destroy them to open shortcuts. Buildings still block movement and gunfire. Long, indestructible concrete walls enclose all four map edges in every level. Tanks crush small trees at half movement speed until their hull clears the tree footprint, then recover normal speed; bikes and jeeps must shoot through or go around. Nearby BOARD / EXIT / objective hints appear for one second, while E and the mobile USE / EXIT button remain available. From the first finale onward, each deployment scatters nine purple weapon crates, six green medical crates and five blue shield crates along accessible roadsides. Walk or drive nearby to collect them. Green supplies heal the player and repair the occupied vehicle; full health/armor leaves supplies available. Blue crates add 40 personal shield points up to 80. Shields absorb personal damage before health and remain stored while vehicle armor takes hits. Shoot red fuel drums or marked EXPLOSIVE crates for outward fireballs, sparks, debris and chain explosions. Damage falls off over a 5.5-metre radius: nearby soldiers can be killed, and players and vehicle armor can be damaged. Walls and buildings block blast damage. Trees can be shot or blasted apart. Enemy helicopters fly and land to rearm behind cover; spiders climb across obstacles and pause to rest; laser tanks telegraph a locked 3.2-metre-wide beam. Gunships and spiders fire frequent light volleys, then a slower heavy salvo with three warned 3.4-metre blast zones. Leave the warning rings or use solid cover.

## Bullet Storm combat

Press **F** or tap **TURBO**, then hold FIRE: two different weapons shoot together for three seconds. Each consumes its own magazine and reload reserve. Weapon swapping pauses during the burst; collected pickups trigger automatic strongest-weapon selection afterward. Turbo has a 14-second cooldown. **Tuned Weapons** unlocks auxiliary guns on all vehicles and adds 0.4 seconds per rank (maximum five seconds); at rank three, vehicles can fire three guns. **Light Kit** shortens Turbo cooldown by 0.75 seconds per rank to a minimum of eight seconds. Exiting, boarding, defeat and restarting cleanly end a burst.

Bullet tracers are compact rounded rounds at half the previous length and width. Both sides use orange bodies, yellow tips and a small red tail, including on snow; player cores are brighter yellow and incoming rounds are deeper orange. Killing shots throw infantry along the bullet's direction, with stronger hits throwing farther; obstacles stop the fallen body. Small blood marks fade with the corpse. Rocket-killed enemy tanks separate into pieces of their Blender models that arc, fall and fade. Trees burst into green dust, leaves and wood fragments. All transient effects have fixed lifetimes and population caps.

See [environment interaction details and validation](docs/ENVIRONMENT_INTERACTIONS.md) for perimeter walls, explosive stores, timed hints and tank tree crushing.

See [the implementation and improvement plan](docs/BULLET_STORM.md) for scope, upgrade rules and suggested next additions.

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

35 original GLB models and editable `art/nightfall.blend` are committed. Regenerate with:

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

## Compact rounds and balance

The M249 fires 30 rounds/second at 10 damage per round, with a 120-round belt and a 2.8-second reload: approximately 37% less sustained damage than the previous release. The rifle deals 28 per shot. Enemy tanks resist 80% of ordinary bullet damage; rockets, grenades, explosive stores and laser bypass that resistance. Sniper retains 70% damage against armor, flame 15%, and gas 10%. Enemy tank shells deal 36 damage and light guns 8 (both doubled), with a 0.8-second main-gun warning. Damaged enemies respond out to 42 metres instead of remaining inactive under long-range fire.

Hold **B** on PC or **BLAST** on mobile to use the current gun against a visible explosive store. An orange ground ring marks the target; selection favors crowds and excludes blocked shots, insufficient range and chains inside a safety buffer around the player or occupied vehicle. Ordinary mouse aiming remains available. Small depot squads reuse existing infantry slots. Explosion kill counts and metallic armor feedback make the consequences clear. Every defeated enemy has a one-in-three chance of leaving a single health (+15), shield (+20), or ammunition package. Ammo restores a magazine to owned special weapons, up to four reserve magazines. Enemy loot expires after 45 seconds and is capped at 48 packages for performance. The six roadside medical crates, shields, 1,680 playable tank armor and six cannon shells remain available.

See the [combat review and balance plan](docs/TACTICAL_COMBAT_REVIEW.md) for source comparisons, measured causes, implementation and validation.

## Short missions and tactical flanking

Q / SWAP selects your starter frag grenade. Aim its amber landing ring with the mouse; mobile FIRE targets nearby enemies. The real projectile arc clears low crates and is blocked by tall cover. Enemies use forward vision cones, turn gradually, and investigate last seen/heard positions instead of tracking you through walls. Gunfire reveals you locally. Attack infantry from behind for 1.75× direct bullet damage; regular tank rear armor admits at least 65% of bullet damage. Bosses have no rear bonus. The HUD reports enemy sight and the minimap shows enemy facing.

See [progression and flanking](docs/PROGRESSION_AND_FLANKING.md) for equipment unlocks, specific rules, and validation. This replaces the previous starter kit and loot-frequency rules in the historical balance notes.

## Enemy infantry roles

Knife rushers chase after alarm; long-sword soldiers telegraph a broad sweep; knife throwers strafe and launch visible spinning blades; rocket troops warn with a locked orange aiming line. Riflemen remain the majority. Roles replace existing patrol slots and appear gradually across the first three missions. Cover, sidestepping and recovery windows give the starter rifle and dodge useful counters. Easy/Normal allow one infantry rocket aiming or airborne at a time; Hard/Crazy allow two.

See the [enemy infantry evaluation and plan](docs/ENEMY_INFANTRY_PLAN.md) for exact balance, sources, Blender assets, attack rules and validation.
