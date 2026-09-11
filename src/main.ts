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
import { MISSIONS } from "./missions";
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
  radioUntil = 0,
  audio: AudioContext | undefined,
  lastShotSound = 0;
const app = $("#app");
app.innerHTML = `
<canvas id="scene" aria-label="Three-dimensional mission battlefield"></canvas>
<div class="vignette"></div><div id="crosshair" hidden><i></i></div>
<header id="brand"><a href="#" id="home" aria-label="Operation Nightfall briefing"><span class="brand-mark">R<span>///</span></span><span class="brand-name">RAMBO <b>3D</b><small>OPERATION NIGHTFALL</small></span></a><div class="header-right"><span class="status-dot"></span> FIELD OPERATIONS <span class="divider">/</span> <span>EST. 1985</span><button id="sound" class="icon-button" aria-label="Toggle sound">SOUND ON</button></div></header>
<main id="menu" class="menu"><section class="hero"><div class="eyebrow"><span></span> BEHIND ENEMY LINES. AGAIN.</div><h1>THE MISSION<br>IS <em>PERSONAL.</em></h1><p class="hero-copy">They left your people behind.<br>You came back for them.</p><div class="hero-rule"></div><div class="operation-line"><span>01—21</span><p>SEVEN STAGES. THREE LEVELS EACH.<br>EVERYONE COMES HOME.</p></div><div id="launch-area"><button class="primary" disabled id="deploy">PREPARING FIELD KIT <span id="load">0%</span></button></div><div class="difficulty"><span>ENGAGEMENT</span><button data-difficulty="easy">EASY</button><button data-difficulty="normal" class="selected">NORMAL</button><button data-difficulty="hard">HARD</button><button data-difficulty="crazy">CRAZY</button></div><p class="small-note" id="difficulty-note">Easy: more health · Hard: 2× soldiers · Crazy: 4× soldiers and four finale bosses.</p><label class="stage-picker">STAGE <select id="stage-select" aria-label="Choose stage"></select></label></section>
<aside class="intel"><div class="intel-top"><span class="live-dot"></span> LIVE RECON <span>SECTOR 07</span></div><div class="intel-map"><div class="scan"></div><div class="coordinate c1">17°04′ N</div><div class="coordinate c2">106°42′ E</div><div class="map-line l1"></div><div class="map-line l2"></div><span class="map-dot d1"></span><span class="map-dot d2"></span><span class="map-dot d3"></span><span class="map-label">KHE SAN VALLEY</span></div><div class="intel-bottom"><span>MISSION BRIEF / <b id="brief-number">01</b></span><h2 id="brief-title">Emerald Killbox</h2><p id="brief-copy"></p><div class="intel-meta"><span>◆ SOLO CAMPAIGN</span><span>● 3D TACTICAL ACTION</span></div></div></aside>
<section class="campaign" aria-label="Campaign missions"><div class="campaign-heading"><span>CHOOSE YOUR NEXT FRONT</span><span>CAMPAIGN / NIGHTFALL</span></div><div id="mission-cards" class="mission-cards"></div></section>
<footer class="menu-footer"><span>AN ORIGINAL LOW-POLY COMBAT EXPERIENCE <b id="best-score"></b></span><button id="controls-open">FIELD MANUAL <span>↗</span></button><span>BUILT WITH BLENDER + THREE.JS</span></footer></main>
<section id="hud" hidden aria-label="Mission status"><div class="hud-top"><div class="objective-panel"><span class="eyebrow" id="mission-label"></span><h2 id="mission-title"></h2><div id="objectives"></div></div><div class="hud-right"><button class="icon-button" id="pause">Ⅱ <span>PAUSE</span></button><canvas id="minimap" width="144" height="144" aria-label="Tactical map: road pale green, player white, enemies orange, weapons purple, medical green, shields blue, relay yellow"></canvas><span class="map-caption" id="route-direction">NORTHBOUND ROUTE</span></div></div><div id="boss-panel" hidden><div><b id="boss-name"></b><span id="boss-phase">ARMORED TARGET</span></div><div class="boss-track"><i id="boss-bar"></i></div></div><div id="radio" role="status"><span>VALE / RADIO</span><p></p></div><div id="interact-prompt" hidden></div><div class="hud-bottom"><div class="health-panel"><div class="hud-kicker">GHOST <span id="health-text"></span></div><div class="health-track"><i id="health-bar"></i></div><div id="shield-text" aria-label="Personal shield">SHIELD 0 / 80</div><div class="health-meta"><span id="dash-text">DODGE READY</span><span id="score">000000</span></div></div><div class="controls-strip"><kbd>WASD</kbd> MOVE <kbd>SPACE</kbd> AUTO FIRE <kbd>E</kbd> INTERACT <kbd>SHIFT</kbd> DODGE</div><div class="ammo-panel"><div id="weapon-name">M4 / ASSAULT RIFLE</div><strong id="ammo">24</strong><span id="ammo-reserve">/ ∞</span><small id="reload-label">R RELOAD · Q SWITCH</small><button id="weapon-swap" aria-label="Switch weapon" aria-keyshortcuts="Q" title="Press Q to cycle collected weapons">Q - SWAP WEAPON</button></div></div><div id="touch"><div class="dpad"><button data-hold="up" aria-label="Move forward">▲</button><button data-hold="left" aria-label="Move left">◀</button><button data-hold="down" aria-label="Move backward">▼</button><button data-hold="right" aria-label="Move right">▶</button></div><div class="touch-actions"><button data-action="swap" aria-label="Switch weapon" class="swap-weapon">SWAP WEAPON</button><button data-action="reload">RELOAD</button><button data-action="interact" aria-label="Use nearby objective">USE</button><button data-action="dodge">DODGE</button><button data-hold="fire" class="fire">FIRE</button></div></div></section>
<div id="overlay" class="overlay" hidden></div><div id="toast" role="status" hidden></div>`;
const canvas = $<HTMLCanvasElement>("#scene");
let world: World, game: Game;
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
};
const keys = new Set<string>(),
  held = new Set<string>();
