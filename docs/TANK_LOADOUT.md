# Tank loadout and vehicle run-over update

## Behavior

- Moving jeeps and tanks kill infantry on contact. The sweep from the previous position to the actual new position catches contacts between frames. The normal death path awards one kill, plays the fall and fades the body over four seconds.
- Actual displacement is required. Stationary vehicles, blocked movement and motorcycles do not cause run-over kills. A cover intersection check protects soldiers behind walls. Command bosses survive vehicle contact.
- Each tank starts with six ready explosive cannon rounds. The existing armored projectile, smoke trail, blast and cover collision are retained.
- Q on PC and SWAP WEAPON on mobile cycle cannon, then the collected personal inventory, then cannon again. Collecting a weapon while driving the tank equips it immediately. All eleven weapon behaviors remain available from the tank.
- The personal magazine/reserve bank is separate from the six-shell vehicle bank. Swapping cancels reloading without granting rounds. Exiting and reboarding preserve ammunition and tank firing mode. Cannon shells cannot be replenished with RELOAD; trying to fire an empty cannon switches to the last selected personal weapon.
- The HUD identifies CANNON / SHELLS or the equipped personal weapon and its magazine/reserve. When a personal weapon is selected, it also shows the remaining cannon shells. The jeep retains its twenty-shot mounted shotgun.

## Review

The previous jeep path had no infantry contact damage. The tank's mounted firing path always selected its fixed missile weapon and disabled weapon switching, even though pickups were collected. The update gives gameplay and HUD a shared active-weapon decision, including assisted-aim range. Both vehicle and player cooldowns are honored to prevent rapid switching or dismounting from bypassing fire cadence. No new per-frame assets or physics simulation are introduced; cover checks occur only for possible infantry contacts while the jeep or tank actually moves.

## Validation

Five new browser regression tests cover moving/stationary contact, multiple infantry, boss immunity, wall protection, death fading and single scoring; cannon ammunition persistence and exhaustion; all eleven weapons and finite personal reload reserves; PC keyboard/button controls; and mobile portrait/landscape controls with usable touch targets. Tests use controlled arena fixtures for isolated collision checks; the existing campaign test also exercises tank run-over in a generated stage.

The production build, all 24 Node logic tests and all 44 browser tests passed. The five new focused tests also passed independently. Desktop and mobile portrait/landscape tank HUD screenshots were visually reviewed. GitHub Actions reruns the tests and build before publishing to GitHub Pages.
