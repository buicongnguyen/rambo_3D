/**
 * Procedural game audio (Web Audio, no sample files): layered weapon and
 * explosion effects, pickup and warning cues, and short music stingers for
 * deploying, winning, losing and special moments. Effects are rate-limited and
 * voice-capped so a Crazy-difficulty firefight cannot flood the mixer.
 */
export type SoundOptions = {
  /** 0..1 loudness scale, e.g. from distance to the player. */
  gain?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
};

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Minimum spacing (s) between repeats of the same cue. */
const SPACING: Record<string, number> = {
  "fire:machineGun": 0.04,
  "fire:rifle": 0.06,
  "fire:flame": 0.09,
  enemyShot: 0.07,
  allyShot: 0.08,
  hit: 0.06,
  armor: 0.07,
  kill: 0.05,
  explosion: 0.05,
  coin: 0.05,
  damage: 0.12,
  warn: 0.4,
};
const STINGERS = new Set([
  "start",
  "win",
  "lose",
  "rampage",
  "bossDown",
  "bossIntro",
]);
type Note = [beat: number, note: number, beats: number, voice: string];
/**
 * Short music stingers (no loops): each is a one-shot burst of roughly twenty
 * synthesized notes lasting two seconds or less, so music never costs frames.
 */
const SONGS: Record<string, { bpm: number; notes: Note[] }> = {
  // Command bosses arrive: two dark minor hits, then an unresolved dominant.
  bossIntro: {
    bpm: 120,
    notes: [
      [0, 0, 0.5, "kick"],
      [0, 43, 1.2, "bass"],
      [0, 55, 0.4, "lead"],
      [0, 58, 0.4, "lead2"],
      [0.75, 0, 0.5, "kick"],
      [0.75, 55, 0.4, "lead"],
      [0.75, 58, 0.4, "lead2"],
      [1.5, 0, 1, "kick"],
      [1.5, 0, 1.5, "crash"],
      [1.5, 38, 1.6, "bass"],
      [1.5, 54, 1.6, "lead"],
      [1.5, 57, 1.6, "lead2"],
      [1.5, 62, 1.6, "lead2"],
    ],
  },
  start: {
    bpm: 150,
    notes: [
      [0, 0, 0.25, "snare"],
      [0.25, 0, 0.25, "snare"],
      [0.5, 0, 0.25, "snare"],
      [0.75, 0, 0.25, "snare"],
      [1, 0, 1, "kick"],
      [1, 67, 0.45, "lead"],
      [1.5, 72, 0.45, "lead"],
      [2, 76, 0.45, "lead"],
      [2.5, 79, 1.5, "lead"],
      [1, 48, 3, "bass"],
      [2.5, 0, 1, "crash"],
      [2.5, 0, 1, "kick"],
    ],
  },
  win: {
    bpm: 140,
    notes: [
      [0, 72, 0.3, "lead"],
      [0.33, 76, 0.3, "lead"],
      [0.66, 79, 0.3, "lead"],
      [1, 84, 1.4, "lead"],
      [1, 76, 1.4, "lead2"],
      [1, 79, 1.4, "lead2"],
      [2.5, 79, 0.45, "lead"],
      [3, 84, 1.3, "lead"],
      [3, 88, 1.3, "lead2"],
      [0, 48, 1, "bass"],
      [1, 43, 1.5, "bass"],
      [2.5, 48, 1.8, "bass"],
      [0, 0, 1, "kick"],
      [1, 0, 1, "kick"],
      [1, 0, 1, "crash"],
      [2.5, 0, 1, "snare"],
      [3, 0, 1, "kick"],
      [3, 0, 1.2, "crash"],
    ],
  },
  lose: {
    bpm: 128,
    notes: [
      [0, 64, 0.9, "lead"],
      [1, 63, 0.9, "lead"],
      [2, 62, 0.9, "lead"],
      [3, 61, 1, "lead"],
      [0, 45, 4, "bass"],
      [0, 0, 1, "kick"],
      [3, 0, 1, "kick"],
    ],
  },
  rampage: {
    bpm: 180,
    notes: [
      [0, 69, 0.22, "lead"],
      [0.25, 73, 0.22, "lead"],
      [0.5, 76, 0.22, "lead"],
      [0.75, 81, 1, "lead"],
      [0.75, 76, 1, "lead2"],
      [0, 0, 0.25, "snare"],
      [0.25, 0, 0.25, "snare"],
      [0.5, 0, 0.25, "snare"],
      [0.75, 0, 1, "crash"],
      [0.75, 0, 1, "kick"],
      [0.75, 45, 1, "bass"],
    ],
  },
  bossDown: {
    bpm: 150,
    notes: [
      [0, 67, 0.22, "lead"],
      [0.25, 71, 0.22, "lead"],
      [0.5, 74, 0.22, "lead"],
      [0.75, 79, 1.4, "lead"],
      [0.75, 74, 1.4, "lead2"],
      [0.75, 71, 1.4, "lead2"],
      [0.75, 43, 1.4, "bass"],
      [0, 0, 0.5, "kick"],
      [0.75, 0, 1, "kick"],
      [0.75, 0, 1.5, "crash"],
    ],
  },
};
/** Length of a stinger in seconds, including note release. */
export function stingerSeconds(type: string) {
  const song = SONGS[type];
  if (!song) return 0;
  const end = Math.max(...song.notes.map(([at, , beats]) => at + beats));
  return (end * 60) / song.bpm + 0.15;
}

