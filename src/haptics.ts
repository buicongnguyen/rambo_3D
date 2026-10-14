/**
 * Short phone vibrations for hits, Ghost going down and boss arrivals (after
 * RAMBO v3's rumble). Android browsers vibrate; iPhones ignore the API, so
 * the setting is only offered where it can work. Hits are rate-limited so a
 * shotgun volley is one buzz, not a drone.
 */
export class Haptics {
  enabled = true;
  /** Buzzes sent (tests read this). */
  sent = 0;
  private quietUntil = 0;
  readonly supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  /** Offer the setting on touch devices that have the API. */
  get offered() {
    return this.supported && matchMedia("(pointer: coarse)").matches;
  }
  private buzz(pattern: number | number[], gap: number) {
    if (!this.enabled || !this.supported) return;
    const now = performance.now();
    if (now < this.quietUntil) return;
    this.quietUntil = now + gap;
    this.sent++;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some embedded browsers throw without a user gesture; stay silent.
    }
  }
  hurt(damage: number) {
    this.buzz(damage >= 20 ? 45 : 22, 140);
  }
  down() {
    this.buzz([60, 50, 140], 600);
  }
  boss() {
    this.buzz([40, 60, 40, 60, 90], 600);
  }
  stop() {
    this.quietUntil = 0;
    if (this.supported) navigator.vibrate(0);
  }
}
