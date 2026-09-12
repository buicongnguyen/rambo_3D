# Square expeditions and guarded equipment

## Experience and level plan

The second and third levels of every stage now use a 136 × 136 metre map. The first level keeps its northbound zigzag approach; Faultline Zero retains its southbound approach.

| Stage | Level 2 | Level 3 |
| --- | --- | --- |
| White Horizon | S sweep | L trail |
| Cinderfall | Mirrored S sweep | U trail |
| Dune Lifeline | S sweep | L trail |
| Canopy Hold | Mirrored S sweep | U trail |
| Citadel Dawn | S sweep | L trail |
| Faultline Zero | Mirrored S sweep | U trail |
| Mire Crossing | S sweep | L trail |

S sweeps cross all four quadrants with two broad hairpins. Mirrored S sweeps reverse the turns. L trails run down one edge and across the bottom; U trails descend one side, round the bottom and climb the opposite side. All four occupy at least 100 metres in both axes. Roads keep a 7 metre surface and at least 7.6 metres of scenery clearance. Turns accommodate tanks.

The route is the source for spawn points, objective, final reinforcements, extraction, road rendering, vehicle bays and supply placement. The relay is at 78% of an expedition. Finale bosses deploy on the final arm, with space reserved for all four Crazy bosses. Saved campaign indices and upgrades remain valid.

## Permanent terrain

- S maps use two continuous ridge belts that separate the road arms and stop diagonal shortcuts. L and U maps have a broad rocky interior and an open outer corridor.
- Cinderfall and Faultline use dark basalt. Other biomes use low rocky hills, with pale rock in White Horizon.
- Landforms reuse the Blender rock model, fitted to their collision footprints and joined by a shallow bedrock base. They stop infantry, vehicles, bullets, lasers and blast line of sight.
- They have no destructible-health component: shooting, explosions and tank contact cannot remove them. Fuel drums and trees retain their existing destruction behavior.
- Permanent terrain stays visible in both Low and High graphics. Static geometry is batched; this change adds no asset downloads.
- The tactical map draws permanent ridges in gray. The briefing, route caption and field manual explain the layout and equipment encounters.

## Equipment encounters

The motorcycle appears around 13% of the route, the jeep around 40%, and the tank around 67%. Placement may shift a little to find a safe roadside bay. Parked vehicles leave the main road open, with tank-width connections to the road and safe boarding/exiting space. Scenery, traps and explosive drums are kept away from reserved bays.

Each vehicle has two nearby defenders in Normal/Easy. Sniper, rocket and laser caches also get two nearby defenders. These defenders replace twelve existing patrol positions; Hard and Crazy apply their existing two/four-times multipliers. Enemy totals and health settings are preserved. Other weapons, health and shields retain slightly randomized shoulder placement and accessible approaches.

Equipment remains physical and collectible. Killing guards does not delete or reset it, and there is no invisible lock preventing a risky capture. Blue vehicle markers and purple weapon markers help the player choose when to fight or advance.

## Implementation and review

1. Add explicit route shapes and square bounds, while retaining the seven-stage, three-level campaign and saved progress.
2. Generate biome scenery, permanent ridges and clear final encounter areas from the selected route.
3. Reserve vehicle bays before placing scenery and hazards. Distribute vehicles in upgrade order, and assign existing patrols to defend vehicles and selected caches.
4. Render permanent landforms using the existing Blender rock asset. Match model extents and collision and show terrain in the tactical map.
5. Check all 21 tank routes, final encounter formations, equipment access, seeded supplies, difficulty counts, weapon behavior, desktop and touch controls.
6. Build, review browser results and visual captures, commit and push through SSH, wait for GitHub Pages checks, and verify the published version.

## Validation

Unit checks exercise all 21 layouts and 630 supply seeds with parked vehicles included as obstacles. They require exact supply quotas, two defenders per selected reward, clear tank routes and bays, full map extents, and permanent terrain across direct shortcuts. Browser regressions cover all mission patrol counts, real boarding/exiting and weapon collection, and rifle/rocket/laser damage against permanent basalt.

- 21 Node checks passed, including 630 seeded supply/guard layouts with parked vehicles.
- All 34 browser cases passed across the full run and targeted reruns. An old boss-animation fixture was updated to spawn at the mission's real boss anchor instead of a coordinate now occupied by terrain. The seven affected campaign/expedition checks and seven final expedition/route checks passed.
- Production build passed. The existing 32-model download budget is unchanged.
- High desktop captures checked for all four shapes; 390 × 844 Low touch capture checked for visible controls, weapon switching and horizontal overflow. No browser page errors. These checks do not establish physical-device frame rates.
- GitHub Actions runs the full suite again before publishing to GitHub Pages.

![Actual square expedition layouts, equipment and terrain](square-expeditions.svg)

![Guarded jeep on a mirrored S route](expedition-desktop.png)

![Mobile expedition and touch controls](expedition-mobile.png)
