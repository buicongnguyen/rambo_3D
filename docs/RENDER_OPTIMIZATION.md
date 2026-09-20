# Rendering performance review

The dense Dune Lifeline finale on Crazy contains 528 enemies and roughly 27,000 scene nodes. Actor meshes were already instanced, but Three.js still recomputed the hidden source hierarchies on every render. Visible rigs were updated twice: by the batcher and by the renderer. Batching also recreated grouping arrays and geometry/material key strings every frame.

Changes:
- Update visible dynamic objects explicitly; the actor batcher updates only visible source rigs. Skip the redundant automatic scene traversal for the render call, restoring the renderer's default afterward with try/finally.
- Update baked static terrain transforms once at construction.
- Reuse instance grouping arrays and cache unchanged mesh/material keys. Recompute fading-material keys, release source references every frame, and clear caches on mission rebuild.

Visual quality, enemy count, simulation, collision, shadows and terrain geometry are preserved. A spatial terrain batching experiment was rejected because it raised draw calls without a consistent win on the tested scenes.

## Measured results

| Scene | Setting | Before render call | After render call |
|---|---|---:|---:|
| Opening, 12 enemies | Low / portrait | 0.49 ms | 0.43 ms |
| Opening, 12 enemies | High / desktop | 0.73 ms | 0.69 ms |
| Dense finale, 528 enemies | Low / portrait | 6.08 ms | 2.37 ms |
| Dense finale, 528 enemies | High / desktop | 11.60 ms | 6.21 ms |

The dense scene's CPU-side rendering submission fell about 61% in Low and 46% in High. Simulation time remained around 2–3 ms in this sample. The small opening scene benefits much less, as expected. Measurements use Chromium SwiftShader on this machine, 45 fixed simulation/render steps with the first 10 excluded, and seeded randomness. Draw counts vary slightly between runs; these are indicative measurements, not hardware GPU timings, stable phone FPS claims, or a guarantee that every device is smooth. The benchmark excludes DOM/HUD updates and full frame pacing. Raw data is in RENDER_OPTIMIZATION_MEASUREMENTS.json.

High detail still draws shadows and a larger framebuffer. Dense visible crowds still contain over a million triangles, so weaker GPUs can remain constrained; the existing Low preset disables shadows and caps pixel count. No automatic visual downgrade is introduced.

## Reproduce

Run `npm run dev -- --port 5198`, then `node tools/profile-render.mjs docs/render-profile-local.json`. Close other test browsers while measuring. Use `GAME_URL` to point at another development server. Compare the same stage, difficulty, viewport and graphics preset.

Regression checks cover skipped off-screen transform updates, current visible player/vehicle world matrices, retained terrain, Low/High switching, fading bodies without duplicate drawing, and boarding/driving/firing/exiting all three vehicles. Full CI gates publication.
