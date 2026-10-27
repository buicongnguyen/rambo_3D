# Performance review — Rambo 3D

Reviewed locally on 2026-10-25 with `smooth-dense-scenes` from `C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md`. No commit, push, deployment, dependency upgrade, graphics reduction, simulation-rate change, or control change.

## Outcome

Retained selective instance-buffer uploads, reusable staging arrays, and removal of fully transparent explosion draws. Fixed a mobile sprite-capacity bug: growing a sheet mid-frame previously discarded the earlier actors' matrix/UV/fade slots for that frame.

**A pose-cache experiment was rejected.** It removed almost all stationary matrix calculations, but its bookkeeping increased measured CPU preparation time in this r180 architecture. The final code keeps the engine's existing transform path. The companion 2D review does retain useful transform-dependent bounds caching.

## Measurement method

- Installed Three.js **0.180.0**, Windows Chromium/ANGLE, NVIDIA RTX 4080 SUPER, D3D11.
- Desktop: 1280×800, DPR 1, High with existing shadow maps. Phone probes: 390×844, touch emulation, 4× CPU throttle, Low, actual rendering DPR 1; both 3D and default 2.5D.
- Fixed seed 98765, mission index 14, Crazy difficulty, camera by the enemy at 45% of the enemy list. Idle freezes simulation; combat advances fixed 1/60-second steps with movement and firing. The effect fixture ages 16 rocket bursts to 0.8 seconds so smoke remains.
- Eight warm-up steps, then **30 measured frames**. Raw WebGL draws include shadow passes. Matrix counters wrap `compose`/`multiplyMatrices`; transfer counters count bufferData separately from bufferSubData and handle WebGL2 source offsets/lengths.
- CPU sampling follows in a separate 90-frame window with matrix instrumentation removed and work counters disabled. GL wrapper forwarding remains identical in both arms. Heap is sampled after explicit GC. Geometry/instance arrays and renderer resource counts are recorded separately.
- Raw results: [docs/performance-review-data.json](docs/performance-review-data.json). Screenshots and CPU profiles remain in ignored `.tools/perf-before/` and `.tools/perf-kept/`. Measurements describe these fixtures, not every device or mission.

## Measured rendering work

Per frame; buffer figures are bufferSubData bytes (initial bufferData allocations are excluded here).

| Fixture | Raw draws before → after | Upload calls before → after | Upload bytes before → after |
|---|---:|---:|---:|
| Desktop idle | 500 → 500 | 179 → 0 | 600,576 → 0 |
| Phone Low 3D idle | 231 → 231 | 178 → 0 | 444,672 → 0 |
| Phone 2.5D idle | 73 → 73 | 71 → 0 | 202,240 → 0 |
| Desktop combat | 653.4 → 641.2 | 220.5 → 181.6 | 685,500 → 318,136 (**−53.6%**) |
| Phone 2.5D combat | 116.4 → 104.9 | 71.3 → 16.9 | 202,854 → 26,378 (**−87.0%**) |
| Desktop smoke tail | 708 → 548 | 179 → 0 | 600,576 → 0 |

The desktop idle main pass reports 236 draws; **264 additional shadow draws** account for the raw 500. Neither pass nor its geometry was reduced in the idle scene. Low has no shadow-map pass. Idle triangles remain 2,153,579 desktop / 547,311 phone 3D / 241,179 phone 2.5D per frame. This is still a demanding desktop scene; the changes do not promise that High will suit weak phones.

The 16 smoke-tail explosions save **160 invisible draws per frame** (708 → 548, −22.6%). Smoke, timing, spark counts, colour and additive blending remain intact. Transparent layers have no depth writes and are hidden only after opacity reaches zero. Reuse restores all layers for the next impact.

Dynamic bufferData counts/bytes during combat are unchanged: desktop 86 / 141,724 and phone 51 / 70,044 across the 30-frame sample. That first-use allocation work was not claimed as an upload improvement.

## CPU and matrix work

Final stationary matrix operations are unchanged: desktop 8,064 compositions / 8,559 multiplications per frame; phone 3D 3,684 / 3,911; phone 2.5D 961 / 629. Combat compositions are also unchanged. The only final multiplication reductions come from invisible effect layers no longer entering renderer work.

The rejected cache reduced desktop idle compositions 8,064 → 19 and multiplications 8,559 → 514, but that did **not** prove a speedup. Interleaved steady runs showed roughly 10–15% higher CPU duration in several fixtures. An additional preparation-only probe (renderer submission stubbed out in all arms) measured desktop combat at a median paired ratio of **1.23×**, against **0.97×** for unchanged-build controls. A staged-buffer variant still measured about 1.15× in that case. The cache was removed, including its per-object records and method overrides.

