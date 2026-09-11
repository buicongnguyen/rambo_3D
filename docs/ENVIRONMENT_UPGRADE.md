# Environment and combat presentation pass

Implemented textured soil/road shading with shared procedural surface maps, road tire ruts, tapered grass clusters with rooted wind animation, water normal animation and reflection response. Grass avoids roads, authored cover and the river. The existing gameplay ground heights and collision footprints remain unchanged.

Combat gains muzzle flashes, ballistic impact particles with gravity, and fading smoke after explosions. Effects reuse geometry, own disposable materials, expire within their lifetime and are cleared on mission restart. Reduced-motion mode freezes environmental animation. These changes extend the Blender asset pass; they do not claim AAA production quality or replace the outstanding sculpted/skinned character and vehicle-animation work described in ART_UPGRADE.md.

Validation: production build, Node collision/asset/progression tests, browser gameplay and animation tests, plus a river shader/effect-cleanup check. The in-engine screenshot is docs/environment-upgrade.png. Performance is guarded through batching and shared maps; representative-device frame-rate profiling remains outstanding.
