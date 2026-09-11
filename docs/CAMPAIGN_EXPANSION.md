# Campaign expansion

Implement seven stages (White Horizon, Cinderfall, Dune Lifeline, Canopy Hold, Citadel Dawn, Faultline Zero, Mire Crossing), three levels per stage, with 144-metre corridors instead of the previous 58-metre arenas. Relays sit toward the far end; extraction is beyond them.

Easy: 230 base health, normal soldier count. Normal: existing 150 base health and combat damage. Hard: 2x soldiers, two finale bosses. Crazy: 4x soldiers, four finale bosses. Normal/Easy finales have one boss. First two levels have relay reinforcements but no boss. All finale bosses must die before extraction opens.

Terrain: broad ice patches and momentum, snow trees; warned volcanic rockfalls harming either side; quarter-speed sand traps; destructible jungle tree trunks; city blocks and extra patrols; earthquake dust and 1–2-second ground-enemy freezes; muddy water holes with sinking and reduced speed. Terrain mechanics stay identical in Low and High graphics.

Assets: extend the reproducible Blender library with a snow pine, house, fuel container, articulated spider and laser tank. Keep destructible geometry separate from static terrain batching. Fuel blasts can chain and hurt both sides. Vehicle paths and navigation must use the same extended map limits as the player.

Tank fix: use swept movement against living infantry for run-over kills. Stationary contact must not damage enemies; cover still stops the tank. Score/death transitions must run exactly once.

Save/UI: 21 levels, per-level upgrades, stage selection, four difficulty buttons, stage/level HUD, multi-boss health and counts. Migrate old three-mission saves to the new campaign start while preserving the best score. Existing saves remain in browser storage until a new save is written.

Validation: pure rules for progression, difficulty ratios and rectangular bounds; browser tests for level gates, multi-boss completion, terrain effects, destructible chains, boss behavior, tank ramming and keyboard/touch controls; build and live deployment checks. Low detail reduces decoration and effects, not enemies or hazards. No physical-device frame-rate claim is made from software-renderer tests.
## Review and validation notes

The expanded terrain exposed a batching bug: indexed and non-indexed geometry shared a batch. The batch key now includes index presence. Spawn positions distribute across the full corridor, including the extra city soldiers. Ground-tank boss spawns use footprint clearance. Tank run-over damage uses swept movement and the existing single-award death handler.

Low graphics also stops drawing distant actors beyond 48 metres, outside normal infantry activation and assisted-aim ranges; their gameplay state remains active. Objects reappear when approached. Snow pines are included inside White Horizon as well as at the boundary. On-foot and vehicle ice momentum are preserved; mud recovery starts when leaving the water hole.

Checks cover actual 1×/2×/4× patrol creation, Crazy's four-boss extraction gate, all three boss behavior cycles, both-side rockfall damage, chain explosions, destruction removing cover, exact tank kill scoring, mobile multi-touch, Q/button switching, saved three-level progression, and an Easy level completed through movement and normal weapon damage. The Blender library contains 32 GLBs, approximately 6.7 MB; editable source is retained.
