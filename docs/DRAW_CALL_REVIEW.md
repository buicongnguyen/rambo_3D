# Shadow-aware rendering review — 2026-10-25

This applies Claude's **smooth-dense-scenes** skill, found at
`C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md`. That skill records the
Starline / Hoshi Valley work in the sibling `3D_game_scene` project. Its useful
method is now reproducible in this repository without needing the personal skill
installation: measure actual GPU draws, attribute the expensive parts, preserve
the picture, and check resource lifetime after rebuilding scenes.

## Findings and changes

Three.js's `renderer.info.render.calls` shows the main pass here, after the shadow
pass has reset its counters. In the fixed dense-city reference it reported 293,
while WebGL actually submitted 654 draws. Existing 1,500–2,000 draw ceilings could
miss this cost.

- Five uniform colours split the same Blender body geometry into five batches.
  Colour-only variants now share a white material with per-instance linear RGB.
  Textures, roughness, metalness, joint transforms, role colours and shadows stay
  intact. Only variants explicitly created by `batchColorVariant` qualify; other
  materials and corpse opacity buckets remain separate.
- Repeated supply crates, badges and ammo cans now use the existing actor batches.
  Their root transforms, pickup logic and weapon models remain in place. Shadow
  casting and shadow receiving flags are part of the batch key.
- Mobile sprite growth disposed the old quad geometry but missed the separate
  instance buffer. It now disposes the replaced `InstancedMesh` too. Shared sheet
  materials and textures survive growth.
- Shared uniform batch materials survive mission rebuilds; individual instance
  buffers and temporary fade materials are released when their batches clear.

## Measurements

Frozen Crazy missions, fixed supply seed 98765, one browser at a time. Desktop is
1280×800 High 3D; phone is 390×844 Low, with 3D and the default 2.5D measured
separately. Counts include shadow draws. See `draw-call-review.json` for triangles,
geometry memory, renderer identity and visual-difference counts.

| Scene                      | Before | After | Fewer draws |
| -------------------------- | -----: | ----: | ----------: |
| Opening, High 3D           |    370 |   318 |       14.1% |
| Dense jungle, High 3D      |    620 |   441 |       28.9% |
| Dense city, High 3D        |    654 |   500 |       23.5% |
| Dense city, phone Low 3D   |    284 |   231 |       18.7% |
| Dense city, phone Low 2.5D |     82 |    73 |       11.0% |

Referenced geometry array bytes did not increase (this count excludes instance
buffers, textures and driver overhead). Phone triangles increased by only 276
(about 0.05% in 3D): a root-level batch can include a tiny part whose individual
bounds were previously just outside the view. Desktop triangles decreased as
out-of-view supply roots stopped submitting shadow geometry.

Two same-build captures after identical rebuilds had no pixels differing by more
than 2 channel values. Before/after differences above that threshold affected
0.0006–0.1194% of the image, at mesh/raster edges; inspection found no lost
models, material finishes or visible shadow regions. A separate unchanged-build
control showed 1,154 varying pixels at snow-tree band edges (versus 1,223 in the
opening before/after comparison), and two jungle edge pixels. These cross-load
raster differences are not evidence of an optimization regression. This is not a
bit-identical render promise. The audit also found stable geometry/texture/program counts after
rebuilding each scene.

These are repeatable rendering-work reductions, **not measured FPS gains on a
physical phone**. CPU throttling on a desktop GPU cannot represent mobile GPU,
thermal or battery limits. The remaining High city geometry (~2.15 million
triangles including shadows) can still be expensive on weaker GPUs. A subsequent
review could investigate spatial terrain batches and shadow range, with visual
comparisons before changing either.

## Reuse the review

1. Install dependencies and browser: `npm ci`, then
   `npx playwright install chromium`.
2. Start a fresh dev server: `npm run dev -- --port 4197 --strictPort`.
3. In another terminal run
   `npm run review:render -- http://127.0.0.1:4197/ .tools/render-review`.
4. Inspect `results.json` and the two canvas PNGs for each scene. Use separate
   output directories before and after a change. Compare repeated unchanged
   captures first; then compare the change. The dev-only game hook is required.
5. Run `npx playwright test tests/draw-budget.spec.ts` for actual-draw ceilings,
   A → B → A resource checks, colour/finish/animation/fade preservation and sprite
   buffer disposal. The existing combat, pickup, art and mobile tests still apply.

The audit freezes simulation and disables camera shake/wind for reproducible
images; gameplay settings and performance preferences are untouched. Its raw
WebGL wrapper lives only in `scripts/render-probe.mjs`, never the shipped game.
For actual timing claims, follow the source skill: profile steady active combat,
confirm hardware rendering, interleave before/after runs and include an unchanged
null control. Do not turn one noisy frame-time sample into a claimed speedup.

## Validation

Production build and 85 logic tests passed. Twenty-nine distinct targeted browser
checks passed across rendering, art, infantry behavior, death effects, mobile
sprites, quality switching and on-foot/vehicle pickups. The new late-colour
registration test caught a batch-key collision; the fix gives tinted and ordinary
materials distinct keys, and the complete new draw-budget suite passed afterward.