const touchOwners = new Map<number, string>();
let firePointer: number | null = null;
let mouseDown = false,
  pointer = new T.Vector2(),
  pointerSeen = false;
const ray = new T.Raycaster(),
  ground = new T.Plane(new T.Vector3(0, 1, 0), -0.9);
function clearInput() {
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
}
function sound(type: string) {
  if (!prefs.sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    if (type === "shot" && now - lastShotSound < 0.08) return;
    if (type === "shot") lastShotSound = now;
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    const notes: Record<string, [number, number, number]> = {
      shot: [125, 45, 0.07],
      hit: [260, 70, 0.06],
      explosion: [65, 22, 0.3],
      objective: [480, 960, 0.3],
      reload: [230, 320, 0.09],
      dash: [380, 70, 0.16],
      damage: [100, 40, 0.15],
    };
    const [a, b, d] = notes[type] ?? notes.hit;
    oscillator.type = type === "objective" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(a, now);
    oscillator.frequency.exponentialRampToValueAtTime(b, now + d);
    gain.gain.setValueAtTime(type === "shot" ? 0.035 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + d);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(now + d + 0.01);
  } catch {}
}
function radio(text: string) {
  $("#radio p").textContent = text;
  radioUntil = performance.now() + 9000;
  $("#radio").classList.add("visible");
}
function syncSound() {
  $("#sound").textContent = prefs.sound ? "SOUND ON" : "SOUND OFF";
  $("#sound").setAttribute("aria-pressed", String(prefs.sound));
  write("nightfall-prefs", { ...prefs, difficulty });
}
$("#sound").onclick = () => {
  prefs.sound = !prefs.sound;
  syncSound();
};
syncSound();
function menu() {
  mode = "menu";
  clearInput();
  $("#menu").hidden = false;
  $("#brand").hidden = false;
  $("#hud").hidden = true;
  $("#overlay").hidden = true;
  $("#crosshair").hidden = true;
  document.body.classList.remove("in-game");
  const index = previewMission ?? (save.completed ? 0 : save.mission),
    m = MISSIONS[index];
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
      `<article class="mission-card ${i === m.stage ? "active" : ""}"><div class="card-num">${i + 1}</div><div><span class="card-tag">THREE LEVELS / BOSS FINALE</span><h3>${stage.name}</h3><p>${stage.tip}</p></div></article>`,
  ).join("");
  const picker = $<HTMLSelectElement>("#stage-select");
  picker.innerHTML = STAGES.map(
    (stage, i) =>
      `<option value="${i}" ${i === m.stage ? "selected" : ""}>${i + 1}. ${stage.name}</option>`,
  ).join("");
  picker.onchange = () => {
    previewMission = Number(picker.value) * 3;
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
  $("#launch-area").innerHTML =
    `<button class="primary" id="deploy" ${ready ? "" : "disabled"}>${save.completed ? "REPLAY CAMPAIGN" : save.mission > 0 ? "CONTINUE OPERATION" : "DEPLOY TO STAGE"} <span>↗</span></button>${save.mission > 0 && !save.completed ? '<button class="text-button" id="new-campaign">START NEW CAMPAIGN</button>' : ""}`;
  $("#deploy").onclick = () => {
    if (previewMission !== undefined) {
      save = { ...freshSave(), mission: previewMission, best: save.best };
      previewMission = undefined;
      write("nightfall-campaign", save);
    }
    if (save.completed) {
      save = { ...freshSave(), best: save.best };
      write("nightfall-campaign", save);
    }
    start();
  };
  const reset = document.querySelector<HTMLButtonElement>("#new-campaign");
  if (reset)
    reset.onclick = () => {
      showOverlay(
        `<span class="eyebrow">NEW CAMPAIGN</span><h2>Back to the beginning?</h2><p>This resets mission progress and upgrades. Your best score is kept.</p><button class="primary" id="confirm-new">START OVER <span>↗</span></button><button class="text-button" id="cancel-new">KEEP MY PROGRESS</button>`,
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
function start() {
  if (!ready) return;
  clearInput();
  game.start(save.mission, save, difficulty);
  world.marker.visible = true;
  mode = "playing";
  $("#menu").hidden = true;
  $("#brand").hidden = true;
  $("#hud").hidden = false;
  $("#overlay").hidden = true;
  document.body.classList.add("in-game");
  radio(MISSIONS[save.mission].radio);
  sound("objective");
  canvas.focus();
}
function showOverlay(html: string) {
  const overlay = $("#overlay");
  overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="Mission panel">${html}</section>`;
  overlay.hidden = false;
  overlay.querySelector<HTMLButtonElement>("button")?.focus();
}
function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  clearInput();
  showOverlay(
    `<span class="eyebrow">SIGNAL ON HOLD</span><h2>Take a breath.</h2><p>The battlefield will wait.</p><button id="resume" class="primary">RESUME OPERATION <span>↗</span></button><div class="settings"><label><span>Sound effects</span><input id="setting-sound" type="checkbox" ${prefs.sound ? "checked" : ""}></label><label><span>Graphics detail</span><select id="setting-low" aria-label="Graphics detail"><option value="low" ${prefs.low ? "selected" : ""}>Low · Mobile / battery saver</option><option value="high" ${!prefs.low ? "selected" : ""}>High · PC / detailed visuals</option></select></label><label><span>Reduce camera motion</span><input id="setting-motion" type="checkbox" ${prefs.reduced ? "checked" : ""}></label></div><div class="modal-actions"><button id="restart">RESTART MISSION</button><button id="to-menu">MISSION BRIEFING</button></div><p class="small-note">WASD / arrows move · Mouse aims · Click / Space fires<br>R reload · Q switch · E interact · Shift dodge · Esc pause</p>`,
  );
  $("#resume").onclick = resume;
  $("#restart").onclick = start;
  $("#to-menu").onclick = menu;
  $<HTMLInputElement>("#setting-sound").onchange = (e) => {
    prefs.sound = (e.target as HTMLInputElement).checked;
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
    `<span class="eyebrow">FIELD MANUAL / 01</span><h2>Get in. Get them out.</h2><p>Each stage has three long levels. Secure the yellow relay and clear its guards; level three has command bosses. Defeat every boss to open green extraction.</p><div class="manual-grid"><span>WASD / ARROWS</span><b>Move</b><span>MOUSE + CLICK</span><b>Aim and fire</b><span>HOLD SPACE</span><b>Assisted aim and fire</b><span>SHIFT + MOVE</span><b>Dodge incoming fire</b><span>E / R / Q</span><b>Interact / reload / switch</b><span>ESCAPE</span><b>Pause and settings</b></div><p>Orange rings warn of attacks and volcanic rockfalls. Ice slides, sand slows to one quarter, and mud holes gradually sink you. Quake dust signals a brief ground-enemy freeze. Shoot fuel drums for chain explosions and blast jungle trees to clear a path. Drive a moving tank over infantry to crush them. Orange rings warn of an attack. Crates stop bullets. Green pickups restore health. The scattergun excels at close range. Blue map dots mark vehicles: E / USE boards or exits. Purple dots mark weapons: walk over them to collect, then Q / WEAPON cycles your loadout. Motorcycles use your selected weapon; jeeps have 20 shotgun rounds and tanks have five missiles. Exit to use objectives or extract. Touch controls appear on touch devices.</p><button id="close-manual" class="primary">READY FOR THE FIELD <span>↗</span></button>`,
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
      `${difficulty.toUpperCase()}: ${config.health} health / ${config.soldiers}x soldiers / ${config.bosses} boss${config.bosses > 1 ? "es" : ""} in each finale.`;
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
  mode = "result";
  clearInput();
  const m = MISSIONS[game.index],
    final = win && game.index === LEVEL_COUNT - 1;
  if (final) {
    save = advanceCampaign(save, "armor", game.score);
    write("nightfall-campaign", save);
  }
  showOverlay(
    `<span class="eyebrow">${win ? "TRANSMISSION RECEIVED" : "SIGNAL LOST"} / 0${game.index + 1}</span><h2>${final ? "Everyone comes home." : win ? "Mission accomplished." : "Not your last stand."}</h2><p>${win ? m.success : "Use cover to break enemy sightlines. Dodge when orange rings appear, and collect green health drops. Your completed campaign progress is safe."}</p><div class="result-stats"><div><b>${game.score.toLocaleString()}</b><span>MISSION SCORE</span></div><div><b>${game.kills}</b><span>TARGETS DOWN</span></div><div><b>${formatTime(game.elapsed)}</b><span>FIELD TIME</span></div></div>${win && !final ? '<span class="eyebrow">CHOOSE YOUR NEXT ADVANTAGE</span><div class="upgrades"><button data-upgrade="armor"><b>01 / FIELD ARMOR</b><span>+35 maximum health</span></button><button data-upgrade="power"><b>02 / TUNED WEAPONS</b><span>+20% base damage</span></button><button data-upgrade="mobility"><b>03 / LIGHT KIT</b><span>−0.55s dodge cooldown</span></button></div>' : `<button id="result-primary" class="primary">${win ? "RETURN TO BRIEFING" : "RETRY MISSION"} <span>↗</span></button>`}${!win ? '<button id="result-menu" class="text-button">MISSION BRIEFING</button>' : ""}`,
  );
  for (const b of document.querySelectorAll<HTMLButtonElement>(
    "[data-upgrade]",
  ))
    b.onclick = () => {
      save = advanceCampaign(save, b.dataset.upgrade, game.score);
      write("nightfall-campaign", save);
      menu();
    };
  const primary = document.querySelector<HTMLButtonElement>("#result-primary");
  if (primary) primary.onclick = win ? menu : start;
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
  $("#objectives").innerHTML =
    `<span class="${game.objective ? "done" : ""}">${game.objective ? "✓" : "◇"} ${m.action}</span><span class="${game.bossDead ? "done" : ""}">${game.bossDead ? "✓" : "◇"} Neutralize ${m.finale ? "all command bosses" : "relay guards"}</span><span class="${game.bossDead ? "current" : ""}">◇ Reach extraction</span>`;
  $("#route-direction").textContent = m.direction + " ROUTE";
  $("#health-text").textContent = `${Math.ceil(game.hp)} / ${game.maxHp}`;
  $("#shield-text").textContent =
    `SHIELD ${Math.ceil(game.shield)} / ${game.maxShield}`;
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
  $("#score").textContent = `${game.score.toString().padStart(6, "0")} PTS`;
  const ride = game.riding;
  $("#weapon-name").textContent = ride
    ? ride.spec.name +
      " / " +
      (ride.kind === "tank"
        ? "MISSILES"
        : ride.kind === "jeep"
          ? "MOUNTED SHOTGUN"
          : game.weaponSpec.name)
    : game.weaponSpec.name;
  $("#ammo-reserve").textContent =
    ride && ride.kind !== "motorcycle"
      ? "/ VEHICLE AMMO"
      : Number.isFinite(game.reserves[game.weapon])
        ? "/ " + game.reserves[game.weapon]
        : "/ ∞";
  $("#ammo").textContent = (
    ride && ride.kind !== "motorcycle" ? ride.ammo : game.ammo
  )
    .toString()
    .padStart(2, "0");
  $("#reload-label").textContent =
    game.reloadTime > 0
      ? `RELOADING ${game.reloadTime.toFixed(1)}s`
      : ride && ride.kind !== "motorcycle"
        ? "LIMITED AMMO · USE TO EXIT"
        : "R RELOAD · Q SWITCH";
  const mountedGun = Boolean(ride && ride.kind !== "motorcycle");
  for (const button of [$("#weapon-swap"), $('[data-action="swap"]')]) {
    (button as HTMLButtonElement).disabled = mountedGun;
    button.title = mountedGun
      ? "Exit the vehicle to switch personal weapons"
      : "Cycle collected weapons (Q on keyboard)";
  }
  $("#weapon-swap").textContent = mountedGun
    ? "MOUNTED GUN - EXIT TO SWAP"
    : "Q - SWAP WEAPON";
  $('[data-action="swap"]').textContent = mountedGun
    ? "MOUNTED GUN"
    : "SWAP WEAPON";
  const boss = game.boss;
  $("#boss-panel").hidden = !boss;
  if (boss) {
    const bosses = game.enemies.filter((e) => e.boss && e.hp > 0);
    $("#boss-name").textContent = `${m.boss} / ${bosses.length} REMAIN`;
    $("#boss-bar").style.width =
      `${(100 * bosses.reduce((n, e) => n + e.hp, 0)) / bosses.reduce((n, e) => n + e.max, 0)}%`;
    $("#boss-phase").textContent = boss.state ?? "ARMORED TARGET";
  }
  const d = Math.hypot(game.pos.x - m.objective.x, game.pos.z - m.objective.z),
    prompt = $("#interact-prompt");
  prompt.hidden = game.objective || d >= 3;
  prompt.innerHTML = `<kbd>E</kbd> ${m.action.toUpperCase()} <span>/ TAP USE</span>`;
  if (game.interaction) {
    prompt.hidden = false;
    prompt.innerHTML =
      "<kbd>E</kbd> " + game.interaction + " <span>/ TAP USE</span>";
  }
  const useButton = $('[data-action="interact"]');
  useButton.textContent = game.riding
    ? "EXIT"
    : game.nearestRide
      ? "BOARD"
      : "USE";
  if (
    game.bossDead &&
    game.companion &&
    Math.hypot(game.pos.x - m.extract.x, game.pos.z - m.extract.z) < 2.5 &&
    Math.hypot(
      game.companion.position.x - m.extract.x,
      game.companion.position.z - m.extract.z,
    ) >= 5
  ) {
    prompt.hidden = false;
    prompt.textContent = "WAIT FOR MARA TO REACH EXTRACTION";
  }
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
  ctx.strokeStyle = "#83988d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  m.route.forEach((p, i) =>
    i ? ctx.lineTo(mapX(p.x), mapZ(p.z)) : ctx.moveTo(mapX(p.x), mapZ(p.z)),
  );
  ctx.stroke();
  const point = (x: number, z: number, color: string, r: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mapX(x), mapZ(z), r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const e of game.enemies)
    if (e.hp > 0) point(e.x, e.z, "#f29b68", e.boss ? 4 : 2);
  for (const v of game.rides)
    if (v.hp > 0) point(v.mesh.position.x, v.mesh.position.z, "#7ccef2", 3);
  for (const d of game.weaponDrops)
    point(d.mesh.position.x, d.mesh.position.z, "#dab3f4", 2);
  for (const p of game.pickups)
    point(
      p.position.x,
      p.position.z,
      p.userData.kind === "shield" ? "#64d9ff" : "#63f397",
      2,
    );
  point(game.pos.x, game.pos.z, "#f6f5da", 3);
  if (!game.objective) point(m.objective.x, m.objective.z, "#e1ee93", 4);
  if (game.bossDead) point(m.extract.x, m.extract.z, "#88e9cd", 4);
}
$("#weapon-swap").onclick = () => {
  if (mode === "playing") input.swap = true;
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Tab" && !$("#overlay").hidden) {
    const buttons = Array.from(
      $("#overlay").querySelectorAll<HTMLElement>("button,input,select"),
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
window.addEventListener("resize", () => world?.resize());
let previous = performance.now(),
  acc = 0,
  lastHud = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (!ready) return;
  if (mode === "playing") {
    input.x =
      Number(keys.has("KeyD") || keys.has("ArrowRight") || held.has("right")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft") || held.has("left"));
    input.z =
      Number(keys.has("KeyS") || keys.has("ArrowDown") || held.has("down")) -
      Number(keys.has("KeyW") || keys.has("ArrowUp") || held.has("up"));
    input.assist = keys.has("Space") || held.has("fire");
    input.fire = mouseDown || input.assist;
    ray.setFromCamera(pointer, world.camera);
    ray.ray.intersectPlane(ground, input.aim);
    acc += dt;
    while (acc >= 1 / 60) {
      game.update(1 / 60, input);
      acc -= 1 / 60;
    }
    if (now - lastHud > 90) {
      updateHud();
      lastHud = now;
    }
  } else {
    acc = 0;
    if (mode === "result") game.updatePresentation(dt);
  }
  $("#crosshair").hidden = mode !== "playing" || !pointerSeen || input.assist;
  world.render(now / 1000, game.pos, mode === "menu", prefs.reduced);
}
async function init() {
  try {
    world = new World(canvas);
    world.quality(prefs.low);
    await loadAssets((n) => {
      $("#load").textContent = `${Math.round(n * 100)}%`;
    });
    game = new Game(world);
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
