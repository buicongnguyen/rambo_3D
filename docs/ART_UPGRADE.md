# Blender art upgrade

## Delivered
- Rebuilt all eleven GLBs and the editable Blender gallery from `art/build_assets.py`.
- Rounded character limbs, reduced oversized head proportions, matte hair, facial accents, equipment straps/buckles, MOLLE webbing, radio, cargo pockets, boot laces and rifle details. Existing rigid animation joints are preserved.
- Tank tread shoes, wheel hubs, armor panels, fenders, engine grille, headlights, turret fittings and muzzle brake.
- Gunship doors/windows/frames, weapon pods and rocket tubes, cooling vents and tail details; barge railing, fenders, mullions and radar mast.
- Crate plank joints, rivets, handles and shipping label; tent seams and entrance folds; tower braces, ladder and deck seams; palm leaflets and trunk rings; irregular rock surfaces.
- Embedded deterministic 128px material textures with subtle grain/weave, separate metal/glass/fabric roughness, three-segment bevels and exported weighted normals.
- Reflection environment, less washed-out ambient lighting and a slightly closer gameplay camera. Material/geometry-compatible batching covers vehicles and props as well as animated joints.

## Scope and quality
This is a more detailed browser-game art pass, not a finished AAA asset set. Geometry remains procedurally authored and characters use rigid-part animation. AAA production quality would require sculpted anatomical meshes, retopology, authored UVs, baked normal/AO/roughness maps, skinned animation, bespoke environmental art and extensive art direction/LOD work. Those are still outstanding; procedural grain is not a substitute for authored wear and baked sculpt detail.

## Validation
All eleven GLBs retain the existing combined 5 MB budget. Node checks validate glTF structure and animation joints; browser checks cover gameplay, animation/death, textured asset rendering and batched draw calls. `docs/art-upgrade.png` is captured from the actual Three.js renderer, not an offline concept render. The Blender source is reproducible; `*.blend1` backups are excluded.

## Suggested next art milestone
Author one production-quality commando as a benchmark: sculpt and retopologize anatomy and clothing, atlas UVs, bake normal/AO maps, paint coherent fabric/skin/metal roughness, skin to a skeleton, and create animation clips. Validate it at gameplay distance on desktop and mobile before expanding the whole asset library. Preserve the existing collision footprints and combat readability when replacing silhouettes.

## Release status
Updated locally and pushed through the existing SSH repository. The currently hosted URL remains on its previous release; GitHub Pages still requires the outstanding public-source visibility decision.
