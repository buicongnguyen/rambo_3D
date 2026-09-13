# Bullet Storm implementation plan

## Combat density and balance

- Multiply existing patrol populations by four, preserving Easy/Normal/Hard/Crazy ratios and finale boss counts. Add one regular enemy tank per eight original patrol positions, scaled by difficulty; these tanks are not command bosses and do not lock extraction on their own.
- Increase player weapon damage by 65% and firing cadence by about 20%. Infantry fire two-round spreads with readable windups. Tanks fire slower heavy rounds and a light gun.
- Use nearby spatial groups for infantry separation and projectile candidates, stagger expensive navigation work, and distance-cull animation/rendering in both graphics modes. Keep effects, wreckage and blood marks bounded and temporary.

## Impact and destruction

- Killing shots push infantry along the projectile direction. Blast kills push outward from the explosion. Knockback distance scales with hit strength and weapon tier; sweep the body against current obstacles and stop near walls. Bodies fall backward and fade after four seconds.
- Add small dark-red ground splashes with brief airborne droplets on infantry deaths. These are cosmetic, fade out and never block movement.
- Explosive kills on tanks detach several actual model parts, throw them upward/outward, collide with ground/cover, and fade. Non-explosive tank kills retain a settling wreck. Preserve one kill/score award.
- Trees require several rifle hits, shed green leaf dust and wood fragments when destroyed, and immediately release collision. Convert large rock, hill and concrete/block obstacles to clusters of small destructible trees in all 21 levels. Retain city buildings, roads, relay clearings and safe vehicle bays.
- Bright stages use orange cores with red edges for player tracers; dark stages use saturated gold. Enemy rounds use vivid magenta with dark edges to distinguish dangerous incoming fire. Keep laser/flame/gas identities.

## Turbo controls and upgrades

- F on PC and a TURBO touch button activate a three-second two-weapon burst when two distinct usable weapons are owned. FIRE still controls shooting. Each gun retains its own ammunition, reload and cadence.
- Turbo cannot be stacked. Its cooldown starts after the burst, with a clear countdown in the HUD. Manual switching is temporarily locked during the short burst; collected weapons are stored and automatic selection resumes afterward. Boarding/exiting or defeat ends Turbo cleanly.
- First Tuned Weapons upgrade unlocks auxiliary Turbo fire on the bike, jeep and tank. Higher power ranks extend Turbo, up to five seconds; rank three unlocks a third simultaneous gun on vehicles. Mobility upgrades shorten the cooldown to a minimum of eight seconds.
- Update the field manual, upgrade descriptions, difficulty descriptions and mobile layout. Test portrait and landscape touch targets and simultaneous movement/FIRE/TURBO.

## Verification and release

1. Review all 21 layouts for obsolete barriers, route clearance, destructible tree health and reachable objectives/vehicles.
2. Test population ratios, infantry/tank behavior, knockback direction/distance/wall stops, blood expiry, explosive tank breakup, tree debris and cosmetic cleanup.
3. Test Turbo duration/cooldown, unlocks, independent ammo/reload, manual/pickup behavior, vehicle transitions and restart.
4. Measure representative dense combat update/render costs in Low/High; fix hot paths before release. Run existing campaign, weapons, mobile and production tests.
5. Commit and push via SSH, wait for GitHub Actions/Pages, and verify the public build and controls.

## Further improvements suggested

- Chain-destruction score bonuses and short combat medals would reward blowing open useful routes.
- Visible armor weak points could make flanking enemy tanks more rewarding than firing straight ahead.
- Guarded ammunition convoys could provide a mid-level objective and resupply for long firefights.

These three ideas are follow-up suggestions; this release focuses on the requested density, destruction and Turbo systems.

## Review findings and measured validation

- Fixed a spawn mismatch: infantry now reserve their full 0.65 m projectile radius, preventing edge overlap with props on Faultline Zero.
- Corpse movement reserves the full fallen silhouette. A soldier already near a wall leans against it instead of clipping through it.
- Enemy rocket splash damages the player/vehicle rather than inadvertently treating it as a friendly explosion. Hit protection prevents a direct hit and its splash from charging damage twice.
- Nearby grids replace whole-population crowd/projectile scans, and navigation uses a spatial broad phase with a per-step request budget.
- Repeated Blender mesh parts use GPU instancing, including fading corpses grouped into eight fade steps. Each actor retains its own animated transform and collision. Shared source geometry/materials remain owned by the asset library; batches and cosmetic fade copies are disposed on level changes.
- A Crazy city stress scene contains 640 infantry and 20 tanks, with roughly 150 active nearby and over 150 concurrent projectiles. Local samples averaged about 3–6 ms per simulation step. Rendering submissions fell from approximately 7,600/11,300 (Low/High) to 800/1,000 after instancing. Exact repeatable test output is recorded in `bullet-storm-validation.json`; randomness changes the individual sample.
- These CPU timings and draw counts are measured in a software-rendered browser and do not establish physical mobile/PC frame rates. Low removes shadows, limits resolution and distant actors, and uses smaller effect budgets. Both graphics modes retain identical enemy populations and gameplay.