The final upload path stages actor matrices using the existing `Matrix4.toArray` hot path, compares contiguous Float32 values once per batch, and uploads one dirty span. Small sprite attributes use change-aware component writes. This avoids the rejected per-part generic-comparison overhead. Pending dirty spans survive skipped renders; a later update unions, rather than replaces, unconsumed ranges. Shrinking counts does not upload an unused tail. Weakly held staging arrays can be collected when their attributes are released.

Separate-run CPU work medians / p95 (milliseconds):

| Fixture | Before median / p95 | Final median / p95 |
|---|---:|---:|
| Desktop idle | 11.4 / 16.9 | 6.0 / 6.6 |
| Phone 3D idle | 25.5 / 35.2 | 15.2 / 19.7 |
| Phone 2.5D idle | 12.8 / 18.5 | 7.9 / 11.7 |
| Desktop combat | 21.1 / 28.6 | 13.9 / 18.8 |
| Phone 2.5D combat | 47.2 / 70.9 | 42.1 / 69.3 |
| Desktop smoke tail | 7.4 / 10.7 | 6.9 / 12.5 |

These separate-run timings are indicative, **not proven FPS improvements**. Shared-machine timing varied substantially between runs. Profile hotspots include actor grouping, world traversal, instance preparation, engine submission, and combat simulation. A native `(program)` sample is not a GPU timer. Phone combat p95 still exceeds a 60 Hz frame budget in this stress probe. No physical-phone GPU, battery, thermal or sustained-FPS result is claimed.

## Memory and lifetime

- Desktop idle JS heap: 69.585 → 69.630 MB; backing storage: 17.419 → 18.229 MB. Desktop combat: 73.072 → 73.162 MB heap, 17.640 → 18.671 MB backing storage. Values are decimal MB and include browser/test allocations.
- Explicit staging storage is bounded by live batch capacity: about 0.60 MB in desktop idle and 0.77 MB in this combat fixture. It replaces repeated CPU work with a modest retained-buffer cost; it does not allocate a new staging array each frame.
- Geometry/instance arrays remain 7,445,976 / 600,576 bytes in desktop idle, with 335 geometries, 34 textures and 27 programs. Repeated mission visits are checked for stable renderer resource counts.
- Renderer resource counts and JS/backing-store totals are **not exact VRAM usage**. Texture formats, driver allocation and transient render targets prevent deriving exact GPU memory from these counters.

## Correctness and visual checks

**Validation: production build passed; all 12 focused Playwright tests passed.** Vite retains its existing large-bundle warning.

The focused suite covers batch material/tint fidelity, joint animation, receiver changes, fades, actor removal, pool cleanup, repeated stage visits, 3D/2.5D switching, raw draw budgets, soldier falls and vehicle breakup. New checks cover unchanged Float32 writes, staged pending-range union, effect expiration/reuse, and first-frame sprite slots surviving capacity growth.

Fixed before/final captures: both phone idle variants are pixel-identical; desktop/phone combat differ by at most one colour level. Desktop idle has 3 of 1,024,000 pixels above a 24/255 threshold; smoke-tail has 16 (0.0016%). These tiny edge differences are recorded rather than described as bit-identical. Images were inspected for missing meshes, colours, smoke and actor poses. The unchanged-build desktop control differs in 23 pixels above the same threshold (max delta 85); the phone 2.5D control is identical. The final desktop differences are smaller than this cross-run control variation. Control deltas are included in the JSON.

## Reproduce locally

1. Run the original revision and this working tree on separate local Vite ports with identical assets. The original revision for this review was `bc15ae5`; the ignored reference copy contains its source plus the same measurement fixture.
2. `node scripts/performance-review.mjs http://127.0.0.1:4197/ .tools/performance`
3. `npm run build`
4. `npx playwright test tests/render-work.spec.ts tests/draw-budget.spec.ts tests/sprites.spec.ts tests/render-performance.spec.ts tests/bullet-storm.spec.ts --grep "selective staged|coloured|growing|real GPU|2.5D|drawing skips|render batches|infantry fall|rocket-killed"`

Keep hardware, viewport, renderer mode, seed and camera fixed. Run browser measurements sequentially. A next performance decision should use a physical low-end phone trace, especially for dense combat and GPU pixel/shadow costs, before changing art or animation budgets.
