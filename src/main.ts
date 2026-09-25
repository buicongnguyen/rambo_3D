import { buyFieldKit, buySupply, fieldKitCost, SUPPLIES } from "./economy.mjs";
import {
  STAR_BONUS,
  missionGrade,
  missionPar,
  recordStars,
  rewardBreakdown,
} from "./debrief.mjs";
import { routeLength } from "./routes.mjs";
import { WEAPONS } from "./arsenal";
import { FeedbackUI } from "./feedback-ui";
import { GameAudio } from "./audio";
import { themeFor } from "./music.mjs";
import { guidePoint } from "./guidance.mjs";
import { InteractionHint } from "./environment.mjs";
import {
  STAGES,
  LEVEL_COUNT,
  difficultyConfig,
  WORLD_BOUNDS,
} from "./campaign.mjs";
import * as T from "three";
import "./style.css";
import { World, loadAssets, model } from "./world";
import { Game, type Input } from "./game";
import { MISSIONS, COVER } from "./missions";
import { freshSave, validateSave, advanceCampaign } from "./rules.mjs";
const $ = <E extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<E>(s)!;
function read(key: string, fallback: unknown) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
let save = validateSave(read("nightfall-campaign", freshSave()));
const rawPrefs = read("nightfall-prefs", {}) as Record<string, unknown>;
const prefs = {
  sound: rawPrefs.sound !== false,
  // Music stingers follow an older "sound off" preference until set on their own.
  music:
    typeof rawPrefs.music === "boolean"
      ? rawPrefs.music
      : rawPrefs.sound !== false,
  low:
    typeof rawPrefs.low === "boolean"
      ? rawPrefs.low
      : matchMedia("(pointer: coarse)").matches,
  reduced:
    rawPrefs.reduced === true ||
    matchMedia("(prefers-reduced-motion: reduce)").matches,
};
let previewMission: number | undefined;
let difficulty = ["easy", "normal", "hard", "crazy"].includes(
    String(rawPrefs.difficulty),
  )
    ? String(rawPrefs.difficulty)
    : "normal",
  mode: "menu" | "playing" | "paused" | "result" = "menu",
  ready = false,
  radioUntil = 0;
const app = $("#app");
app.innerHTML = `
<canvas id="scene" aria-label="Three-dimensional mission battlefield"></canvas>
<div class="vignette"></div><div id="crosshair" hidden><i></i></div>
<header id="brand"><a href="#" id="home" aria-label="Operation Nightfall briefing"><span class="brand-mark">R<span>///</span></span><span class="brand-name">RAMBO <b>3D</b><small>OPERATION NIGHTFALL</small></span></a><div class="header-right"><span class="status-dot"></span> FIELD OPERATIONS <span class="divider">/</span> <span>EST. 1985</span><button id="sound" class="icon-button" aria-label="Toggle sound">SOUND ON</button></div></header>
<main id="menu" class="menu"><section class="hero"><div class="eyebrow"><span></span> BEHIND ENEMY LINES. AGAIN.</div><h1>THE MISSION<br>IS <em>PERSONAL.</em></h1><p class="hero-copy">They left your people behind.<br>You came back for them.</p><div class="hero-rule"></div><div class="operation-line"><span>01—21</span><p>SEVEN STAGES. THREE LEVELS EACH.<br>EVERYONE COMES HOME.</p></div><div id="launch-area"><button class="primary" disabled id="deploy">PREPARING FIELD KIT <span id="load">0%</span></button></div><div class="difficulty"><span>ENGAGEMENT</span><button data-difficulty="easy">EASY</button><button data-difficulty="normal" class="selected">NORMAL</button><button data-difficulty="hard">HARD</button><button data-difficulty="crazy">CRAZY</button></div><p class="small-note" id="difficulty-note">New player? Try Easy. Unlimited rifle reloads in every mode; Hard and Crazy give less special ammo.</p><label class="stage-picker">STAGE <select id="stage-select" aria-label="Choose stage"></select></label></section>
<aside class="intel"><div class="intel-top"><span class="live-dot"></span> LIVE RECON <span>SECTOR 07</span></div><div class="intel-map"><div class="scan"></div><div class="coordinate c1">17°04′ N</div><div class="coordinate c2">106°42′ E</div><div class="map-line l1"></div><div class="map-line l2"></div><span class="map-dot d1"></span><span class="map-dot d2"></span><span class="map-dot d3"></span><span class="map-label">KHE SAN VALLEY</span></div><div class="intel-bottom"><span>MISSION BRIEF / <b id="brief-number">01</b></span><h2 id="brief-title">Emerald Killbox</h2><p id="brief-copy"></p><div class="intel-meta"><span>◆ SOLO CAMPAIGN</span><span>● 3D TACTICAL ACTION</span></div></div></aside>
<section class="campaign" aria-label="Campaign missions"><div class="campaign-heading"><span>CHOOSE YOUR NEXT FRONT</span><span>CAMPAIGN / NIGHTFALL</span></div><div id="mission-cards" class="mission-cards"></div></section>
<footer class="menu-footer"><span>AN ORIGINAL LOW-POLY COMBAT EXPERIENCE <b id="best-score"></b></span><button id="controls-open">FIELD MANUAL <span>↗</span></button><span>BUILT WITH BLENDER + THREE.JS</span></footer></main>
<section id="hud" hidden aria-label="Mission status"><div class="hud-top"><div class="objective-panel"><span class="eyebrow" id="mission-label"></span><h2 id="mission-title"></h2><div id="objectives"></div></div><div class="hud-right"><button class="icon-button" id="pause">Ⅱ <span>PAUSE</span></button><canvas id="minimap" width="144" height="144" aria-label="Tactical map: road pale green, player white, enemies orange, weapons purple, medical green, shields blue, relay yellow, prisons and allies cyan, treasure gold"></canvas><span class="map-caption" id="route-direction">NORTHBOUND ROUTE</span></div></div><div id="hud-feed"><div id="boss-panel" hidden><div><b id="boss-name"></b><span id="boss-phase">ARMORED TARGET</span></div><div class="boss-track"><i id="boss-bar"></i></div></div><div id="combat-notice" role="status" hidden></div><div id="interact-prompt" hidden></div><div id="radio" role="status"><span>VALE / RADIO</span><p></p></div></div><div class="hud-bottom"><div class="health-panel"><div class="hud-kicker">GHOST <span id="health-text"></span></div><div class="health-track"><i id="health-bar"></i></div><div id="shield-text" aria-label="Shield, allies and field credits">SHIELD 0 / 80</div><div id="awareness">UNSEEN · FLANK FOR REAR HITS</div><div class="health-meta"><span id="dash-text">DODGE READY</span><span id="score">000000</span></div></div><div class="controls-strip"><button id="turbo" aria-label="Activate Turbo" aria-keyshortcuts="F">F · TURBO READY</button> <kbd>WASD</kbd> MOVE <kbd>B</kbd> BLAST <kbd>SPACE</kbd> AUTO FIRE <kbd>E</kbd> INTERACT <kbd>SHIFT</kbd> DODGE</div><div class="ammo-panel"><div id="weapon-name">M4 / ASSAULT RIFLE</div><strong id="ammo">24</strong><span id="ammo-reserve">/ ∞</span><small id="reload-label">R RELOAD · Q SWITCH</small><button id="weapon-swap" aria-label="Switch weapon" aria-keyshortcuts="Q" title="Press Q to cycle collected weapons">Q - SWAP WEAPON</button></div></div><div id="touch"><div id="move-pad" aria-label="Movement joystick: drag to walk or run" role="group"><span class="stick-nub"></span><small>MOVE</small></div><div class="touch-actions"><button data-action="swap" aria-label="Switch weapon" class="swap-weapon">SWAP WEAPON</button><button data-action="reload">RELOAD</button><button data-action="interact" aria-label="Board or exit nearby vehicle">USE</button><button data-action="dodge">DODGE</button><button data-action="turbo" aria-label="Activate Turbo" class="turbo">TURBO</button><button data-hold="blast" class="blast" aria-label="Target explosive stores" title="Hold to fire at a safe explosive store">BLAST</button><button data-hold="fire" class="fire">FIRE</button></div></div></section>
<div id="overlay" class="overlay" hidden></div><div id="toast" role="status" hidden></div>`;
const canvas = $<HTMLCanvasElement>("#scene");
let world: World, game: Game, feedback: FeedbackUI;
const interactionHint = new InteractionHint();
const input: Input = {
  x: 0,
  z: 0,
  fire: false,
  assist: false,
  aim: new T.Vector3(0, 0, 0),
  dodge: false,
  reload: false,
  interact: false,
  swap: false,
  turbo: false,
  blast: false,
};
const keys = new Set<string>(),
  held = new Set<string>();
