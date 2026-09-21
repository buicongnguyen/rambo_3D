# Arcade combat and campaign review

Date: 2026-09-22. Reference: `C:\Users\n\source\repos\Tank_game_3D` (the installed Tank repository). Target: RAMBO 3D. Baseline: `e689e20`.

## Direction agreed with the player

Arcade action comes first: frequent fighting, plentiful ordinary ammunition, satisfying explosions and easy controls. Tactical play should earn a substantial advantage, without becoming compulsory stealth. Begin with short, clear missions. Hard and Crazy retain more enemies and offer less bonus ammunition. No energy timers, forced grinding or daily-reward pressure.

## What the comparison actually found

These are code and browser observations. The explanations of enjoyment are design hypotheses, not measured retention results.

| Area | RAMBO baseline | Tank reference | Implication |
| --- | --- | --- | --- |
| Opening size | 44 × 69 m; 12 soldiers on Normal, two response guards | Separate compact training exercises introduce movement, firing and equipment | RAMBO's first map is already compact. Improve clarity before shrinking it again. |
| Next operation | 136 × 136 m; 49 initial enemies; roughly 202 m O route | Encounters can activate with route progress and completion of the prior group | RAMBO increases area about 6.1× and enemy count about 4.1× at once. This is a more credible pacing problem than the first map's size. |
| First finale | 132 initial enemies on Normal before command response | Training and escalating encounters precede mixed objectives | Growth comes too early for a player still learning vehicles and special weapons. |
| Purpose | Relay → response guards → extraction repeated; generic success message | First Light establishes a convoy signal, later missions use capture, escort, defense and command battles | More scenery alone cannot create different reasons to play. Mission outcomes should explain what the next operation achieves. |
| Enemies | Infantry share a model and largely similar stop/strafe/fire behavior; existing sight cones and remembered positions already support flanking | Riflemen, rocketeers, sentries, raiders and vehicles differ in range, movement and burst cadence | Prioritize readable roles and decisions before adding more bodies or health. |
| Bullets and impacts | Compact warm tracers; most impacts had similar rings; explosion smoke lasted 1.15 s | Sharp contact flashes, surface-specific debris, larger rolling clouds and longer smoke | Keep infantry rounds compact. Separate the visual vocabulary of bullets, masonry and blasts. |
| Effects under pressure | Browser reproduction: one blast followed by dense contact effects lost the blast from the pool | Larger layered effect system | This was an actual defect, not merely a taste difference. Important effects need priority. |
| Loot | One-third drop chance, but an ammo package refilled every owned special weapon simultaneously | Limited special-ammunition systems | Keep the drop probability, make the package reward understandable, and avoid multiplying its value by inventory size. |
| UI | Working thumb controls, but a very long field manual; many systems explained before first combat | Explicit short training steps | Preserve the improved mobile pad. Show essentials first and disclose advanced controls on demand. |
| Destruction | Trees and explosive stores could break; most houses remained solid boxes | Readable hit surfaces and layered destruction | A roofless wall compound can create a meaningful shortcut instead of cosmetic damage. |

The reference game's tank rounds are larger than infantry bullets. Copying their size directly would contradict the requested smaller RAMBO rounds and make a crowded infantry battle harder to read. The useful lesson is timing, silhouette, contrast and feedback—not literal dimensions.

## Lessons from comparable commercial games

