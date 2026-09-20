# Stable camera and player identity

Tank_game_3D/src/three/world.ts smooths one target with elapsed-time exponential easing, then derives both camera position and aim from it. RAMBO previously eased camera position by a fixed 0.09 per rendered frame while aiming immediately at the raw player position. This changed pitch/yaw during movement and made response depend on rendering frequency. Normal scene redraw is not itself the cause.

RAMBO now uses one ground-plane anchor for position and aim, keeping a constant gameplay angle. A radial-axis dead zone keeps the view stationary for small movements: 3.5 world units vertically along the ground and 1.8–4.5 horizontally depending on aspect ratio. Outside it, exponential easing moves only the excess distance. The camera ignores animation/sinking height. Mission start resets the anchor, and lighting follows the same anchor. No terrain regeneration is introduced.

A reusable cyan ring with a dark outline marks the player, including occupied vehicles. It uses two small meshes outside the actor batching system, does not pulse, is visible against bright and dark terrain, and hides in the menu or after death. It does not change enemy materials or collision.

Validation: 42 unit tests, including dead-zone stability/no overshoot and equal smoothing at 30/144 Hz; browser checks for stationary small movement, fixed camera orientation during follow, marker tracking/death lifecycle and mission reset, plus existing mobile multitouch and desktop switching checks. This corrects camera-induced wobble; it is not a guarantee against frame drops on every device.
