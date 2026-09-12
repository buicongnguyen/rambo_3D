# Playable vehicles and the 2D weapon library

## Source comparison

Reviewed the original 2D BattleScene weapon definitions, vehicle specs, driving, mounted weapon fire, ammunition fallback and death handling. Previously 3D had two player weapons and boss vehicles only. This release adds playable transport and the eleven weapon types, with world-scale balancing rather than copying pixel-based constants.

## Player controls

- Move near a blue minimap dot and press E / tap BOARD to enter. Direction controls steer and accelerate; release them to brake. E / EXIT searches for an unobstructed dismount position.
- Motorcycle: fastest, light armor; fires the player's selected weapon. Reload and weapon switching remain usable on the bike.
- Jeep: medium speed and armor; mounted shotgun with twenty shots. Drive over infantry to kill them.
- Tank: slow, heavy armor; independently aimed turret with six ready explosive cannon shells. Q / SWAP WEAPON cycles cannon → collected personal weapons → cannon. Driving over infantry kills them; bosses resist run-over damage. Stopped vehicles and contact through cover cannot kill infantry. Normal scoring, falling and fading apply.
- HUD shows vehicle armor and mounted ammunition. Vehicle ammunition persists across exits. Enemy fire damages the vehicle before the player; destruction ejects the player with brief protection and a damage penalty, while the wreck settles and fades.
- Solid cover, other vehicles, and world bounds stop driving. River vehicles must use the bridge. Objectives/extraction require dismounting. Rescued Mara travels with the player and resumes following after exit.
- Purple minimap dots are weapon pickups. Walk or drive over them, then Q / WEAPON cycles collected weapons. Riding collection uses the vehicle footprint plus a short reach, and solid cover blocks collection. Pickups automatically select the strongest usable weapon, including the tank cannon. Tanks can fire/reload personal weapons while mounted. Cannon shells and personal magazines/reserves are independent, persist across swaps/exits, and switching cancels reloading without granting ammunition. Shells cannot be reloaded; firing an empty cannon selects a personal weapon. Collected weapons remain available after dismounting; collection does not refill mounted ammunition. Special weapons have finite reserve ammunition. Exhaustion automatically selects the strongest usable weapon; rifle and shotgun retain the prototype's unlimited reserve.

## Weapon behavior

| Weapon                | 3D behavior and visual                                      |
| --------------------- | ----------------------------------------------------------- |
| Rifle                 | Automatic tracer fire and recoil                            |
| Shotgun               | Short-range pellet spread                                   |
| Machine gun           | Fast sustained fire, large magazine                         |
| Sniper                | Long tracer; can pierce up to four actors, stopped by cover |
| Flamethrower          | Short-range expanding flame particles                       |
| Grenade launcher      | Arcing projectile and blast                                 |
| Explosive bow         | Blender arrow with explosive impact                         |
| Missile               | Blender rocket, smoke trail and blast                       |
| Laser                 | Brief beam; damages actors along the beam, stopped by cover |
| Fragmentation grenade | Short thrown arc and area damage                            |
| Gas grenade           | Thrown projectile and four-second lingering damage cloud    |

All weapons have separate Blender hand models attached to the existing animated grip, including the mounted tank rider. Projectiles use swept collision; explosions respect cover. Gas and transient effects clean up on expiry/restart.

## Review fixes

Vehicle collisions now participate in follower/enemy navigation. Reinforcement spawns search for a clear position. Parked vehicles intercept enemy projectiles. Safe exit checks cover, bounds and other vehicles. Vehicle destruction preserves emergency protection. A campaign test caught exhausted special weapons leaving the player unable to fire; automatic usable-weapon fallback fixes that without changing difficulty.

## Validation and boundaries

Automated tests cover all three vehicle types, moving wheels, mounted fire, armor, dismounting, destruction, water boundaries, restart, all eleven weapon pickups and damage, finite reload reserves, empty-weapon fallback and laser cover blocking. Existing mobile and campaign tests remain part of validation. The rescue simulation finishes with normal weapon damage. docs/vehicles-weapons.png is an in-engine visual inspection image.

This is arcade vehicle handling, not a suspension/rigid-body simulator. Unlike 2D, jeep fire is player-triggered and tank shells fire individually, making the mobile FIRE control predictable. Run-over damage uses swept infantry contact with a cover check. Fuel drums and trees are destructible; hills remain permanent. Missile homing and multiplayer passenger seats are not implemented. Mara follows the transport state without an additional visible passenger mesh. Models remain browser-oriented, not AAA production assets. Hardware-phone frame-rate profiling remains outstanding.

Green supplies heal the player and repair the occupied vehicle by up to 30 each. They remain available when both are full. Regression coverage checks nearby weapon and supply collection on all three rides, full-health retention, repairs, inventory and mounted ammo preservation.