const MAX_VOICES = 36;
/** Background themes sit well under effects (normalised loops peak at 0.5). */
const THEME_GAIN = 0.5;
/**
 * Loudness trims (dB) measured from offline renders: guns stay small (about
 * 15 dB under explosions), hostile fire sits under the player's, and stingers
 * and blasts land around -6 to -10 dBFS before the bus compressor.
 */
const TRIM_DB: Record<string, number> = {
  "fire:rifle": 18,
  "fire:machineGun": 18,
  "fire:shotgun": 14,
  "fire:sniper": 14,
  "fire:flame": 18,
  "fire:launcher": 12,
  "fire:explosiveArrow": 16,
  "fire:missile": 12,
  "fire:laser": 16,
  cannon: 10,
  throw: 22,
  enemyShot: 16,
  enemyCannon: 10,
  allyShot: 20,
  explosion: 11,
  hit: 16,
  armor: 16,
  kill: 16,
  damage: 12,
  reload: 16,
  dash: 20,
  coin: 12,
  pickup: 16,
  rescue: 12,
  objective: 10,
  streak: 14,
  warn: 12,
  start: 8,
  win: 6,
  lose: 9,
  rampage: 8,
  bossDown: 4,
  bossIntro: 5,
};

export class GameAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private sfx?: GainNode;
  private music?: GainNode;
  private noise?: AudioBuffer;
  private last = new Map<string, number>();
  private voices = 0;
  private effectsOn = true;
  private musicOn = true;
  // Background theme: pre-rendered loops. Stage themes play as two synced
  // stems (base + combat layer); boss arrangements as one full loop.
  private unlocked = false;
  private themeKey = "";
  private themeSource?: AudioBufferSourceNode;
  private combatSource?: AudioBufferSourceNode;
  private themeGain?: GainNode;
  private combatGain?: GainNode;
  private themeFilter?: BiquadFilterNode;
  private themeLevel = 1;
  /** Combat layer level (0-1), driven by the game's combat intensity. */
  intensity = 0;
  /** Low-pass on the music (0 open, 1 muffled): low health and slow motion. */
  muffle = 0;
  private themes = new Map<string, Promise<AudioBuffer>>();
  private stems = new Map<string, Promise<[AudioBuffer, AudioBuffer]>>();

  static isMusic(type: string) {
    return STINGERS.has(type);
  }
  /** Apply the settings; switching everything off silences playback at once. */
  configure(effects: boolean, music: boolean) {
    this.effectsOn = effects;
    this.musicOn = music;
    if (!this.ctx) return;
    this.music!.gain.value = music ? 0.6 : 0;
    this.sfx!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.sfx!.gain.value = effects ? 1 : 0;
    if (!music) this.stopTheme(0.2);
    else if (this.themeKey && !this.themeSource) this.startTheme(0);
    if (!effects && !music) void this.ctx.suspend();
  }

  /** Browsers only allow audio after a user gesture: start any pending theme. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.themeKey && (this.effectsOn || this.musicOn)) this.startTheme(0);
  }

  /**
   * Loop a background theme ("" stops it). Each theme is rendered once, off the
   * main thread, and replayed from a single looping buffer: no per-frame work.
   */
  playTheme(name: string, boss = false, delay = 0) {
    const key = name ? `${name}${boss ? ":boss" : ""}` : "";
    if (key === this.themeKey) return;
    this.themeKey = key;
    this.stopTheme(key ? 0.9 : 0.5);
    if (key && this.musicOn && this.unlocked) this.startTheme(delay);
  }

  /** Render a theme ahead of time so it starts the moment it is needed. */
  prefetch(name: string, boss = false) {
    if (!this.musicOn) return;
    if (boss) void this.theme(`${name}:boss`);
    else void this.stemPair(name);
  }

  /** Fade the combat stem in or out (0-1) without restarting the loop. */
  setIntensity(level: number) {
    this.intensity = Math.min(1, Math.max(0, level));
    if (this.combatGain && this.ctx)
      this.combatGain.gain.setTargetAtTime(
        this.intensity,
        this.ctx.currentTime,
        0.12,
      );
  }

  /** Muffle the music (0 open to 1 closed), e.g. at low health or in slow motion. */
  setMuffle(amount: number) {
    this.muffle = Math.min(1, Math.max(0, amount));
    if (this.themeFilter && this.ctx)
      this.themeFilter.frequency.setTargetAtTime(
        this.cutoff(),
        this.ctx.currentTime,
        0.15,
      );
  }

  private cutoff() {
    return 20000 * (650 / 20000) ** this.muffle;
  }

  /** Lower the theme (e.g. while paused) without restarting it. */
  setThemeLevel(level: number) {
    this.themeLevel = level;
    if (this.themeGain && this.ctx)
      this.themeGain.gain.setTargetAtTime(
        THEME_GAIN * level,
        this.ctx.currentTime,
        0.25,
      );
  }

  private theme(key: string) {
    let buffer = this.themes.get(key);
    if (!buffer) {
      const [name, variant] = key.split(":");
      // Loaded on demand: the synth code is not needed until music plays.
      buffer = import("./music-render").then((m) =>
        m.renderTheme(name, variant === "boss"),
      );
      this.themes.set(key, buffer);
      // Keep at most two full loops (boss arrangements) in memory.
      if (this.themes.size > 2)
        this.themes.delete(this.themes.keys().next().value!);
    }
    return buffer;
  }

  private stemPair(name: string) {
    let pair = this.stems.get(name);
    if (!pair) {
      pair = import("./music-render").then((m) => m.renderStems(name));
      this.stems.set(name, pair);
      // The title and one stage theme: two stem pairs at most.
      if (this.stems.size > 2)
        this.stems.delete(this.stems.keys().next().value!);
    }
    return pair;
  }

  private startTheme(delay: number) {
    const key = this.themeKey;
    try {
      const ctx = this.ensure();
      const [name, variant] = key.split(":");
      const ready: Promise<AudioBuffer[]> =
        variant === "boss"
          ? this.theme(key).then((b) => [b])
          : this.stemPair(name);
      void ready.then((buffers) => {
        if (key !== this.themeKey || !this.musicOn || this.themeSource) return;
        const at = ctx.currentTime + delay;
        const gain = ctx.createGain(),
          filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.Q.value = 0.5;
        filter.frequency.value = this.cutoff();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(
          THEME_GAIN * this.themeLevel,
          at + 1.6,
        );
        gain.connect(filter).connect(this.music!);
        // Stems start on the same sample and share one length: phase-locked.
        const sources = buffers.map((buffer, i) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          if (i === 1) {
            const layer = ctx.createGain();
            layer.gain.value = this.intensity;
            source.connect(layer).connect(gain);
            this.combatGain = layer;
          } else source.connect(gain);
          source.start(at);
          return source;
        });
        this.themeSource = sources[0];
        this.combatSource = sources[1];
        this.themeGain = gain;
        this.themeFilter = filter;
      });
    } catch {
      // Music is optional.
    }
  }

  private stopTheme(fade: number) {
    const source = this.themeSource,
      layer = this.combatSource,
      gain = this.themeGain;
    this.themeSource = this.combatSource = this.themeGain = undefined;
    this.combatGain = this.themeFilter = undefined;
    if (!source || !gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    source.stop(now + fade + 0.05);
    layer?.stop(now + fade + 0.05);
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext();
    const bus = ctx.createDynamicsCompressor();
    bus.threshold.value = -14;
    bus.ratio.value = 5;
    bus.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(bus);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.6;
    this.music.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    return ctx;
  }

  /** Play a named cue. Unknown names fall back to a soft tick. */
  play(type: string, options: SoundOptions = {}) {
    if (!(STINGERS.has(type) ? this.musicOn : this.effectsOn)) return;
    try {
      const ctx = this.ensure(),
        now = ctx.currentTime;
      const gap = SPACING[type] ?? 0.03;
      if (now - (this.last.get(type) ?? -1) < gap) return;
      const stinger = STINGERS.has(type);
      if (!stinger && this.voices > MAX_VOICES) return;
      this.last.set(type, now);
      const gain = Math.max(0, Math.min(1, options.gain ?? 1));
      if (gain < 0.02) return;
      const out = ctx.createGain();
      out.gain.value = gain * 10 ** ((TRIM_DB[type] ?? 12) / 20);
      let tail: AudioNode = out;
      if (options.pan && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-0.85, Math.min(0.85, options.pan));
        out.connect(panner);
        tail = panner;
      }
      tail.connect(stinger ? this.music! : this.sfx!);
      if (stinger) {
        this.stinger(type, out, now);
        this.duck(now, type === "win" || type === "lose" ? 1.9 : 0.9);
      } else this.effect(type, out, now);
    } catch {
      // Audio is optional: a blocked context must never break the game.
    }
  }

  /** Briefly lower effects and the theme so a stinger reads over gunfire. */
  private duck(now: number, seconds: number) {
    if (this.themeGain) {
      const t = this.themeGain.gain;
      t.cancelScheduledValues(now);
      t.setTargetAtTime(THEME_GAIN * this.themeLevel * 0.3, now, 0.08);
      t.setTargetAtTime(THEME_GAIN * this.themeLevel, now + seconds, 0.5);
    }
    if (!this.effectsOn) return;
    const g = this.sfx!.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.45, now, 0.05);
    g.setTargetAtTime(1, now + seconds, 0.4);
  }

  // ------------------------------------------------------------------ voices
  private tone(
    out: AudioNode,
    at: number,
    wave: OscillatorType,
    from: number,
    to: number,
    duration: number,
    volume: number,
    filter?: { type: BiquadFilterType; hz: number },
  ) {
    const ctx = this.ctx!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(from, at);
    if (to !== from)
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(
      volume,
      at + Math.min(0.012, duration / 4),
    );
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    let node: AudioNode = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.hz;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    this.track(o);
    o.start(at);
    o.stop(at + duration + 0.03);
  }

  private hiss(
    out: AudioNode,
    at: number,
    type: BiquadFilterType,
    from: number,
    to: number,
    duration: number,
    volume: number,
    q = 0.8,
  ) {
    const ctx = this.ctx!,
      src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = this.noise!;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(volume, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(f).connect(g).connect(out);
    this.track(src);
    src.start(at, Math.random() * 0.5, duration + 0.05);
  }

  private track(node: AudioScheduledSourceNode) {
    this.voices++;
    node.onended = () => this.voices--;
  }

  // ----------------------------------------------------------------- effects
  private effect(type: string, out: AudioNode, t: number) {
    const tone = (
      wave: OscillatorType,
      from: number,
      to: number,
      duration: number,
      volume: number,
      filter?: { type: BiquadFilterType; hz: number },
    ) => this.tone(out, t, wave, from, to, duration, volume, filter);
    const hiss = (
      ...a: [BiquadFilterType, number, number, number, number, number?]
    ) => this.hiss(out, t, ...a);
    switch (type) {
      // Player weapons: deliberately small and short, distinct per gun.
      case "fire:rifle":
        hiss("bandpass", 2600, 900, 0.06, 0.05, 1.2);
        tone("triangle", 160, 60, 0.07, 0.035);
        break;
      case "fire:shotgun":
        hiss("lowpass", 1800, 180, 0.28, 0.12);
        tone("sine", 110, 40, 0.2, 0.1);
        this.hiss(out, t + 0.22, "bandpass", 1800, 1200, 0.04, 0.03, 4);
        break;
      case "fire:machineGun":
        hiss("highpass", 3200, 1800, 0.035, 0.035);
        tone("square", 120, 70, 0.035, 0.012);
        break;
      case "fire:sniper":
        hiss("highpass", 5000, 2200, 0.05, 0.09);
        hiss("lowpass", 900, 90, 0.7, 0.05);
        tone("sine", 1300, 700, 0.08, 0.02);
        break;
      case "fire:flame":
        hiss("bandpass", 900, 1600, 0.22, 0.05, 0.6);
        break;
      case "fire:launcher":
        tone("sine", 240, 80, 0.14, 0.09);
        hiss("lowpass", 900, 200, 0.12, 0.05);
        break;
      case "fire:explosiveArrow":
        tone("triangle", 420, 280, 0.12, 0.05);
        hiss("highpass", 3000, 1500, 0.08, 0.02);
        break;
      case "fire:missile":
        hiss("bandpass", 300, 2400, 0.5, 0.08, 1.4);
        tone("sine", 90, 50, 0.18, 0.08);
        break;
      case "fire:laser":
        tone("sawtooth", 1800, 220, 0.2, 0.035, { type: "lowpass", hz: 3200 });
        tone("square", 2400, 1600, 0.12, 0.012);
        break;
      case "cannon":
        hiss("lowpass", 1400, 60, 0.9, 0.2);
        tone("sine", 75, 28, 0.6, 0.22);
        hiss("highpass", 2500, 900, 0.06, 0.06);
        break;
      case "throw":
        hiss("bandpass", 700, 1600, 0.16, 0.04, 1.5);
        break;
      case "enemyShot":
        // Hostile fire: darker and quieter, so the player's own guns lead.
        hiss("lowpass", 1700, 500, 0.08, 0.05);
        tone("triangle", 130, 55, 0.07, 0.025);
        break;
      case "enemyCannon":
        hiss("lowpass", 1100, 70, 0.6, 0.14);
        tone("sine", 70, 30, 0.45, 0.14);
        break;
      case "allyShot":
        hiss("bandpass", 2200, 900, 0.05, 0.03, 1.2);
        break;
      case "explosion":
        tone("sine", 85, 26, 0.6, 0.28);
        hiss("lowpass", 1800, 70, 1.15, 0.24);
        hiss("highpass", 3000, 1200, 0.08, 0.08);
        this.hiss(out, t + 0.07, "bandpass", 700, 250, 0.5, 0.06, 0.7);
        break;
      case "hit":
        hiss("bandpass", 3400, 1500, 0.035, 0.05, 2);
        tone("triangle", 320, 110, 0.05, 0.03);
        break;
      case "armor":
        tone("square", 1500, 560, 0.06, 0.022);
        tone("sine", 2300, 2100, 0.12, 0.018);
        break;
      case "kill":
        tone("triangle", 660, 990, 0.07, 0.03);
        break;
      case "damage":
        hiss("lowpass", 800, 110, 0.22, 0.13);
        tone("sine", 130, 45, 0.18, 0.09);
        break;
      case "reload":
        hiss("bandpass", 2600, 2200, 0.03, 0.05, 6);
        this.hiss(out, t + 0.12, "bandpass", 1800, 1500, 0.04, 0.06, 6);
        break;
      case "dash":
        hiss("bandpass", 500, 1400, 0.2, 0.05, 1.2);
        break;
      case "coin":
        tone("sine", midi(84), midi(84), 0.09, 0.05);
        this.tone(out, t + 0.07, "sine", midi(91), midi(91), 0.2, 0.05);
        break;
      case "pickup":
        tone("triangle", midi(72), midi(79), 0.14, 0.05);
        break;
      case "rescue":
        [76, 79, 84].forEach((n, i) =>
          this.tone(
            out,
            t + i * 0.08,
            "triangle",
            midi(n),
            midi(n),
            0.22,
            0.05,
          ),
        );
        break;
      case "objective":
        [72, 76, 79].forEach((n, i) =>
          this.tone(out, t + i * 0.07, "sine", midi(n), midi(n), 0.3, 0.06),
        );
        break;
      case "streak":
        [81, 85].forEach((n, i) =>
          this.tone(
            out,
            t + i * 0.07,
            "triangle",
            midi(n),
            midi(n),
            0.14,
            0.045,
          ),
        );
        break;
      case "warn":
        // Two short klaxon beeps for incoming rockfall or salvo.
        [0, 0.18].forEach((d) =>
          this.tone(out, t + d, "square", 880, 700, 0.13, 0.035, {
            type: "lowpass",
            hz: 2400,
          }),
        );
        break;
      default:
        tone("triangle", 260, 70, 0.06, 0.04);
    }
  }

  // ----------------------------------------------------------------- stingers
  /** Tiny sequencer: brassy lead, bass, kick, snare and crash voices. */
  private stinger(type: string, out: AudioNode, t: number) {
    const song = SONGS[type];
    if (!song) return;
    const beat = 60 / song.bpm;
    for (const [at, note, beats, voice] of song.notes) {
      const start = t + at * beat,
        length = beats * beat;
      if (voice === "lead" || voice === "lead2") {
        // Brass-like: two detuned squares through a closing low-pass.
        for (const detune of [-6, 6])
          this.brass(
            out,
            start,
            midi(note),
            detune,
            length,
            voice === "lead" ? 0.05 : 0.03,
          );
      } else if (voice === "bass")
        this.tone(out, start, "triangle", midi(note), midi(note), length, 0.09);
      else if (voice === "kick")
        this.tone(out, start, "sine", 140, 42, 0.22, 0.2);
      else if (voice === "snare") {
        this.hiss(out, start, "bandpass", 1900, 1500, 0.12, 0.08, 0.9);
        this.tone(out, start, "triangle", 200, 150, 0.06, 0.04);
      } else if (voice === "crash")
        this.hiss(out, start, "highpass", 7000, 4000, length, 0.045);
    }
  }

  private brass(
    out: AudioNode,
    at: number,
    hz: number,
    detune: number,
    length: number,
    volume: number,
  ) {
    const ctx = this.ctx!,
      o = ctx.createOscillator(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    o.type = "square";
    o.frequency.value = hz;
    o.detune.value = detune;
    f.type = "lowpass";
    f.frequency.setValueAtTime(hz * 6, at);
    f.frequency.exponentialRampToValueAtTime(
      hz * 2.2,
      at + Math.min(0.35, length),
    );
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(volume, at + 0.03);
    g.gain.setValueAtTime(volume * 0.8, at + Math.max(0.04, length - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.12);
    o.connect(f).connect(g).connect(out);
    this.track(o);
    o.start(at);
    o.stop(at + length + 0.15);
  }
}
