# 2D / 3D gameplay logic review

## Reference and scope
Compared the original `rambo_game/src/game/scenes/BattleScene.ts` enemy update, obstacle physics, line-of-sight, damage and death handling with the new 3D `src/game.ts` and `src/rules.mjs`. The original 2D checkout is unchanged. This is a source review plus automated 3D simulation, not a claim that every 2D mechanic has been ported or that either game has no bugs.

## Findings fixed

| Finding | Change |
| --- | --- |
| 3D pursuers stopped within seven meters even behind solid cover; every third rifleman never pursued at all. | All riflemen navigate around cover when their shot is obstructed, including nearby targets. |
| Rounded A* start nodes could land inside expanded cover. First path edges were not checked from the actor's actual position. | Connect fractional positions to reachable grid nodes and validate every swept edge. Clearance matches circular movement, including rounded corners. |
| Following a tiny waypoint at constant speed caused overshoot; a failed route became southward movement via atan2(0,0). | Clamp displacement to waypoint distance, smooth visible waypoints, and hold when no route exists. Bound repathing to once per 0.4 seconds. |
| The 2D game keeps distance and strafes; 3D infantry only advanced or stood still. | Two preferred engagement distances, close-range retreat, phased lateral motion, and local spacing between living riflemen. |
| A warning ring could advertise a shot through cover, followed by an immediate shot when sight returned. | Obstructed enemies preserve at least 0.6 seconds of windup; warning rings require clear sight and track ground height/current position. |
| Shot direction was calculated before enemy movement. | Recalculate aim from the actual firing position. |

The 2D reference intentionally stands still without line of sight. The 3D game instead routes around cover, appropriate to its open arena and rescue follower. Existing swept projectile collision, dodge substeps, death removal from combat, magazine persistence and campaign gates remain in place.

## Verification

14 Node tests cover collision, save progression, assets and navigation. New fractional-position corner simulations reproduce the original stuck case and verify arrival using real circle movement; blocked destinations and cover-hugging targets are covered. Ten browser tests cover locomotion, death, input, campaign progression, rescue with normal weapon damage, and the new close-cover pursuit/retreat/spacing/windup behavior. Production TypeScript/Vite build passes. Automated scenario checks do not replace prolonged human difficulty testing.

## Deliberate remaining differences

The 2D game still has a broader arsenal, mounted enemies, destructible cover and rewards, enemy classes, encounters and environmental projectile effects. These are expansion work, not silently enabled in this patch. Recommended next additions: authored encounter waves, distinct scout/heavy silhouettes and attacks, then destructible crates with synchronized rendering/collision/rewards. Decorative scenery remains distinct from the authored solid cover list. Bosses retain authored patrol tracks rather than general vehicle navigation.

## Deployment

Changes are prepared for the existing SSH repository workflow. GitHub Pages remains gated by the unanswered public-source visibility decision; this review does not authorize changing repository visibility. The current hosted release is not updated by a private-repository CI push alone.
