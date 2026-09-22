# Rescue squad and treasure expansion

## Player experience

The opening stays a short arcade mission: move, collect the early M249 bonus, optionally free a prisoner at the cyan door, secure the relay, defeat its response guards, and extract. The first rescue is close to the start. It teaches a useful detour without requiring a new keyboard command or touch button.

Every mission has one or two prison stops. Later routes allow a second rescue where there is safe roadside space. The existing story objectives, stage routes, patrol counts, bosses and difficulty multipliers remain intact.

### Rescue loop

1. Notice the cyan prison beacon, door ring and minimap square.
2. Reach the marked door. Rescue happens automatically with a clear approach, on foot or in a vehicle.
3. The gate rises and the freed soldier waits for clearance, then walks out visibly armed. The open doorway and interior become traversable; the individual masonry walls remain cover. Cyan foot rings and overhead marks identify friends.
4. Allies follow the player's route and fire in the player's firing direction while FIRE is held. They reload their own rifles and never consume player ammunition.
5. Collect the rescue diamond and reach extraction. Saved allies deploy alongside the player in the next mission.

A maximum of three supporting soldiers keeps the battlefield readable and limits animation, navigation and projectile work. Further rescued prisoners evacuate directly and still release their diamond. Allies are protected support: they do not block the player, soak up enemy bullets, or introduce escort-failure conditions. When boarding, the squad travels with the player and reappears in clear space after exiting. They do not add free mounted guns.

### Rewards and balance

| Reward | Effect |
| --- | --- |
| Opening M249 cache | 60 ready rounds, zero initial reserve; equips automatically |
| Banknotes | 10 credits |
| Gold bars | 25 credits |
| Rescue diamond | 75 credits |
| Rescue | 250 score; one ally if space is available |
| Field Kit ranks 1 / 2 / 3 | Cost 100 / 200 / 300 banked credits |
| Each Field Kit rank | +10 starting shield and +1 frag per mission, including retries |
| Supporting rifle | 12 damage, one shot per 0.34 seconds, 12-round magazine, 1.6-second reload |

The starter rifle still has unlimited reloads. Existing special-ammo pickups still scale with difficulty: full magazine on Easy/Normal, 20% on Hard, 10% on Crazy. Treasure is placed in the world or released by rescues; it does not introduce another enemy loot roll. Each defeated enemy still has the existing independent one-in-three chance of dropping one health, shield or ammunition package.

Treasure is provisional during a mission. Failure or restart discards unbanked rewards and new recruits; previously saved allies and Field Kit ranks return. Extraction saves the mission, treasure and squad immediately. Field Armor is the default free mission upgrade; choosing another upgrade on the result screen replaces it. Reloading at the result screen therefore retains progress without duplicating rewards. New campaign/stage selection resets these campaign resources, keeping the existing best-score behavior.

## Implementation

- `src/rescue.mjs`: deterministic prison placement, finite roadside bonuses and shared economy limits. Placement keeps roads, tank bays, barracks emergence lanes, extraction and hazardous patches clear.
- `src/squad.ts`: bounded support actors, articulated walking/running, staggered clearance-aware navigation, a bounded player trail, formation spacing, independent firing/reloading and vehicle transport.
- `src/game.ts`: automatic one-time rescues, gate animation, real friendly projectiles, collision-aware pickups, finite bonus weapon ammunition and lifecycle cleanup.
- `src/rules.mjs` / `src/economy.mjs`: backward-compatible version-2 saves, validated credits/squad/kit ranks and affordable capped purchases. Paid kit ranks do not alter the existing earned-upgrade invariant.
- `src/main.ts`: compact shield/allies/field-credit status, cyan minimap markers, contextual rescue hint, extraction rewards, optional briefing shop and field-manual instructions. Mobile retains its seven existing action buttons.
- `art/build_rescue_kit.py`: reproducible Blender source for `prisonHouse`, `money`, `gold`, `diamond`; editable scene in `art/rescue-kit.blend`. The prison uses a separate Gate pivot, barred facade, masonry seams, partial roof, lock and cyan beacon. Collectibles have modeled paper bands, beveled ingots, stamped details and faceted gemstone geometry.

The four GLBs add 100,228 bytes combined. The complete model budget is capped at 9.65 MB (previously 9.5 MB). Shared material/geometry batching is preserved; no new per-frame texture creation or unbounded loot population is introduced.

## Verification

- All 21 layouts: at least one accessible prison, unobstructed exit, open roads, usable vehicle bays and supply placement across multiple seeds.
- Rescue once only; actual gate movement; visible armed ally; safe emergence; squad cap and restart cleanup.
- Wall-aware following, distinct formation positions, aligned burst fire, real damage to enemies and solid-cover bullet blocking.
- Foot, motorcycle, jeep and tank treasure collection; wall-separated pickups cannot be collected.
- Finite 60-round opening bonus; personal ammo is unaffected by ally shooting.
- Legacy-save migration, invalid-value rejection, credit/kit limits, affordability, extraction persistence, upgrade choice and retry behavior.
- Mobile automatic rescue and readable status without adding controls; existing portrait/landscape layout checks retained.
- Dense Crazy city profiling includes three active allies in both graphics settings. Automated software-renderer timings are regression indicators, not measurements of physical phone FPS.

## Next design opportunities

These are follow-up ideas, not features claimed by this release:

- Give rescued soldiers small narrative identities and a different radio line for each biome.
- Introduce a clearly signposted specialist choice after the basic rescue loop is familiar: medic support versus grenadier support, with mutually exclusive benefits.
- Measure opening mission completion, first-rescue discovery and use of the Field Kit shop before increasing mission complexity or extending the squad cap.
- Playtest on real low-end Android and iOS devices to confirm thermals, touch comfort and frame pacing beyond browser emulation.

### Local release checks

Build and TypeScript compilation pass. The full 92-test browser run passed, followed by 13 targeted browser checks after the final doorway/save review fixes. The final unit suite contains 52 checks. GitHub Actions reruns the complete suite before publishing.

In the scripted Crazy city scenario (660 enemies plus three allies), Low recorded 2.25 ms mean / 2.90 ms p95 simulation updates and 35 draw calls; High recorded 1.88 ms mean / 2.40 ms p95 and 51 draw calls. These are separate randomized software-renderer runs on the development PC, not a GPU comparison or a real-phone frame-rate claim.
