# Enemy infantry variety — design and implementation

## Evaluation

The proposed knife, sword, rocket and throwing-knife soldiers are useful additions because they can change positioning and target priority. Simply giving differently dressed soldiers the same rifle AI would add little. The implementation keeps ordinary riflemen as the majority and assigns each specialist a readable threat, a response available with the starter kit, and a recovery window. No special counter-weapon is mandatory.

Bungie's [Combatant Modifiers developer insight](https://www.bungie.net/7/en/News/article/combatant_modifiers) describes using distinct combatant abilities to change player strategy while reducing restrictive equipment requirements. Valve's [The AI Systems of Left 4 Dead](https://cdn.cloudflare.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf), especially pages 77–81, explains alternating pressure and relief rather than constant unchanging intensity. These support the design direction; the numerical balance below is specific to this game's scale and controls, not copied from those games. This release uses bounded simultaneous specialist attacks and recovery intervals, not a full adaptive director.

## Roster and counterplay

Base health gains the existing +8 per level within each stage. Damage is before shield/vehicle absorption. Speeds and distances use world metres. Existing rifleman and tank attacks remain in place.

| Role               | Base HP | Speed | Attack                                        | Warning |      Recovery after release | Player response                               |
| ------------------ | ------: | ----: | --------------------------------------------- | ------: | --------------------------: | --------------------------------------------- |
| Rifleman           |      65 |   1.9 | Existing two-round burst, 6 per round         |   0.6 s | Existing 1.6–2.02 s cadence | Cover, flank, grenades                        |
| Knife rusher       |      42 |   4.8 | One 10-damage stab, 1.25 m reach              |   0.5 s |                       1.2 s | Backstep, dodge or shoot its low HP           |
| Long-sword soldier |      90 |   2.8 | One 18-damage sweep, 2.1 m, 120-degree sector |  0.85 s |                       2.0 s | Leave the orange arc; punish recovery         |
| Knife thrower      |      56 |   2.6 | One 10-damage blade at 11 m/s                 |  0.75 s |                       2.5 s | Sidestep, close the distance or use cover     |
| Rocket soldier     |      75 |   1.5 | One 24-damage rocket at 11 m/s; 2.2 m blast   |   1.1 s |                       4.5 s | Move off its fixed aiming line or break sight |

Specialists also finish a 0.24-second release pose before the recovery clock counts down. Knife throwers engage within 15 m; blades expire after 1.6 seconds. Rockets engage from 6–22 m, expire after 2.2 seconds, and cannot home. Near-miss rocket explosions deal 19.2 damage; a direct hit deals 24 once, protected against a second simultaneous splash hit by the existing brief hit invulnerability. Solid cover blocks the splash. Melee against an occupied tank deals only 1 armor damage.

## Introduction and encounter mix

1. White Horizon I retains 12 Normal infantry: ten riflemen and two knife rushers. Relay reinforcements remain riflemen. The short relay mission, early machine-gun cache, optional prison and extraction are preserved.
2. White Horizon II introduces sword soldiers and knife throwers, alongside the earned bike and jeep.
3. White Horizon III adds rocket soldiers. Later stages use the complete roster.
4. A repeating 20-slot mature patrol mix contains 11 riflemen, four rushers, two sword soldiers, two throwers and one rocketeer. Small roster tails may differ slightly. Roles replace existing infantry; difficulty multipliers, tank counts, objective guards and boss counts retain their established meaning.
5. Later house reinforcements can include specialists. They finish the visible doorway walk before attacking.

Simultaneous attack limits:

| Difficulty | Melee windups | Knife-throw windups | Rocket windups + live infantry rockets |
| ---------- | ------------: | ------------------: | -------------------------------------: |
| Easy       |             2 |                   2 |                                      1 |
| Normal     |             3 |                   3 |                                      1 |
| Hard       |             3 |                   3 |                                      2 |
| Crazy      |             4 |                   3 |                                      2 |

These limits apply to the new infantry attacks. Riflemen, armored vehicles and bosses keep their separate weapons. Waiting specialists can still move; they do not all discharge a rocket on the same frame.

## AI and combat rules

- Reuse forward vision, local gunfire alarms, last-seen memory, solid-cover visibility, bounded A* navigation and local separation. Knife troops do not know the player's hidden position.
- Rush only after alarm. Visible pursuit uses the role's movement speed; cover investigation uses the same staggered navigation budget as existing patrols.
- Specialists stop moving during a warning. Attack direction locks at its start. Melee resolves once against the warned sector, distance, current player/vehicle hull and current line of sight.
- Breaking sight cancels the warning and requires a fresh one. Sidestepping out of the sector avoids a swing. Killing the soldier cancels unlaunched attacks; airborne blades and rockets remain physical projectiles.
- Earthquakes cancel warnings and reset a short preparation delay. Restart clears projectiles and actor state. Leaving activation range cannot preserve a nearly completed surprise attack.
- New projectiles use existing swept collision against walls, parked vehicles and the occupied player hull. Their lifetime is explicit. The collectible eleven-weapon arsenal and ally weapons are unchanged.

## Art, animation, UI and performance

- `art/build_infantry_kit.py` generates three GLBs and the editable `art/infantry-kit.blend`: a short fighting knife, a long sword and a throwing blade. Geometry includes tapered steel facets, honed edges, guard, wrapped grip, pommel and amber identification. Repeated grip meshes are deduplicated; the three GLBs total **69,504 bytes**.
- Reuse the articulated infantry rig. Rushers wear rust-colored uniforms, sword troops muted charcoal, throwers ochre with spare blades, and rocket troops orange with a launcher and spare tube. Existing cyan player/ally identification stays distinct.
- Running legs follow actual movement. Knife stabs, sword swings and knife throws use shoulder, elbow, spine and weapon pivots; idle/update resets each pose.
- Warning arcs show melee direction; rocket aim uses a thin orange ground line. A short first-encounter hint appears once per role per mission. An expandable field-guide section explains counters without adding a permanent HUD panel or mobile button.
- Material variants, weapon geometry and warning geometry are shared. No per-enemy textures, lights, pathfinding loops or timers are added. A single linear pressure count reuses the existing enemy and bullet lists.

## Validation and release

Automated checks cover gradual composition, melee sector boundaries, warning duration, actual damage, sidestepping, wall protection, alarm/last-seen pursuit, projectile geometry and expiry, rocket pressure, quake/death/retry cleanup, tank armor and shared render resources. Existing navigation, progression, rescue, mobile layout, animation, all-stage population and dense-combat checks are also run.

Review a close-up lineup in both graphics settings, then inspect ordinary gameplay scale on desktop and mobile. Publish through the existing SSH Git remote and the GitHub Pages workflow only after required build and browser checks succeed. Verify the deployed bundle and actual keyboard/touch controls.

Future tuning should be based on play sessions: measure deaths by role, damage during the first three missions, dodge usage and completion time. Consider a rare medic or shield carrier only after these four roles are readable and fun; adding more enemy types immediately would make learning harder.

### Local validation completed

- Production TypeScript/Vite build passed.
- All 56 unit tests passed.
- Thirty targeted browser regressions passed across combat, animation, navigation, progression, rescue, mobile layout and dense-combat performance. The final nine specialist checks also passed (eight together and the corrected phone control-selector check separately).
- A 660-enemy Crazy city scenario with three allies measured mean simulation updates of 3.00 ms (Low) / 3.04 ms (High), p95 4.60 / 4.40 ms, and 37 / 39 draw calls. These are local software-renderer test samples, not guaranteed device FPS; randomized active populations differ between runs.
- Close-up art and ordinary phone-scale warning screenshots were inspected. The player remains visually distinct and all seven mobile action controls retain their established layout.
- Review found and corrected a text-encoding issue, an oversized first blade export, a phone-test selector, and low-contrast thrown steel on snow. The final blade has a short warm streak; the three GLBs fit the original total asset budget.
