import type { HitCause } from "./game";
import { BOSS_NAMES } from "./missions";

/**
 * The failure debrief names what took Ghost down and teaches its counter
 * (after Tidelock's reason-specific failure text). The portrait is the
 * attacker's 2.5D sprite sheet, front-facing idle frame, so no extra art.
 */
type Lesson = { who: string; line: string; tip: string; sprite?: string };
const LESSONS: Record<HitCause["cause"], Lesson> = {
  gunfire: {
    who: "RIFLE SQUAD",
    line: "Riflemen caught you in the open.",
    tip: "Their bursts stop at crates and walls. Fight from cover, and strafe while you fire.",
    sprite: "rifleman",
  },
  tank: {
    who: "ENEMY TANK",
    line: "An enemy tank shelled you.",
    tip: "Duck behind solid cover while its cannon reloads, or answer with the anti-armor missile or your own tank.",
    sprite: "tank-hostile",
  },
  rocket: {
    who: "ROCKET TROOPER",
    line: "A rocket found you.",
    tip: "Watch for the orange aiming line. Move sideways or break sight behind cover before it locks.",
    sprite: "rifleman-rocketeer",
  },
  thrower: {
    who: "KNIFE THROWER",
    line: "Thrown blades wore you down.",
    tip: "Throwers loose one visible blade at a time. Sidestep it, then return fire.",
    sprite: "rifleman-thrower",
  },
  rusher: {
    who: "KNIFE RUSHER",
    line: "A rusher closed the distance.",
    tip: "Rushers are fragile: shoot them first, and backstep or DODGE when their stab is warned.",
    sprite: "rifleman-rusher",
  },
  swordsman: {
    who: "SWORDSMAN",
    line: "A long-sword sweep caught you.",
    tip: "Step outside the orange arc, then strike while the sword recovers.",
    sprite: "rifleman-swordsman",
  },
  ninja: {
    who: "NINJA",
    line: "A ninja moved faster than your aim.",
    tip: "Ninjas run two to three times faster. Open fire early and DODGE when the arc flashes.",
    sprite: "ninja",
  },
  boss: {
    who: "COMMAND BOSS",
    line: "A command boss brought you down.",
    tip: "Every heavy attack is warned by orange rings or lines. Keep moving, use cover, and strike when it rests or vents.",
  },
  blast: {
    who: "EXPLOSION",
    line: "You were caught in a blast.",
    tip: "Fuel barrels and depots chain-explode. Shoot them from a distance, never when you stand beside them.",
  },
  rockfall: {
    who: "ROCKFALL",
    line: "Falling rocks crushed you.",
    tip: "Rocks land where the rings shake. Step out of the ring before it closes.",
  },
};
const GENERIC: Lesson = {
  who: "SIGNAL LOST",
  line: "Ghost went down.",
  tip: "Use cover to break enemy sightlines. Dodge when orange rings appear, and collect green health drops.",
};
/** Front-facing idle cell: column 0 (yaw 0) of the top row. */
const PEOPLE_FRAMES = 4;
const BIG = new Set(["tank-hostile", ...Object.keys(BOSS_NAMES)]);
/**
 * Background size and position that frame one sheet cell, zoomed `zoom`x on
 * its centre (people cells leave room for a fallen body, so they zoom in).
 */
function cellFrame(frames: number, zoom: number) {
  const w = 8 * zoom,
    h = frames * zoom;
  // Centre of the cell (0.5 cells in) lands on the centre of the portrait.
  const x = w > 1 ? ((zoom / 2 - 0.5) / (w - 1)) * 100 : 0;
  const y = h > 1 ? ((zoom / 2 - 0.5) / (h - 1)) * 100 : 0;
  return `background-size:${w * 100}% ${h * 100}%;background-position:${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

export function defeatLesson(hit: HitCause | undefined, bossTip?: string) {
  const lesson = hit ? LESSONS[hit.cause] : GENERIC;
  const name = hit?.boss ? BOSS_NAMES[hit.boss] : undefined;
  return {
    ...lesson,
    tip: (name && bossTip) || lesson.tip,
    who: name ?? lesson.who,
    line: name ? "Its heavy attack landed." : lesson.line,
    sprite: hit?.cause === "boss" ? hit.boss : lesson.sprite,
  };
}

export function defeatCard(
  hit: HitCause | undefined,
  base: string,
  bossTip?: string,
) {
  const l = defeatLesson(hit, bossTip);
  const portrait = l.sprite
    ? `<i class="defeat-portrait" style="background-image:url('${base}sprites/${l.sprite}.webp');${BIG.has(l.sprite) ? cellFrame(1, 1.15) : cellFrame(PEOPLE_FRAMES, 1.5)}"></i>`
    : `<i class="defeat-portrait defeat-glyph" style="background-image:url('${base}ui/hud-blast.png')"></i>`;
  return `<div class="defeat" data-cause="${hit?.cause ?? "unknown"}">${portrait}<div><span class="eyebrow">TAKEN DOWN BY</span><b>${l.who}</b><p>${l.line}</p><p class="defeat-tip"><em>COUNTER</em> ${l.tip}</p></div></div>`;
}
