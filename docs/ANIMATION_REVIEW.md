# Character animation, 3D asset and logic review

Reviewed and fixed 2026-09-11. Scope: original Blender assets, GLB import/instancing, actor motion, combat lifecycle, input, navigation, state persistence and publishing.

## Asset assessment and improvements

The earlier characters were disconnected static shapes translated as one group. They had no hip/knee/shoulder/elbow hierarchy; bobbing the whole model could not communicate gait. The updated Blender source defines editable joint pivots and segmented limbs, rounded torso/shoulders, knee pads, boots/soles, carrier pouches, shaped heads, eyes, a separate non-intersecting hair cap, and a detailed rifle held by the right forearm. Mara no longer carries an unexplained rifle while captive.

Player, enemy and companion animation uses actual distance moved after collision, so feet stop cycling against cover. Running uses longer strides, knee lift, arm swing and torso motion; firing while moving becomes a slower aimed walk. Upper-body recoil, reload hand motion, idle breathing, hit flinch and a low dodge pose layer over locomotion. Lower-body heading follows movement independently of aim.

Helicopter blades rotate together around an authored rotor pivot. The tank's turret tracks the player independently of its moving hull. The barge rocks on the water. Defeated humans collapse with articulated limbs; the gunship drops and tilts, the barge lists/sinks, and the tank settles. Bodies stay briefly, then fade smoothly over two seconds and release their fade materials. Scenery remains a coherent stylized low-poly environment; it is not photorealistic. Rock geometry was refined, but large environment and texture-authoring expansion is outside this pass.

## Findings fixed

| Priority | Finding                                                                                                 | Correction / regression evidence                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Defeated characters vanished immediately, and the player retry modal hid death feedback.                | Non-collidable remains fall, hold, fade, and dispose. Player enters `dying`, then `lost` only after the four-second presentation. Pause freezes the sequence. |
| P1       | Material sharing across GLB instances makes naive opacity fades affect living characters.               | Clone materials only for remains. Fade/dispose owned clones; preserve shared prefab materials and textures. Tests verify another enemy stays opaque.          |
| P1       | `hurt()` could award a second kill if invoked again on a defeated actor.                                | Guard dead actors before damage, score, drops or reinforcement logic.                                                                                         |
| P1       | A lethal hit could be followed by a health pickup and revive the player in the same update.             | Pickups require positive health; externally zero health starts defeat before further simulation.                                                              |
| P2       | Animation used requested movement rather than actual displacement.                                      | Gait phase follows distance after collision; no running in place at walls.                                                                                    |
| P2       | Dodge stopped when the movement key was released; diagonal normalization could weaken it.               | Capture a normalized dodge direction for the full active dodge window.                                                                                        |
| P2       | Switching weapons discarded rounds and implicitly reloaded the other weapon.                            | Separate persistent magazines; switching cancels reload progress and imposes a short equip delay without granting ammunition.                                 |
| P2       | Enemy steering could get stuck against cover and companion steering could overshoot short route steps.  | Reuse cover-aware routing for advancing infantry and clamp follower step distance to its waypoint.                                                            |
| P2       | Character feet remained at zero height on the raised river bridge.                                      | Apply the bridge support height to player, infantry and companion roots.                                                                                      |
| P2       | Rotor subparts spun around individual axes; the tank slid while pointing its entire hull at the player. | Authored rotor/turret pivots, independent vehicle presentation controller.                                                                                    |
| P2       | The first mouse click could fire toward a stale aim coordinate.                                         | Update pointer coordinates on pointer-down as well as pointer movement.                                                                                       |
| P2       | Save validation accepted `completed: true` for an unfinished mission index.                             | Reject impossible completed campaign state.                                                                                                                   |
| P2       | Pages workflow failed for private repositories on this GitHub plan.                                     | Retain build/tests on every push, run Pages only for public source, and publish this private game through Sites.                                              |

## Validation

- Blender 4.5.3 successfully regenerated the editable `.blend` scene and all 11 GLBs.
- Node regression suite: 12 tests, including articulated hierarchy validation, assets, collision, movement, routing, saves and upgrades.
- Browser suite: 9 tests, including joint poses at run/walk speed, stopping at cover, corpse opacity isolation, disposal/retry cleanup, delayed player defeat, bridge grounding, persistent magazines, touch/keyboard controls, all campaign endings and a full Story rescue using normal combat damage.
- `docs/animation-poses.png` visually inspected for idle, walk, run and fallen poses; gameplay and narrow-screen screenshots refreshed.
- Production TypeScript/Vite build and deployment are verified separately during release.

## Remaining limits

This is procedural articulated animation over Blender-authored rigid parts, not skinned animation, ragdoll physics, motion capture or exact foot IK. Falls are authored approximations, with bodies removed from collision immediately to preserve combat readability. Camera-scale limb motion is intentionally exaggerated. Physical phone performance and a broad cross-browser/human playtest remain unverified. No claims of those systems being complete are made.

## Software-rendered CI follow-up

The first cloud run exposed timing assumptions in browser tests: fixed keyboard/reload waits advanced too few simulation steps under slow software WebGL, and the three-mission test exhausted its time limit. Verification now waits for actual position/ammunition state, uses the existing low-graphics profile in CI, and allows a bounded longer cloud test timeout. Local visual checks retain full graphics. Geometry is also batched by material **within** each rigid joint, reducing draw calls without merging across animated limbs. The same pose, death-isolation, gameplay and campaign tests were rerun after this optimization.