1. **Variety and clear reactions.** Ubisoft's [The Division 2 AI discussion](https://news.ubisoft.com/en-us/article/5wu3eterDz21wNKiAcDJlJ/the-division-2-making-enemies-tougher-and-friendlies-smarter) describes enemy archetypes, pronounced hit reactions, armor feedback and weak points. Apply this by making tactical successes legible and giving different enemies different jobs. Simply doubling every soldier's health is a poor substitute.
2. **Intensity needs rhythm.** Valve's [Left 4 Dead AI presentation](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf), especially the pacing section, describes peaks and recovery periods. For this arcade game, test short 3–6 second movement/reward transitions between fights; do not copy Left 4 Dead's much longer recovery timings or silently alter the chosen difficulty.
3. **Destruction changes decisions.** Remedy's [Control announcement](https://legacy.controlgame.com/takecontrol-remedy-entertainment-unveils-its-next-game/) presents dynamic destruction as part of its changing combat environment. A broken RAMBO wall should change collision and sight lines, not leave an invisible blocker.
4. **A welcoming difficulty is intentional design.** Rebellion's [Sniper Elite 5 accessibility discussion](https://news.xbox.com/en-us/2022/05/18/scoping-out-the-accessibility-features-of-sniper-elite-5/) explains an approachable Civilian setting and tutorial support. Offer understandable help and an easier choice without removing player control or resetting existing preferences.
5. **Assistance can coexist with challenge.** The [Last of Us Part I accessibility overview](https://blog.playstation.com/2022/08/26/the-last-of-us-part-i-full-list-of-accessibility-features/) documents assistance and difficulty options. Keep RAMBO's assisted FIRE, manual mouse aim and explicit difficulty selection available together.

These references supply design principles, not proof that a particular change will improve this game's retention. A browser game also has a different camera, scope and hardware budget from an AAA production.

## Implemented first pass

### Campaign and opening

- Preserve the compact opening, its 12 initial enemies, automatic relay capture and two response guards.
- Reduce mission two from 49 to **25** initial enemies on Normal (24 infantry, one tank).
- Reduce the first finale from 132 to **66** initial enemies on Normal (64 infantry, two tanks). Difficulty multipliers and later-biome densities remain explicit and unchanged.
- Preserve longer route shapes for higher levels. The second map is still much larger; this pass reduces pressure but does not pretend to solve every travel-time issue.
- Add 21 distinct objective labels and outcome messages, linked by Vale's evacuation narrative. The player restores communications, obtains route codes and breaks successive blockades. These describe the existing relay gameplay; physical escort/rescue missions are future work.
- Shorten the first briefing and show one contextual opening hint in the existing notification slot. Combat feedback takes priority. Controls remain usable throughout.

### Combat and tactical rewards

| System | Implemented rule | Reason |
| --- | --- | --- |
| Rifle / shotgun reserves | Existing unlimited reload reserves preserved on every difficulty | Maintain the basic arcade loop and avoid an unwinnable empty loadout. |
| Enemy loot | Independent 1/3 chance; one health, shield or ammo package; 45 s expiry and 48-package cap | Rewards remain occasional and bounded. |
| Ammo package | Refill one owned finite-ammo weapon: selected eligible weapon first, otherwise least stocked by magazine fraction | A package has one understandable effect. Never discard it when nothing can receive ammunition. |
| Easy / Normal ammo | One full magazine, within the existing four-magazine reserve cap | Keep ordinary play generous. |
| Hard / Crazy ammo | 20% / 10% of a magazine, rounded up; minimum one round | Special equipment is more valuable on demanding modes. A one-round grenade or rocket magazine still receives one round. |
| Rear-hit finish | Existing damage advantage plus +50 score and up to +5 shield | Clever positioning gives an immediate combat benefit. |
| Explosive chain | +75 score per additional enemy; +5 shield per additional enemy, capped at +15 per chain | Encourage fuel-depot tactics without demanding them. Nested detonations award once. |

Shield still caps at 80. Bosses retain their existing exclusion from rear-hit bonuses. Tactical score is extra score, not an undisclosed currency or upgrade system. Existing machine-gun rate, belt size and reload timing remain in place; assess this progression before another broad damage rebalance.

### Effects and destructible cover

- Blast effects survive replacement by minor bullet contacts; new blasts replace contacts first.
- Explosion smoke persists for 2.4 seconds, with slower expansion. Ordinary bullet hits lose the large ground ring; flashes and warm sparks stay compact.
- Effects remain bounded at 12 active bursts in Low and 28 in High. The next emitted effect enforces the Low cap after a graphics-quality change. No new per-impact lights.
- Blender-authored `ruinWall.glb` has beveled masonry, exposed patches, reinforcement and an uneven top; its source generator and `.blend` are committed for reproducibility. Reusing brick geometry reduces the GLB to about 35 KB; the total model library stays below the existing 9.5 MB limit.
- Two opening cover screens become breakable masonry. Four existing buildings per city map become roofless compounds assembled from separate wall sections, opposing 2.2 m doorways and an offset divider.
- The compounds fit inside the replaced building footprints. Main roads, supply lanes, relay houses and concrete map boundaries remain available. Infantry can traverse the intact rooms; vehicles keep their exterior routes.
- Each section has 112 health: four base-rifle hits. Destroying it removes the renderer object and collision, emits stone dust and bounded debris, and opens a real firing lane. Explosive stores can damage the wall facing them, while that wall protects objects behind it for that blast.

### UI

The quick-start manual presents movement, assisted/manual fire, weapon swap and the relay goal. Three expandable sections contain tactics, advanced controls, and difficulty/campaign information. The seven mobile actions remain where the working thumb layout places them. SWAP uses an opaque dark background so its label remains readable on snow. No additional permanent status panel has been added. Easy is recommended to new players; saved difficulty preferences remain respected.

## Next phases, in order

### 1. Measure the opening before expanding content

Run voluntary playtests with at least five new players, including real Android and iPhone devices. Observe time to first movement/shot, first useful cover, relay discovery, first death, successful extraction and understanding of SWAP/BLAST. Record hardware and graphics mode. Ask whether a retry feels inviting; do not infer enjoyment from raw session length.

Suggested initial targets, to validate rather than advertise: a first meaningful fight within 10–20 seconds; first mission completed in about 2–4 minutes; most first-time Easy players finish within two attempts. Count confusion and missed controls separately from aiming difficulty. No analytics or personal tracking is introduced by this patch.

### 2. Add actual objective variety

Author a short radio rescue with a visible survivor, a moving convoy escort and a 30–45 second defense encounter. Each needs its own fail/retry conditions, pathfinding tests and friendly collision rules. Preserve the current relay operation as the introductory mission. Add a compact second-level route variant only if playtests still show excessive empty travel; place its vehicles and supplies deliberately.

### 3. Differentiate enemies

Introduce a flanker with a light kit, a stationary suppressor with a clear reload window, and a slow rocketeer with a distinct silhouette and warning. Teach each alone before combining roles. Keep low-difficulty warnings generous. Navigation must honor destroyed walls and never place incoming soldiers in view without a doorway or map entry.

### 4. Improve feedback without excessive noise

Evaluate short directional hit flashes, material-specific sounds and a stronger bass layer for fuel blasts. Preserve reduced-motion settings and avoid mandatory camera shake. Prioritize player threats, pickups and enemy tells over smoke. Test overlapping explosions against snow and dark jungle, with both graphics modes. Avoid indefinite decals or unbounded particles.

### 5. Build replay value around mastery

Display a compact mission result with clear completion, optional tactical achievements and one meaningful upgrade choice. Let players retry or advance immediately. Replay goals should reward accuracy, routes and smart explosives rather than mandatory grinding. First assess completion and voluntary replay; a retention claim requires actual player data.

## Verification and limits

Automated coverage includes ammunition selection/caps, intact compound traversal, story outcome uniqueness, effect priority/expiry/quality downshift, real projectile wall breaching, one-time tactical rewards, mobile help and existing controls/collision/relay tests. The normal deployment pipeline gates GitHub Pages on unit, build and browser suites.

Desktop browser checks and emulated touch layouts do not establish real-phone FPS, battery use or improved enjoyment. Human playtesting and native phone performance measurements remain necessary. This is a focused gameplay improvement pass, not a claim that the asset library or campaign has reached AAA production quality.

Local release checks: production build and all 48 unit tests passed; 26 relevant browser scenarios passed across the focused runs after correcting a test-fixture alias. Visual inspection confirmed all three city levels receive their compounds, and a fuel blast destroys a facing wall while that wall shields an enemy behind it for the same blast. The full 86-scenario browser suite runs in the deployment workflow before publishing.
