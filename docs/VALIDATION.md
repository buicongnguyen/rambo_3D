# Release validation — Operation Nightfall 1.0

Validated on Windows in the requested separate checkout, 2026-09-11.

## Completed checks

- Blender 4.5.3 LTS ran in background mode with `--python-exit-code 1`. Exported 11 glTF 2.0 binary assets and saved editable `art/nightfall.blend` (1,263,440 bytes).
- Combined GLB payload: 288,704 bytes (approximately 282 KiB). Models are original generated mesh assets, not remote runtime placeholders.
- `npm test`: **10 passed**, covering binary assets, swept cover/actor collision, dash wall tunneling, world boundaries, invalid saves, campaign upgrades/completion, and cover-aware follower routing.
- `npm run build`: TypeScript and Vite production build passed. Application around 87 KB, three.js chunk around 534 KB uncompressed / 135 KB gzip, stylesheet around 17 KB. Vite's >500 KB library chunk advisory is expected; three.js is isolated in its own reusable chunk.
- `npm run test:e2e`: **4 passed** in Chromium. Actual GLBs and WebGL rendering; movement, shooting, reload, pause/frozen simulation, defeat/retry, all three objective/boss/extraction transitions, upgrade persistence, and touch input release.
- Full Story-mode rescue route completed through simulated movement, interaction and **ordinary weapon damage**, with the companion required at extraction. Approximately 20.9 simulated seconds, 11 kills, 196.85 remaining health. This is an optimized automated route, not a human completion-time or difficulty claim.
- Desktop at 1440×900 and touch viewport at 390×844 inspected visually. No horizontal document overflow at the touch viewport. Screenshots are committed here.
- Static scenery merged by material to reduce prop draw calls. Pixel ratio capped at 1.6; low mode caps at 1 and disables shadows.
- Runtime test access is guarded by `import.meta.env.DEV` and stripped from production.
- Original 2D checkout is not modified by this implementation.

## Limits of verification and scope

- No physical Android/iOS performance certification, gamepad test, broad browser matrix, or human usability/difficulty study.
- Campaign-transition tests deliberately inject a lethal projectile to verify boss death and extraction. The separate Story route uses normal combat. Neither is a human playtest.
- Compact first playable solo campaign. Co-op, drivable vehicles, Android packaging, rigged animation and larger authored maps remain roadmap work.
- Decorative vegetation/rocks are visual scenery; crates, tents and tower footprints form collision cover. Maps share a combat-layout skeleton with different objective positions, bosses, palette and terrain rules.
- Blender-authored meshes use procedural bobbing rather than skeletal running clips. Audio is synthesized effects rather than a scored soundtrack.
- WebGL 2 required. Google Fonts is optional, with system-font fallbacks.
- Local storage saves completed mission/upgrade progress, not live battlefield checkpoints.

## Evidence

- `briefing-desktop.png`, `gameplay-desktop.png`
- `briefing-mobile.png`, `gameplay-mobile.png`
- `tests/rules.test.mjs`, `tests/assets.test.mjs`, `tests/game.spec.ts`
- `.github/workflows/deploy.yml` repeats clean install, tests, build and browser tests before deployment.

## Publishing target

Repository: https://github.com/buicongnguyen/rambo_3D

SSH remote: `git@github.com:buicongnguyen/rambo_3D.git`

Pages target: https://buicongnguyen.github.io/rambo_3D/

A configured target URL is not deployment evidence. Deployment success will be checked against GitHub after the authorized push.