const touchOwners = new Map<number, string>();
const movePad = $("#move-pad"),
  nub = movePad.querySelector<HTMLElement>(".stick-nub")!;
let moveOwner: number | null = null;
const stick = { x: 0, z: 0 };
function resetStick() {
  const owner = moveOwner;
  moveOwner = null;
  stick.x = stick.z = 0;
  nub.style.transform = "translate(0px, 0px)";
  movePad.classList.remove("engaged");
  if (owner !== null && movePad.hasPointerCapture(owner))
    movePad.releasePointerCapture(owner);
}
function updateStick(e: PointerEvent) {
  const r = movePad.getBoundingClientRect();
  const radius = Math.max(1, (r.width - nub.offsetWidth) / 2 - 3);
  const x = (e.clientX - r.left - r.width / 2) / radius;
  const z = (e.clientY - r.top - r.height / 2) / radius;
  const length = Math.hypot(x, z),
    divisor = Math.max(1, length);
  nub.style.transform = `translate(${(x / divisor) * radius}px, ${(z / divisor) * radius}px)`;
  const strength = Math.max(0, (Math.min(1, length) - 0.15) / 0.85);
  stick.x = length ? (x / length) * strength : 0;
  stick.z = length ? (z / length) * strength : 0;
}
movePad.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (mode !== "playing" || moveOwner !== null || e.button !== 0) return;
  moveOwner = e.pointerId;
  if (e.isTrusted) movePad.setPointerCapture(e.pointerId);
  movePad.classList.add("engaged");
  updateStick(e);
});
movePad.addEventListener("pointermove", (e) => {
  if (e.pointerId === moveOwner && mode === "playing") updateStick(e);
});
for (const event of [
  "pointerup",
  "pointercancel",
  "lostpointercapture",
] as const)
  movePad.addEventListener(event, (e) => {
    if (e.pointerId === moveOwner) resetStick();
  });
let firePointer: number | null = null;
let mouseDown = false,
  pointer = new T.Vector2(),
  pointerSeen = false;
const ray = new T.Raycaster(),
  ground = new T.Plane(new T.Vector3(0, 1, 0), -0.9);
function clearInput() {
  resetStick();
  keys.clear();
  held.clear();
  touchOwners.clear();
  firePointer = null;
  mouseDown = false;
  input.x = 0;
  input.z = 0;
  input.fire = false;
  input.dodge = false;
  input.reload = false;
  input.interact = false;
  input.swap = false;
  input.turbo = false;
  input.blast = false;
}
const audio = new GameAudio();
/** Play a cue; world-positioned cues fade with distance and pan left/right. */
function sound(type: string, at?: { x: number; z: number }) {
  if (!(GameAudio.isMusic(type) ? prefs.music : prefs.sound)) return;
  if (!at || !game) return audio.play(type);
  const dx = at.x - game.pos.x,
    dz = at.z - game.pos.z,
    distance = Math.hypot(dx, dz);
  audio.play(type, {
    gain: Math.max(0, 1 - distance / 46) ** 1.4,
    pan: dx / 18,
  });
}
function radio(text: string) {
  $("#radio p").textContent = text;
  radioUntil = performance.now() + 9000;
  $("#radio").classList.add("visible");
}
function syncSound() {
  const any = prefs.sound || prefs.music;
  $("#sound").textContent = any ? "SOUND ON" : "SOUND OFF";
  $("#sound").setAttribute("aria-pressed", String(any));
  audio.configure(prefs.sound, prefs.music);
  write("nightfall-prefs", { ...prefs, difficulty });
}
// The briefing button is a master switch for effects and music together.
// Browsers allow audio only after a gesture; the first one starts the music.
for (const event of ["pointerdown", "keydown"])
  window.addEventListener(event, () => audio.unlock(), { once: true });
$("#sound").onclick = () => {
  prefs.sound = prefs.music = !(prefs.sound || prefs.music);
  syncSound();
};
syncSound();
/** Blender-rendered UI icons live in public/ui. */
const uiIcon = (name: string) => `${import.meta.env.BASE_URL}ui/${name}.png`;
const stageStars = (stage: number) =>
  [0, 1, 2].reduce((n, level) => n + (save.stars[stage * 3 + level] ?? 0), 0);
