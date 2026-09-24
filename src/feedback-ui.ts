import * as T from "three";
import type { Game } from "./game";
import type { World } from "./world";

/**
 * DOM presentation for Feel events: pooled floating damage numbers, crosshair
 * hit/kill markers, a directional damage arc around the player, kill-streak
 * banners and a low-health pulse. Everything is pooled and fixed-size so a
 * Crazy-difficulty firefight cannot flood the page.
 */
export class FeedbackUI {
  private layer = document.createElement("div");
  private pops: HTMLSpanElement[] = [];
  private arcs: HTMLDivElement[] = [];
  private banner = document.createElement("div");
  private nextPop = 0;
  private nextArc = 0;
  private point = new T.Vector3();
  private critical = false;
  constructor(parent: HTMLElement) {
    this.layer.id = "fx-layer";
    this.layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 18; i++) {
      const pop = document.createElement("span");
      pop.className = "dmg";
      this.pops.push(pop);
      this.layer.append(pop);
    }
    for (let i = 0; i < 4; i++) {
      const arc = document.createElement("div");
      arc.className = "hurt-arc";
      this.arcs.push(arc);
      this.layer.append(arc);
    }
    this.banner.id = "streak-banner";
    this.layer.append(this.banner);
    parent.append(this.layer);
  }
  private screen(x: number, y: number, z: number, camera: T.Camera) {
    this.point.set(x, y, z).project(camera);
    if (this.point.z > 1) return undefined;
    return {
      x: (this.point.x * 0.5 + 0.5) * innerWidth,
      y: (-this.point.y * 0.5 + 0.5) * innerHeight,
    };
  }
  clear() {
    for (const el of [...this.pops, ...this.arcs, this.banner])
      for (const a of el.getAnimations()) a.cancel();
    this.layer.classList.remove("critical");
    this.critical = false;
  }
  update(game: Game, world: World, crosshair: HTMLElement, reduced: boolean) {
    const { hits, hurts, banner } = game.feel.drain();
    // Shotgun pellets and turbo banks can land many hits a frame: show the latest few.
    let marker = "";
    for (const hit of hits.slice(-6)) {
      const at = this.screen(hit.x, hit.y, hit.z, world.camera);
      if (!at) continue;
      const pop = this.pops[this.nextPop++ % this.pops.length];
      const kill = hit.kind === "kill";
      pop.textContent = String(hit.damage);
      pop.className = "dmg " + hit.kind;
      pop.style.left = `${at.x + (Math.random() - 0.5) * 22}px`;
      pop.style.top = `${at.y}px`;
      for (const a of pop.getAnimations()) a.cancel();
      pop.animate(
        [
          { transform: "translate(-50%,-50%) scale(.55)", opacity: 0 },
          {
            transform: `translate(-50%,-95%) scale(${kill ? 1.35 : 1.1})`,
            opacity: 1,
            offset: 0.16,
          },
          { transform: "translate(-50%,-230%) scale(1)", opacity: 0 },
        ],
        { duration: kill ? 900 : 620, easing: "cubic-bezier(.2,.7,.3,1)" },
      );
      marker = kill ? "kill" : marker || "hit";
    }
    if (marker && !crosshair.hidden) {
      crosshair.classList.remove("hit", "kill");
      void crosshair.offsetWidth; // Restart the CSS marker animation.
      crosshair.classList.add(marker);
    }
    if (hurts.length) {
      const at = this.screen(game.pos.x, 1, game.pos.z, world.camera);
      for (const hurt of hurts.slice(-2)) {
        const arc = this.arcs[this.nextArc++ % this.arcs.length];
        arc.classList.toggle("all-round", hurt.angle === null);
        arc.style.left = `${at?.x ?? innerWidth / 2}px`;
        arc.style.top = `${at?.y ?? innerHeight / 2}px`;
        arc.style.setProperty(
          "--angle",
          `${hurt.angle === null ? 0 : hurt.angle}rad`,
        );
        for (const a of arc.getAnimations()) a.cancel();
        arc.animate(
          [{ opacity: Math.min(1, 0.55 + hurt.damage / 40) }, { opacity: 0 }],
          { duration: 750, easing: "ease-out" },
        );
      }
    }
    if (banner) {
      this.banner.innerHTML = `<b>${banner.label}</b>${banner.count > 1 ? `<span>×${banner.count}</span>` : ""}`;
      for (const a of this.banner.getAnimations()) a.cancel();
      this.banner.animate(
        reduced
          ? [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
          : [
              { transform: "translate(-50%,0) scale(1.6)", opacity: 0 },
              {
                transform: "translate(-50%,0) scale(1)",
                opacity: 1,
                offset: 0.12,
              },
              {
                transform: "translate(-50%,0) scale(1)",
                opacity: 1,
                offset: 0.78,
              },
              { transform: "translate(-50%,-12px) scale(.96)", opacity: 0 },
            ],
        { duration: 1500, easing: "ease-out" },
      );
    }
    const critical = game.hp > 0 && game.hp < game.maxHp * 0.3;
    if (critical !== this.critical) {
      this.critical = critical;
      this.layer.classList.toggle("critical", critical);
    }
  }
}
