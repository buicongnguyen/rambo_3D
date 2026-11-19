# AAA plan, November 2026

The goal is the bar set for all of these games: vivid, warm, readable art at the level of Mario Kart 8, a reason for every fight, and a game you want to replay. This document records the evaluation, the owner's ideas, new ideas, the plan, its refinement and what was built.

## 1. Where the game stands

Played on 2026-11-19: briefing, the White Horizon opening on PC (1440 × 900) and on a phone in landscape (844 × 390), and the Cinderfall finale.

| Area | Grade | What we saw |
| --- | --- | --- |
| UI and HUD | A− | The briefing, quartermaster, HUD and phone controls are clear and consistent, and the 11 px / 44 px audit holds on six screen sizes. |
| Game feel | B+ | Hit-stop, shake, a slow-motion final kill, flank bonuses, haptics and adaptive music are in place. |
| Story | B+ | Since 18 Nov every mission gives Lantern's convoy a reason to fight and a result afterwards. |
| Combat variety | B | There are five infantry roles, vehicles, eleven weapons and seven boss types. |
| Light and atmosphere | C | Every stage uses the same midday light. The game is called *Nightfall*, yet nothing ever happens at dusk or at night. Snow, ash and dust stay still, and nothing moves in the air. |
| Player identity | C | There is one hero (the male commando) and no customisation. Stars buy only credits. |
| Objective variety | C | All 21 missions use the same loop: relay, response, extraction. |
| Performance | B+ | PC opening: 318 draw calls and 254 k triangles. Phone 2.5D: 127 draw calls. |

## 2. The owner's ideas

| Idea (source) | Verdict |
| --- | --- |
| Reuse Willowmere's people with clothes and disguises (14 Oct) | The chibi bodies clash with the action figures. **Port the idea instead:** outfits built natively for the RAMBO rig (`art/build_disguises.py`). Phase 1. |
| Play as the commando woman (14 Oct) | Phase 1. |
| Build replay around mastery, not grinding (`ARCADE_RETENTION_REVIEW.md` §5) | Phase 1: outfits unlock with stars, so they reward mastery. |
| Objective variety: convoy escort, defence, radio rescue (`ARCADE_RETENTION_REVIEW.md` §2) | Phase 3, convoy escort first, because the new story is about the convoy. |
| Differentiate enemies (§3) | Done earlier: rusher, swordsman, thrower, rocketeer, ninja. |
| Directional hit flashes, material sounds (§4) | Mostly done (COMBAT_FEEDBACK). Material sounds remain in Phase 4. |
| Squad identities and specialist choice (`RESCUE_SQUAD_PLAN.md`) | Phase 4. |
| A sculpted, skinned benchmark commando (`ART_UPGRADE.md`) | Deferred. It conflicts with the rigid-part rig, the 2.5D sprite bake and the size budget. The outfit kit raises the hero's look for a fraction of the cost. |
| Real-phone playtests (several reviews) | Still needed. They need the owner's devices. |

## 3. New ideas

1. **Night falls as you push.** Each stage's light runs from its own time of day at level 1 to dusk at the finale. The last finale, Mire Crossing, is fought at night under a moon, with the hero carrying a light. The title finally means something, and each stage gets its own mood.
2. **Living air.** Each biome has one cheap instanced particle layer: snowfall, ash and embers, blowing sand, drifting pollen, tremor dust, and fireflies over the night mire. Each layer is one draw call and follows the camera.
3. **The hero you choose.** On the quartermaster's new Wardrobe page you pick Ghost's body (commando or commando woman) and an outfit. The six outfits (sailor, pirate captain, sun knight, áo dài with nón lá, golden star and battle robot) unlock at 3, 6, 12, 18, 27 and 40 stars. They are cosmetic only, so balance and tests do not change. Rescued allies keep the cyan marks, so the hero still stands out.
4. **Convoy moments** (Phase 3). Lantern's truck crosses the extraction zone after a win and becomes an escort objective in the level 2 missions.
5. **Photo-ready finale** (Phase 4). The slow-motion final kill also offers a "dossier" card, showing the hero in their outfit, the stage at dusk, stars and time, to share.

## 4. Plan

### Phase 1: Hero and wardrobe
- `art/build_disguises.py` builds `disguises.glb`: six outfits as pieces per joint, with tints and hidden parts as extras, fitted for both bodies. Budget: under 170 KB and 4,000 triangles.
- `art/disguise_dress.py` is the one place that dresses a body. The card renderer (`build_disguise_icons.py`) and the 2.5D sprite baker both use it, so a card and a sprite always match what the game shows.
- `src/wardrobe.ts` applies the same rules at runtime: shared tinted material clones (so instancing still works), hidden parts removed from the clone (a corpse batch cannot bring them back), and pieces hung on the body's joints with the woman's fit. `disguises.glb` loads the first time an outfit is needed, never at boot.
- The save gains `hero`, `outfit` and `outfits` (unlocked ids). Validation sanitises them. They survive a stage change and a new campaign.
- Everywhere the hero appears is dressed: the mission rig, the vehicle rider, the briefing preview and the 2.5D sprite (one sheet per body and outfit, fetched only when worn).
- The quartermaster's Wardrobe has two hero cards and seven outfit cards that show their star lock. All of it must pass the 11 px / 44 px screen audit.

### Phase 2: Nightfall light and living air
- `src/atmosphere.mjs` holds a unit-tested `LIGHT` table per stage (day and dusk grades: key colour, intensity and elevation, sky and ground fill, fog colour and density, exposure) and `gradeFor(stage, level)`. The Mire finale is night.
- `world.build()` applies the grade. At night it adds a soft light that follows the hero (no shadow, so it stays cheap). Enemy rings, muzzle flashes and pickups keep their emissive colours, so the fight stays readable.
- `src/air.ts` draws one instanced layer of motes per biome near the camera: wind, fall speed and twinkle on the GPU, half the count on Low, none with reduced motion.

### Phase 3: Convoy (next)
- Lantern's truck (a new Blender model) drives through after the win. Escort level 2 missions get their own fail, retry and pathfinding rules, as the 2026-10 review asked.

### Phase 4: Depth (later)
- Squad specialists (medic or grenadier), material hit sounds, the finale dossier card and real-phone playtests.

## 5. Refinement after review

The first draft changed when it met the code.

- **Sprites.** On phones the hero would otherwise be a 36-mesh 3D rig, about 70 draw calls with shadows, against 127 for the whole phone scene. The hero therefore keeps a baked sheet per look, but the sprite renderer now loads hero sheets lazily, so a player downloads only the one they wear.
- **Size budget.** The 51 boot models total 5.38 MB against a 5.5 MB cap. An outfit file at boot would break the cap. It loads on demand instead and has its own byte test.
- **Hiding parts.** Hiding a hidden pack by setting `visible = false` is not enough: when a body falls, `ActorBatches` redraws every mesh of the corpse. Hidden parts are removed from the clone instead.
- **Stars.** "Start over" wipes stars, so unlocked outfits are stored separately (`outfits`) and never relock.
- **Night.** A dark finale could hurt readability and fairness. Night keeps strong moonlight (at least 45% of the day key) and a hero light. The finale's bosses and warning rings are emissive. A test checks that the night key never drops below that floor.
- **Phase 3** needs a new truck model, escort pathing and fail rules. It moved out of this pass rather than being rushed.

## 6. Status

See the end of this file, updated as each phase lands.