function menu() {
  mode = "menu";
  clearInput();
  audio.setThemeLevel(1);
  audio.playTheme("title");
  $("#menu").hidden = false;
  $("#brand").hidden = false;
  $("#hud").hidden = true;
  $("#overlay").hidden = true;
  $("#crosshair").hidden = true;
  document.body.classList.remove("in-game");
  const index = previewMission ?? (save.completed ? 0 : save.mission),
    m = MISSIONS[index];
  // Render the next stage theme while the briefing is open.
  audio.prefetch(themeFor(m.biome));
  if (ready) {
    game.cleanup();
    world.build(index);
    world.marker.visible = true;
    world.terrain.add(
      model("commando", 3, 15),
      model(m.bossModel, 4, -14, 0.85),
    );
  }
  $("#best-score").textContent = save.best
    ? " / BEST " + save.best.toLocaleString()
    : "";
  $("#brief-number").textContent = `${m.stage + 1} / LEVEL ${m.level + 1} OF 3`;
  $("#brief-title").textContent = m.name;
  $(".map-label").textContent = m.region;
  $("#brief-copy").textContent = m.brief;
  $("#mission-cards").innerHTML = STAGES.map(
    (stage, i) =>
      `<article class="mission-card ${i === m.stage ? "active" : ""}"><div class="card-num">${i + 1}</div><div><span class="card-tag">THREE LEVELS / BOSS FINALE · <i class="card-stars">★ ${stageStars(i)}/9</i></span><h3>${stage.name}</h3><p>${stage.tip}</p></div></article>`,
  ).join("");
  const picker = $<HTMLSelectElement>("#stage-select");
  picker.innerHTML = STAGES.map(
    (stage, i) =>
      `<option value="${i}" ${i === m.stage ? "selected" : ""}>${i + 1}. ${stage.name} · ★${stageStars(i)}</option>`,
  ).join("");
  picker.onchange = () => {
    const pick = Number(picker.value) * 3;
    // Re-picking the stage you are already on keeps the saved level.
    previewMission =
      !save.completed && pick === Math.floor(save.mission / 3) * 3
        ? undefined
        : pick;
    menu();
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-difficulty]")
    .forEach((b) => {
      b.classList.toggle("selected", b.dataset.difficulty === difficulty);
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.difficulty === difficulty),
      );
    });
  const deployLabel =
    previewMission !== undefined
      ? `DEPLOY TO STAGE ${Math.floor(previewMission / 3) + 1}`
      : save.completed
        ? "REPLAY CAMPAIGN"
        : save.mission > 0
          ? "CONTINUE OPERATION"
          : "DEPLOY TO STAGE";
  $("#launch-area").innerHTML =
    `<button class="primary" id="deploy" ${ready ? "" : "disabled"}>${deployLabel} <span>↗</span></button>${previewMission !== undefined && (save.mission > 0 || save.completed) ? '<p class="small-note" id="stage-switch-note">Starts this stage at level 1. Credits, Field Kit and squad carry over; level upgrades restart.</p>' : ""}${save.mission > 0 && !save.completed ? '<button class="text-button" id="new-campaign">START NEW CAMPAIGN</button>' : ""}`;
  const price = fieldKitCost(save);
  $("#launch-area").insertAdjacentHTML(
    "beforeend",
    `<button class="text-button field-shop" id="field-shop">QUARTERMASTER · FIELD KIT ${save.fieldKit}/3 · ${save.credits} CREDITS · ${save.squad} ALLIES${save.loadout.length ? ` · ${save.loadout.length} SUPPLY DROP${save.loadout.length > 1 ? "S" : ""}` : ""}</button>`,
  );
  $("#field-shop").onclick = () => {
    const kitReady = price !== null && save.credits >= price;
    const card = (
      icon: string,
      title: string,
      detail: string,
      cost: string,
      button: string,
      state = "",
    ) =>
      `<article class="shop-card ${state}"><img src="${uiIcon(icon)}" alt=""><div><b>${title}</b><span>${detail}</span></div><div class="shop-buy">${button}<small>${cost}</small></div></article>`;
    const supplies = SUPPLIES.map((item) => {
      const owned = save.loadout.includes(item.id),
        affordable = save.credits >= item.price,
        name = WEAPONS[item.weapon].name;
      return card(
        "weapon-" + item.id,
        name,
        owned
          ? "Packed: dropped with you at every deployment until you complete a mission."
          : "Supply drop: starts your next deployment with this weapon and reserve magazines.",
        owned ? "PACKED" : `${item.price} CREDITS`,
        `<button data-buy="${item.id}" ${owned || !affordable ? "disabled" : ""} aria-label="Buy ${name} for ${item.price} credits">${owned ? "✓" : "BUY"}</button>`,
        owned ? "owned" : affordable ? "" : "locked",
      );
    }).join("");
    showOverlay(
      `<span class="eyebrow">QUARTERMASTER</span><h2>Gear up for the next drop.</h2><div class="wallet"><img src="${uiIcon("coin")}" alt=""><b>${save.credits}</b><span>CREDITS</span><em>Banknote 10 · Gold 25 · Diamond 75 · ${STAR_BONUS} per star</em></div><div class="shop-grid">${card(
        "field-kit",
        `FIELD KIT RANK ${save.fieldKit}/3`,
        "Permanent: +10 starting shield and one extra frag grenade every mission, including retries.",
        price === null ? "MAXED" : `${price} CREDITS`,
        `<button class="primary" id="buy-kit" ${kitReady ? "" : "disabled"}>${price === null ? "MAXED" : "UPGRADE"}</button>`,
        price === null ? "owned" : kitReady ? "featured" : "featured locked",
      )}${supplies}</div><button class="text-button" id="close-shop">RETURN TO BRIEFING</button>`,
      "shop-modal",
    );
    $("#close-shop").focus();
    const reopen = () => {
      write("nightfall-campaign", save);
      menu();
      $("#field-shop").click();
    };
    $("#buy-kit").onclick = () => {
      if (!kitReady || mode !== "menu") return;
      save = buyFieldKit(save);
      reopen();
    };
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-buy]",
    ))
      button.onclick = () => {
        if (mode !== "menu") return;
        save = buySupply(save, button.dataset.buy!);
        reopen();
      };
    $("#close-shop").onclick = () => {
      $("#overlay").hidden = true;
      $("#field-shop").focus();
    };
  };
  $("#deploy").onclick = () => {
    // Changing stage or replaying restarts level progression, but recovered
    // treasure, permanent Field Kit ranks and rescued allies are kept.
    const carried = (mission: number) => ({
      ...freshSave(),
      mission,
      best: save.best,
      credits: save.credits,
      fieldKit: save.fieldKit,
      squad: save.squad,
      stars: save.stars,
      loadout: save.loadout,
    });
    if (previewMission !== undefined) {
      save = carried(previewMission);
      previewMission = undefined;
      write("nightfall-campaign", save);
    } else if (save.completed) {
      save = carried(0);
      write("nightfall-campaign", save);
    }
    start();
  };
  const reset = document.querySelector<HTMLButtonElement>("#new-campaign");
  if (reset)
    reset.onclick = () => {
      showOverlay(
        `<span class="eyebrow">NEW CAMPAIGN</span><h2>Back to the beginning?</h2><p>This resets mission progress, upgrades, treasure and your squad. Your best score is kept.</p><button class="primary" id="confirm-new">START OVER <span>↗</span></button><button class="text-button" id="cancel-new">KEEP MY PROGRESS</button>`,
      );
      $("#confirm-new").onclick = () => {
        save = { ...freshSave(), best: save.best };
        write("nightfall-campaign", save);
        menu();
      };
      $("#cancel-new").onclick = () => {
        $("#overlay").hidden = true;
      };
    };
}
function start(fromRelay = false) {
  if (!ready) return;
  interactionHint.reset();
  clearInput();
  feedback.clear();
  // Retrying from the relay replays the checkpoint saved when it was secured.
  if (fromRelay && game.checkpoint) game.restoreCheckpoint(save, difficulty);
  else {
    game.start(save.mission, save, difficulty);
    world.marker.visible = true;
  }
  mode = "playing";
  $("#menu").hidden = true;
  $("#brand").hidden = true;
  $("#hud").hidden = false;
  $("#overlay").hidden = true;
  document.body.classList.add("in-game");
  if (!fromRelay) radio(MISSIONS[save.mission].radio);
  sound("start");
  // The stage theme fades in under the deploy fanfare; finales pre-render the
  // boss version so it can take over the moment the bosses arrive.
  const mission = MISSIONS[save.mission];
  audio.playTheme(themeFor(mission.biome), false, 1.2);
  if (mission.finale) audio.prefetch(themeFor(mission.biome), true);
  canvas.focus();
}
function showOverlay(html: string, variant = "") {
  const overlay = $("#overlay");
  overlay.innerHTML = `<section class="modal ${variant}" role="dialog" aria-modal="true" aria-label="Mission panel">${html}</section>`;
  overlay.hidden = false;
  overlay.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
}
function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  clearInput();
  audio.setThemeLevel(0.35);
  showOverlay(
    `<span class="eyebrow">SIGNAL ON HOLD</span><h2>Take a breath.</h2><p>The battlefield will wait.</p><button id="resume" class="primary">RESUME OPERATION <span>↗</span></button><div class="settings"><label><span>Sound effects</span><input id="setting-sound" type="checkbox" ${prefs.sound ? "checked" : ""}></label><label><span>Music</span><input id="setting-music" type="checkbox" ${prefs.music ? "checked" : ""}></label><label><span>Graphics detail</span><select id="setting-low" aria-label="Graphics detail"><option value="low" ${prefs.low ? "selected" : ""}>Low · Mobile / battery saver</option><option value="high" ${!prefs.low ? "selected" : ""}>High · PC / detailed visuals</option></select></label><label><span>Reduce camera motion</span><input id="setting-motion" type="checkbox" ${prefs.reduced ? "checked" : ""}></label></div><div class="modal-actions"><button id="restart">RESTART MISSION</button><button id="to-menu">MISSION BRIEFING</button></div><p class="small-note">WASD / arrows move · Mouse aims · Click / Space fires<br>R reload · Q switch · B target explosives · E interact · Shift dodge · Esc pause</p>`,
  );
  $("#resume").onclick = resume;
  $("#restart").onclick = () => start();
  $("#to-menu").onclick = menu;
  $<HTMLInputElement>("#setting-sound").onchange = (e) => {
    prefs.sound = (e.target as HTMLInputElement).checked;
    syncSound();
  };
  $<HTMLInputElement>("#setting-music").onchange = (e) => {
    prefs.music = (e.target as HTMLInputElement).checked;
    syncSound();
  };
  $<HTMLSelectElement>("#setting-low").onchange = (e) => {
    prefs.low = (e.target as HTMLSelectElement).value === "low";
    world.quality(prefs.low);
    write("nightfall-prefs", { ...prefs, difficulty });
  };
  $<HTMLInputElement>("#setting-motion").onchange = (e) => {
    prefs.reduced = (e.target as HTMLInputElement).checked;
    write("nightfall-prefs", { ...prefs, difficulty });
  };
}
function resume() {
  if (mode !== "paused") return;
  clearInput();
  audio.setThemeLevel(1);
  mode = "playing";
  $("#overlay").hidden = true;
}
$("#pause").onclick = pause;
$("#home").onclick = (e) => {
  e.preventDefault();
  if (mode === "playing") pause();
};
$("#controls-open").onclick = () => {
  showOverlay(
    `<span class="eyebrow">FIELD MANUAL / QUICK START</span><h2>Find the signal. Bring them home.</h2>
    <p>Move, fire, and reach the yellow relay. It secures automatically; defeat the guards leaving the houses, then follow green extraction. You can leave other patrols alive. Blue prison doors are optional rescue stops: approach to free allies who follow and fire in your direction. Three allies can support you; they travel with your vehicle and extract with you.</p>
    <div class="manual-grid"><span>WASD / LEFT PAD</span><b>Move</b><span>SPACE / FIRE</span><b>Assisted aim and fire</b><span>MOUSE + CLICK</span><b>Manual aim and fire</b><span>Q / SWAP</span><b>Rifle ↔ frag grenade</b></div>
    <p>The rifle has unlimited reloads. Four frag grenades are ready before field-kit upgrades. Find the early M249 cache for 60 bonus rounds. Easy gives extra health with the same enemies; it is a good place to start.</p>
    <details class="manual-section"><summary>Smart moves & rewards</summary><p>Hold B / BLAST to target a visible fuel drum or red EXPLOSIVE crate. Its explosion hurts nearby enemies and you; solid cover shields the blast. Chain kills grant +75 score per additional enemy and up to +15 shield. Rear bullet hits deal 1.75× damage to soldiers; a rear-hit finish adds +50 score and +5 shield. Enemy tank armor is weaker from behind. Bosses have no rear-hit bonus.</p><p>Grenades arc over low cover. Q / SWAP selects them; mouse aim sets the landing distance, or mobile FIRE targets an enemy. Shoot cracked masonry to open a route through roofless city compounds. Solid houses and perimeter walls remain cover.</p></details>
    <details class="manual-section"><summary>Enemy soldiers & counters</summary><p>Riflemen keep their distance. Rust-red knife rushers are fragile but run fast once alarmed: backstep or dodge their warned stab. Long-sword soldiers have a wider orange sweep; get outside the arc, then attack during recovery. Ochre knife throwers strafe and throw one visible blade at a time; sidestep or use cover. Orange rocket troops carry a launcher and spare tube: their orange aiming line locks before firing, so move sideways or break sight behind solid cover. Blades barely scratch a tank.</p><p>Mission one introduces rushers, mission two adds swords and throwing knives, and rockets arrive at the first finale. There can be only one infantry rocket aiming or flying at once on Easy/Normal, or two on Hard/Crazy. Ordinary gunfire, tanks and bosses keep their own attacks. All specialist attacks stop when their soldier is killed; already airborne projectiles still travel.</p></details>
    <details class="manual-section"><summary>Weapons, vehicles & advanced controls</summary><div class="manual-grid"><span>R / RELOAD</span><b>Reload</b><span>SHIFT / DODGE</span><b>Dodge while moving</b><span>E / USE</span><b>Board or exit a vehicle</b><span>F / TURBO</span><b>Two weapons for 3 seconds</b><span>ESC / PAUSE</span><b>Settings</b></div><p>Bikes and jeeps arrive in mission two; tanks and the full arsenal arrive at the first finale. Tanks start with six ready explosive cannon shells and 1,680 armor. Q / SWAP cycles the cannon and collected weapons. Jeeps carry 20 shotgun rounds. Tanks and jeeps crush soldiers while moving; tanks crush small trees at half speed.</p><p>The M249 fires 30 rounds per second with 10 damage per round, a 120-round belt and a 2.8-second reload. The rifle deals 28 per round. Small arms deal only 20% damage to enemy tank armor; use rockets, explosives or laser. Strongest usable weapons equip automatically; manual switching stays available. Turbo consumes both weapons' ammunition, then cools for 14 seconds. Tuned Weapons unlocks extra vehicle guns and extends Turbo; Light Kit reduces its cooldown.</p></details>
    <details class="manual-section"><summary>Difficulty, supplies & campaign</summary><p>Rescued allies are protected support, so you never lose a mission because of an escort. Banknotes, gold and rescue diamonds are worth 10, 25 and 75 credits. Only successful extraction saves treasure and your squad. Spend credits at the briefing Field Kit shop for up to three permanent ranks: +10 starting shield and +1 frag per rank. Unrescued prisoners remain optional; extra rescues after three allies evacuate directly.</p><p>Every defeated enemy has an independent one-in-three chance to drop one package: health (+15), shield (+20), or ammunition for one owned special weapon. Easy and Normal give one magazine. Hard gives 20% and Crazy 10%, rounded up to at least one round. The selected eligible weapon gets priority; otherwise the least stocked weapon gets the refill. Packages expire after 45 seconds, with at most 48 on the map.</p><p>Hard doubles soldiers; Crazy quadruples soldiers and has four finale bosses. Longer O, U and S routes arrive after the compact opening. On O routes, either arm reaches the relay. Snow slides, sand slows, mud sinks, and quake dust warns that ground enemies will briefly freeze. Leave orange danger rings before missiles, lasers or volcanic rocks land. Defeat every finale boss and exit your vehicle to extract.</p></details>
    <button id="close-manual" class="primary">READY FOR THE FIELD <span>↗</span></button>`,
  );
  $("#close-manual").onclick = () => {
    $("#overlay").hidden = true;
    $("#controls-open").focus();
  };
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-difficulty]",
))
  button.onclick = () => {
    difficulty = button.dataset.difficulty!;
    write("nightfall-prefs", { ...prefs, difficulty });
    const config = difficultyConfig(difficulty);
    $("#difficulty-note").textContent =
      `${difficulty.toUpperCase()}: ${config.health} health / ${config.soldiers}x soldiers / ${config.bosses} boss${config.bosses > 1 ? "es" : ""} per finale. ${difficulty === "easy" || difficulty === "normal" ? "Full special-ammo rewards." : "Smaller special-ammo rewards."}`;
    document
      .querySelectorAll("[data-difficulty]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          (b as HTMLElement).dataset.difficulty === difficulty,
        ),
      );
  };
function end(win: boolean) {
  if (mode === "result") return;
  mode = "result";
  clearInput();
  audio.playTheme("");
  sound(win ? "win" : "lose");
  const m = MISSIONS[game.index],
    final = win && game.index === LEVEL_COUNT - 1;
  // Bank once at extraction, even if the browser closes before the upgrade choice.
  // Armor is the saved default; choosing another advantage replaces that one rank.
  const par = missionPar(routeLength(m.route), m.finale);
  const grade = missionGrade({
    win,
    elapsed: game.elapsed,
    par,
    hpRatio: game.hp / game.maxHp,
  });
  const tally = rewardBreakdown(game.loot, grade.stars);
  const banked = win ? game.credits + grade.stars * STAR_BONUS : 0;
  if (win) {
    save = advanceCampaign(save, "armor", game.score, {
      credits: banked,
      squad: game.squad.allies.length,
    });
    save.stars = recordStars(save.stars, game.index, grade.stars);
    save.loadout = []; // Supply drops are spent once a mission is won.
    write("nightfall-campaign", save);
  }
  const stars = [0, 1, 2]
    .map(
      (i) =>
        `<img class="grade-star ${i < grade.stars ? "earned" : ""}" style="--i:${i}" src="${uiIcon(i < grade.stars ? "star" : "star-empty")}" alt="">`,
    )
    .join("");
  const criteria = grade.criteria
    .map(
      (c) =>
        `<li class="${c.met ? "met" : ""}">${c.met ? "✓" : "✗"} ${c.label}${c.id === "par" ? ` · ${formatTime(game.elapsed)} / ${formatTime(par)}` : c.id === "health" ? ` · ${Math.round((100 * game.hp) / game.maxHp)}%` : ""}</li>`,
    )
    .join("");
  const rows = tally.rows
    .map(
      (r) =>
        `<div class="tally-row ${r.count ? "" : "empty"}"><img src="${uiIcon(r.id)}" alt=""><span>${r.label}</span><em>${r.count} × ${r.each}</em><b>+${r.value}</b></div>`,
    )
    .join("");
  const upgrades = [
    ["armor", "01 / FIELD ARMOR", "+35 maximum health"],
    [
      "power",
      "02 / TUNED WEAPONS",
      "+20% base damage · +0.4s Turbo (max 5s) · vehicle auxiliary gun; rank 3 adds a third gun",
    ],
    [
      "mobility",
      "03 / LIGHT KIT",
      "−0.55s dodge cooldown · −0.75s Turbo cooldown (min 8s)",
    ],
  ]
    .map(
      ([id, title, detail]) =>
        `<button data-upgrade="${id}"><img src="${uiIcon("upgrade-" + id)}" alt=""><b>${title}</b><span>${detail}</span></button>`,
    )
    .join("");
  const debrief = `<div class="debrief"><div class="grade" aria-label="${grade.stars} of 3 stars"><div class="grade-stars">${stars}</div><ul>${criteria}</ul></div><div class="tally">${rows}<div class="tally-total"><img src="${uiIcon("coin")}" alt=""><span>BANKED</span><b id="banked" data-total="${banked}">+${banked}</b><em>BALANCE ${save.credits} CREDITS</em></div></div></div>`;
  showOverlay(
    `<span class="eyebrow">${win ? "TRANSMISSION RECEIVED" : "SIGNAL LOST"} / 0${game.index + 1}</span><h2>${final ? "Everyone comes home." : win ? "Mission accomplished." : "Not your last stand."}</h2>${win ? debrief : "<p>Use cover to break enemy sightlines. Dodge when orange rings appear, and collect green health drops. Your completed campaign progress is safe.</p>"}<p class="rescue-result">${win ? `${game.rescued} rescued · ${game.squad.allies.length} allies returning · ${game.credits} credits recovered` : "Unbanked mission treasure is lost. Your saved squad and field kit return on retry."}</p><div class="result-stats"><div><b>${game.score.toLocaleString()}</b><span>MISSION SCORE</span></div><div><b>${game.kills}</b><span>TARGETS DOWN</span></div><div><b>${formatTime(game.elapsed)}</b><span>FIELD TIME</span></div></div>${win && !final ? `<span class="eyebrow">CHOOSE YOUR NEXT ADVANTAGE · ARMOR SAVED BY DEFAULT</span><div class="upgrades">${upgrades}</div>` : `${!win && game.checkpoint ? '<button id="result-checkpoint" class="primary">RETRY FROM RELAY <span>↗</span></button>' : ""}<button id="result-primary" class="${!win && game.checkpoint ? "secondary-action" : "primary"}">${win ? "RETURN TO BRIEFING" : "RETRY MISSION"} <span>↗</span></button>`}${!win ? '<button id="result-menu" class="text-button">MISSION BRIEFING</button>' : ""}`,
    win ? "debrief-modal" : "",
  );
  const total = document.querySelector<HTMLElement>("#banked");
  if (total && !prefs.reduced) {
    // Count the banked credits up while the stars pop in.
    const started = performance.now(),
      target = Number(total.dataset.total);
    const tick = (now: number) => {
      const t = Math.min(1, (now - started - 700) / 900);
      total.textContent = `+${Math.round(target * Math.max(0, t) ** 0.6)}`;
      if (t < 1 && total.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    "[data-upgrade]",
  ))
    b.onclick = () => {
      if (mode !== "result") return;
      const chosen = b.dataset.upgrade;
      if (chosen !== "armor" && chosen !== "power" && chosen !== "mobility")
        return;
      if (chosen !== "armor") {
        save.armor--;
        save[chosen]++;
      }
      write("nightfall-campaign", save);
      menu();
    };
  const primary = document.querySelector<HTMLButtonElement>("#result-primary");
  if (primary) primary.onclick = win ? menu : () => start();
  const relay = document.querySelector<HTMLButtonElement>("#result-checkpoint");
  if (relay) relay.onclick = () => start(true);
  const back = document.querySelector<HTMLButtonElement>("#result-menu");
  if (back) back.onclick = menu;
}
function formatTime(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
const map = $<HTMLCanvasElement>("#minimap"),
  ctx = map.getContext("2d")!;
function updateHud() {
  const m = MISSIONS[game.index];
  $("#mission-label").textContent =
    `STAGE ${m.stage + 1} / LEVEL ${m.level + 1} OF 3 / ${difficulty.toUpperCase()} / ${formatTime(game.elapsed)}`;
  $("#mission-title").textContent = m.name;
  // The live objective shows how far its goal is, matching the guide arrow.
  const goal = game.goal;
  const metres = goal
    ? ` · ${Math.round(Math.hypot(goal.x - game.pos.x, goal.z - game.pos.z))} M`
    : "";
  $("#objectives").innerHTML =
    `<span class="${game.objective ? "done" : ""}">${game.objective ? "✓" : "◇"} ${m.action}${game.objective ? "" : " · APPROACH" + metres}</span><span class="${game.bossDead ? "done" : ""}">${game.bossDead ? "✓" : "◇"} Neutralize ${m.finale ? "all command bosses" : "relay guards"}${game.pendingGuards ? ` · ${game.pendingGuards} incoming` : ""}${game.objective && !game.bossDead ? metres : ""}</span><span class="${game.bossDead ? "current" : ""}">◇ Reach extraction${game.bossDead ? metres : ""}</span>`;
  $("#route-direction").textContent = m.direction + " ROUTE";
  $("#health-text").textContent = `${Math.ceil(game.hp)} / ${game.maxHp}`;
  $("#shield-text").title =
    "Personal shield · Supporting allies · Treasure to bank at extraction";
  $("#shield-text").textContent =
    `SHIELD ${Math.ceil(game.shield)} · ALLIES ${game.squad.allies.length} · ¤${game.credits}`;
  $("#health-bar").style.width = `${(game.hp / game.maxHp) * 100}%`;
  $("#health-bar").classList.toggle("danger", game.hp / game.maxHp < 0.3);
  $("#dash-text").textContent =
    game.dashCooldown > 0
      ? `DODGE ${game.dashCooldown.toFixed(1)}s`
      : "DODGE READY";
  if (game.riding)
    $("#dash-text").textContent =
      "VEHICLE ARMOR " +
      Math.ceil(game.riding.hp) +
      " / " +
      game.riding.spec.hp;
  $(".health-panel").dataset.context = String(
    !!game.riding || game.dashCooldown > 0,
  );
  $("#score").textContent = `${game.score.toString().padStart(6, "0")} PTS`;
  const ride = game.riding;
  const personalWeapon = game.usesPersonalWeapon;
  $("#weapon-name").textContent = ride
    ? ride.spec.name +
      " / " +
      (personalWeapon
        ? game.weaponSpec.name
        : ride.kind === "tank"
          ? "CANNON"
          : "MOUNTED SHOTGUN")
    : game.weaponSpec.name;
  $("#ammo-reserve").textContent = !personalWeapon
    ? ride?.kind === "tank"
      ? "/ SHELLS"
      : "/ VEHICLE AMMO"
    : Number.isFinite(game.reserves[game.weapon])
      ? "/ " + game.reserves[game.weapon]
      : "/ ∞";
  $("#ammo").textContent = (personalWeapon ? game.ammo : ride!.ammo)
    .toString()
    .padStart(2, "0");
  $("#reload-label").textContent =
    game.reloadTime > 0
      ? `RELOADING ${game.reloadTime.toFixed(1)}s`
      : ride?.kind === "tank"
        ? personalWeapon
          ? `R RELOAD · CANNON ${ride.ammo} SHELLS`
          : "Q / SWAP TO USE COLLECTED WEAPONS"
        : !personalWeapon
          ? "LIMITED AMMO · USE TO EXIT"
          : "R RELOAD · Q SWITCH";
  for (const button of [$("#turbo"), $('[data-action="turbo"]')]) {
    (button as HTMLButtonElement).disabled = !game.canTurbo;
    button.textContent =
      (button.id === "turbo" ? "F · " : "") + game.turboLabel;
    button.classList.toggle("active", game.turboTime > 0);
    button.title =
      "Hold FIRE during Turbo. Two guns for 3s; Tuned Weapons unlocks vehicle guns and extends duration. Light Kit reduces cooldown.";
  }
  const notice = $("#combat-notice");
  const teaching = game.index === 0 && !game.objective && game.elapsed < 35;
  const moved = Math.hypot(game.pos.x, game.pos.z - 18) > 3;
  const nearbyPrison = game.prisons.find(
    (p) =>
      !p.freed &&
      Math.hypot(p.box.exit!.x - game.pos.x, p.box.exit!.z - game.pos.z) < 9,
  );
  const nearbyBonus = game.weaponDrops.some(
    (d) =>
      d.mesh.userData.bonusRounds &&
      Math.hypot(
        d.mesh.position.x - game.pos.x,
        d.mesh.position.z - game.pos.z,
      ) < 5,
  );
  const movementHint = teaching && !moved && game.elapsed < 8;
  const coach = movementHint
    ? matchMedia("(pointer: coarse)").matches
      ? "LEFT PAD · MOVE TOWARD THE YELLOW RELAY"
      : "WASD · MOVE TOWARD THE YELLOW RELAY"
    : nearbyPrison
      ? "BLUE PRISON DOOR · APPROACH TO RESCUE AN ALLY"
      : nearbyBonus
        ? "M249 CACHE · COLLECT 60 BONUS ROUNDS"
        : teaching
          ? !moved && game.elapsed < 10
            ? matchMedia("(pointer: coarse)").matches
              ? "LEFT PAD · MOVE TOWARD THE YELLOW RELAY"
              : "WASD · MOVE TOWARD THE YELLOW RELAY"
            : game.kills === 0 && game.elapsed < 20
              ? "HOLD SPACE / FIRE · ASSISTED AIM"
              : game.elapsed < 26
                ? "B / BLAST · TURN FUEL DEPOTS AGAINST PATROLS"
                : "YELLOW RELAY → GUARDS → GREEN EXTRACTION"
          : "";
  const activeNotice = game.elapsed < game.combatNoticeUntil;
  notice.hidden = !activeNotice && !coach;
  notice.textContent = activeNotice ? game.combatNotice : coach;
  const blastButton = $('[data-hold="blast"]');
  blastButton.classList.toggle("active", !!input.blast);
  blastButton.textContent = input.blast
    ? game.blastTarget
      ? "BLAST LOCK"
      : "NO TARGET"
    : "BLAST";
  const mountedGun = !game.canSwapWeapon;
  for (const button of [$("#weapon-swap"), $('[data-action="swap"]')]) {
    (button as HTMLButtonElement).disabled = mountedGun;
    button.title = mountedGun
      ? game.turboTime > 0
        ? "Weapon switching resumes after Turbo"
        : "Exit the vehicle to switch personal weapons"
      : ride && ride.kind !== "motorcycle"
        ? `Cycle ${ride.kind === "tank" ? "cannon" : "mounted gun"} and collected weapons (Q on keyboard)`
        : "Cycle collected weapons (Q on keyboard)";
  }
  $("#weapon-swap").textContent = mountedGun
    ? game.turboTime > 0
      ? "TURBO / LOADOUT LOCKED"
      : "MOUNTED GUN - EXIT TO SWAP"
    : "Q - SWAP WEAPON";
  $('[data-action="swap"]').textContent = mountedGun
    ? game.turboTime > 0
      ? "TURBO ACTIVE"
      : "MOUNTED GUN"
    : "SWAP WEAPON";
  const boss = game.boss;
  $("#boss-panel").hidden = !boss;
  if (boss) {
    // Sum every boss (dead ones at 0 hp) so a kill never refills the bar.
    const bosses = game.enemies.filter((e) => e.boss);
    const alive = bosses.filter((e) => e.hp > 0);
    $("#boss-name").textContent = `${m.boss} / ${alive.length} REMAIN`;
    $("#boss-bar").style.width =
      `${(100 * bosses.reduce((n, e) => n + Math.max(0, e.hp), 0)) / bosses.reduce((n, e) => n + e.max, 0)}%`;
    const salvo = alive.find((e) => (e.salvoUntil ?? 0) > game.elapsed);
    const exposed = alive.some((e) => game.bossExposed(e)),
      enraged = alive.some((e) => e.enraged);
    $("#boss-phase").textContent = salvo
      ? "HEAVY SALVO / TAKE COVER"
      : `${exposed ? "WEAK POINT · " : ""}${boss.state ?? "ARMORED TARGET"}${enraged ? " · ENRAGED" : ""}`;
    $("#boss-panel").classList.toggle("exposed", exposed && !salvo);
    $("#boss-panel").classList.toggle("enraged", enraged);
  }
  const prompt = $("#interact-prompt");
  const hintKey = game.riding
    ? `exit:${game.rides.indexOf(game.riding)}`
    : game.nearestRide
      ? `board:${game.rides.indexOf(game.nearestRide)}`
      : null;
  const changed = interactionHint.key !== hintKey;
  prompt.hidden = !interactionHint.update(hintKey, performance.now());
  prompt.innerHTML = game.interaction
    ? "<kbd>E</kbd> " + game.interaction + " <span>/ TAP USE</span>"
    : "";
  if (changed && hintKey && !prefs.reduced) {
    prompt.getAnimations().forEach((a) => a.cancel());
    prompt.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.75 },
        { opacity: 0, offset: 1 },
      ],
      { duration: 1000 },
    );
  }
  const useButton = $('[data-action="interact"]');
  useButton.textContent = game.riding
    ? "EXIT"
    : game.nearestRide
      ? "BOARD"
      : "USE";
  $("#radio").classList.toggle("visible", performance.now() < radioUntil);
  ctx.fillStyle = "#152723";
  ctx.fillRect(0, 0, 144, 144);
  ctx.strokeStyle = "#35483b";
  ctx.lineWidth = 0.5;
  for (let x = 12; x < 144; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 144);
    ctx.moveTo(0, x);
    ctx.lineTo(144, x);
    ctx.stroke();
  }
  const scale =
    128 / Math.max(WORLD_BOUNDS.x * 2, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  const mapX = (x: number) => 72 + x * scale;
  const mapZ = (z: number) =>
    72 + (z - (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2) * scale;
  ctx.fillStyle = "#555b58";
  for (const b of COVER)
    if (b.kind === "hill" || b.kind === "basalt")
      ctx.fillRect(
        mapX(b.x - b.w / 2),
        mapZ(b.z - b.d / 2),
        b.w * scale,
        b.d * scale,
      );
  ctx.strokeStyle = "#83988d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  m.roads.forEach((route) =>
    route.forEach((p, i) =>
      i ? ctx.lineTo(mapX(p.x), mapZ(p.z)) : ctx.moveTo(mapX(p.x), mapZ(p.z)),
    ),
  );
  ctx.stroke();
  const point = (x: number, z: number, color: string, r: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mapX(x), mapZ(z), r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const box of COVER)
    if (["fuel", "explosive"].includes(box.kind ?? ""))
      point(box.x, box.z, "#ff6428", 1.8);
  for (const e of game.enemies)
    if (e.hp > 0) {
      const color = e.alerted || e.boss ? "#ff934b" : "#a6a88d";
      point(e.x, e.z, color, e.boss ? 4 : 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mapX(e.x), mapZ(e.z));
      ctx.lineTo(
        mapX(e.x) + Math.sin(e.mesh.rotation.y) * 5,
        mapZ(e.z) + Math.cos(e.mesh.rotation.y) * 5,
      );
      ctx.stroke();
    }
  $("#awareness").textContent = game.boss
    ? "BOSS ENGAGED · WATCH WARNINGS"
    : game.spotted
      ? "SPOTTED · BREAK LINE OF SIGHT"
      : "UNSEEN · FLANK FOR REAR HITS";
  for (const v of game.rides)
    if (v.hp > 0) point(v.mesh.position.x, v.mesh.position.z, "#7ccef2", 3);
  for (const d of game.weaponDrops)
    point(d.mesh.position.x, d.mesh.position.z, "#dab3f4", 2);
  for (const p of game.pickups)
    point(
      p.position.x,
      p.position.z,
      p.userData.kind === "ammo"
        ? "#ffca65"
        : p.userData.kind === "shield"
          ? "#64d9ff"
          : "#63f397",
      2,
    );
  for (const p of game.prisons)
    if (!p.freed) {
      ctx.strokeStyle = "#57eaff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mapX(p.box.x) - 3, mapZ(p.box.z) - 3, 6, 6);
    }
  for (const a of game.squad.allies)
    if (a.mesh.visible)
      point(a.mesh.position.x, a.mesh.position.z, "#57eaff", 2);
  for (const t of game.treasures)
    point(
      t.position.x,
      t.position.z,
      t.userData.kind === "diamond" ? "#b4f6ff" : "#ffd166",
      2,
    );
  point(game.pos.x, game.pos.z, "#f6f5da", 3);
  if (!game.objective) point(m.objective.x, m.objective.z, "#e1ee93", 4);
  if (game.bossDead) point(m.extract.x, m.extract.z, "#88e9cd", 4);
}
$("#turbo").onclick = () => {
  if (mode === "playing") input.turbo = true;
};
$("#weapon-swap").onclick = () => {
  if (mode === "playing") input.swap = true;
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Tab" && !$("#overlay").hidden) {
    const buttons = Array.from(
      $("#overlay").querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
      ),
    );
    const first = buttons[0],
      last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (mode === "playing") pause();
    else if (mode === "paused") resume();
    else if (mode === "menu") $("#overlay").hidden = true;
    return;
  }
  if (mode !== "playing") return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  if (!e.repeat) {
    if (e.code === "KeyE") input.interact = true;
    if (e.code === "KeyR") input.reload = true;
    if (e.code === "KeyQ") input.swap = true;
    if (e.code === "KeyF") input.turbo = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") input.dodge = true;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  clearInput();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    pause();
  }
});
canvas.addEventListener("pointermove", (e) => {
  pointer.set(
    (e.clientX / innerWidth) * 2 - 1,
    (-e.clientY / innerHeight) * 2 + 1,
  );
  pointerSeen = true;
  $("#crosshair").style.left = `${e.clientX}px`;
  $("#crosshair").style.top = `${e.clientY}px`;
});
canvas.addEventListener("pointerdown", (e) => {
  if (mode === "playing" && e.button === 0) {
    pointer.set(
      (e.clientX / innerWidth) * 2 - 1,
      (-e.clientY / innerHeight) * 2 + 1,
    );
    pointerSeen = true;
    mouseDown = true;
    firePointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
  }
});
const releaseAim = (e: PointerEvent) => {
  if (e.pointerId === firePointer) {
    mouseDown = false;
    firePointer = null;
  }
};
window.addEventListener("pointerup", releaseAim);
window.addEventListener("pointercancel", releaseAim);
canvas.addEventListener("lostpointercapture", releaseAim);
for (const b of document.querySelectorAll<HTMLButtonElement>(
  "[data-hold],[data-action]",
)) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    if (mode !== "playing") return;
    if (e.isTrusted) b.setPointerCapture(e.pointerId);
    if (b.dataset.hold) {
      touchOwners.set(e.pointerId, b.dataset.hold);
      held.add(b.dataset.hold);
    }
    if (b.dataset.action)
      (input as unknown as Record<string, unknown>)[b.dataset.action] = true;
  };
  const release = (e: PointerEvent) => {
    const action = touchOwners.get(e.pointerId);
    touchOwners.delete(e.pointerId);
    if (action && ![...touchOwners.values()].includes(action))
      held.delete(action);
  };
  b.onpointerup = release;
  b.onpointercancel = release;
  b.onlostpointercapture = release;
}
window.addEventListener("resize", () => {
  clearInput();
  world?.resize();
});
let previous = performance.now(),
  acc = 0,
  lastHud = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const frameDelta = Math.max(0, (now - previous) / 1000);
  const dt = Math.min(frameDelta, 0.1);
  previous = now;
  if (!ready) return;
  if (mode === "playing") {
    input.x =
      Number(keys.has("KeyD") || keys.has("ArrowRight") || held.has("right")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft") || held.has("left")) +
      stick.x;
    input.z =
      Number(keys.has("KeyS") || keys.has("ArrowDown") || held.has("down")) -
      Number(keys.has("KeyW") || keys.has("ArrowUp") || held.has("up")) +
      stick.z;
    input.blast = keys.has("KeyB") || held.has("blast");
    input.assist = input.blast || keys.has("Space") || held.has("fire");
    input.fire = mouseDown || input.assist;
    ray.setFromCamera(pointer, world.camera);
    ray.ray.intersectPlane(ground, input.aim);
    if (game.phase === "dying") {
      // End-screen presentation follows elapsed time even when rendering is slow.
      acc = 0;
      game.update(frameDelta, input);
    } else if (game.feel.hitStop > 0) {
      // Hit-stop: hold the simulation for a few frames on heavy impacts.
      acc = 0;
    } else {
      acc += dt;
      while (acc >= 1 / 60) {
        game.update(1 / 60, input);
        acc -= 1 / 60;
      }
    }
    game.feel.decay(dt);
    feedback.update(game, world, $("#crosshair"), prefs.reduced);
    if (now - lastHud > 90) {
      updateHud();
      lastHud = now;
      // Command bosses bring the faster, drum-heavy version of the stage theme.
      const mission = MISSIONS[game.index];
      audio.playTheme(
        themeFor(mission.biome),
        mission.finale && game.bossSpawned,
      );
    }
  } else {
    acc = 0;
    if (mode === "result") game.updatePresentation(frameDelta);
  }
  $("#crosshair").hidden = mode !== "playing" || !pointerSeen || input.assist;
  world.shake =
    mode === "playing" && !prefs.reduced ? (game?.feel.trauma ?? 0) : 0;
  // The guide arrow follows the roads to the relay and extraction, and points
  // straight at the nearest guard or boss.
  const goal = mode === "playing" && game ? game.goal : null;
  world.guide = goal
    ? {
        goal,
        kind: goal.kind,
        point:
          goal.kind === "relay" || goal.kind === "extract"
            ? guidePoint(MISSIONS[game.index].roads, game.pos, goal)
            : goal,
      }
    : null;
  // The identity ring widens to sit around an occupied vehicle's hull.
  world.indicatorScale = game?.riding
    ? Math.max(1, game.riding.spec.radius * 1.2)
    : 1;
  world.render(
    now / 1000,
    game.pos,
    mode === "menu",
    prefs.reduced,
    game.hp > 0,
  );
}
async function init() {
  try {
    world = new World(canvas);
    world.quality(prefs.low);
    await loadAssets((n) => {
      $("#load").textContent = `${Math.round(n * 100)}%`;
    });
    game = new Game(world);
    feedback = new FeedbackUI(document.body);
    game.onRadio = radio;
    game.onSound = sound;
    game.onEnd = end;
    ready = true;
    menu();
    requestAnimationFrame(frame);
    // Test access is stripped from production builds by Vite.
    if (import.meta.env.DEV)
      (window as unknown as Record<string, unknown>).__nightfall = {
        game,
        input,
        get mode() {
          return mode;
        },
        get save() {
          return save;
        },
        start,
        world,
        audio,
      };
  } catch (error) {
    showOverlay(
      `<span class="eyebrow">FIELD KIT UNAVAILABLE</span><h2>Unable to enter the valley.</h2><p>Your browser needs WebGL 2 and access to the game model files. Try a current browser with hardware acceleration enabled.</p><button id="retry-load" class="primary">TRY AGAIN <span>↗</span></button>`,
    );
    $("#retry-load").onclick = () => location.reload();
    console.error(error);
  }
}
void init();
