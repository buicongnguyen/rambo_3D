import { composeTheme, themeStems } from "./music.mjs";

/**
 * Render a composed theme once, offline, into a seamless looping AudioBuffer.
 * Rendering runs on the audio thread; playback is then a single looping
 * buffer source, so background music costs almost nothing per game frame.
 */
const RATE = 32000; // Plenty for synthesized music; halves memory versus 64 kHz.
const TAIL = 2; // Seconds of release/reverb folded back into the loop start.
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Ctx = OfflineAudioContext;

function envelope(
  ctx: Ctx,
  at: number,
  attack: number,
  hold: number,
  release: number,
  peak: number,
) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + Math.max(attack, hold));
  g.gain.exponentialRampToValueAtTime(
    0.0001,
    at + Math.max(attack, hold) + release,
  );
  return g;
}

function osc(ctx: Ctx, type: OscillatorType, freq: number, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

function noise(ctx: Ctx, buffer: AudioBuffer, at: number, length: number) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.start(at, Math.random() * 0.5, length + 0.05);
  return src;
}

/** One note of an instrument voice, routed to `out`. */
function play(
  ctx: Ctx,
  out: AudioNode,
  hiss: AudioBuffer,
  voice: string,
  at: number,
  length: number,
  note: number,
  velocity: number,
) {
  const stop = (o: OscillatorNode, end: number) => {
    o.start(at);
    o.stop(end + 0.05);
  };
  const v = velocity;
  switch (voice) {
    case "brass": {
      // Heroic brass: detuned saws through a swelling low-pass.
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(hz(note) * 1.5, at);
      f.frequency.linearRampToValueAtTime(hz(note) * 5, at + 0.12);
      f.frequency.exponentialRampToValueAtTime(hz(note) * 2.5, at + length);
      const g = envelope(ctx, at, 0.05, length, 0.18, 0.09 * v);
      f.connect(g).connect(out);
      for (const d of [-7, 7]) {
        const o = osc(ctx, "sawtooth", hz(note), d);
        o.connect(f);
        stop(o, at + length + 0.2);
      }
      break;
    }
    case "strings":
    case "pad": {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = voice === "pad" ? 1400 : 2600;
      const g = envelope(
        ctx,
        at,
        voice === "pad" ? 0.35 : 0.12,
        length,
        0.45,
        (voice === "pad" ? 0.035 : 0.05) * v,
      );
      f.connect(g).connect(out);
      for (const d of [-9, 0, 9]) {
        const o = osc(ctx, "sawtooth", hz(note), d);
        o.connect(f);
        stop(o, at + length + 0.5);
      }
      break;
    }
    case "bell": {
      // Glockenspiel over a soft horn: sparkle for the ice stage.
      for (const [ratio, level, decay] of [
        [1, 0.08, 1.2],
        [2.76, 0.03, 0.5],
      ]) {
        const g = envelope(ctx, at, 0.004, 0.01, decay, level * v);
        g.connect(out);
        const o = osc(ctx, "sine", hz(note) * ratio);
        o.connect(g);
        stop(o, at + decay + 0.1);
      }
      const horn = envelope(ctx, at, 0.08, length, 0.2, 0.035 * v);
      horn.connect(out);
      const h = osc(ctx, "triangle", hz(note));
      h.connect(horn);
      stop(h, at + length + 0.25);
      break;
    }
    case "pluck": {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(hz(note) * 8, at);
      f.frequency.exponentialRampToValueAtTime(hz(note) * 1.5, at + 0.35);
      const g = envelope(ctx, at, 0.004, 0.02, Math.max(0.3, length), 0.09 * v);
      f.connect(g).connect(out);
      const o = osc(ctx, "square", hz(note));
      o.connect(f);
      stop(o, at + length + 0.35);
      break;
    }
    case "flute": {
      const g = envelope(ctx, at, 0.06, length, 0.15, 0.08 * v);
      g.connect(out);
      const o = osc(ctx, "triangle", hz(note));
      const lfo = osc(ctx, "sine", 5.4),
        depth = ctx.createGain();
      depth.gain.value = hz(note) * 0.006;
      lfo.connect(depth).connect(o.frequency);
      o.connect(g);
      stop(o, at + length + 0.2);
      stop(lfo, at + length + 0.2);
      break;
    }
    case "bass": {
      const g = envelope(ctx, at, 0.01, length * 0.8, 0.12, 0.14 * v);
      g.connect(out);
      for (const [type, mult] of [
        ["triangle", 1],
        ["sine", 0.5],
      ] as const) {
        const o = osc(ctx, type, hz(note) * mult);
        o.connect(g);
        stop(o, at + length + 0.15);
      }
      break;
    }
    case "timpani":
    case "boom": {
      const pitch = voice === "boom" ? 45 : hz(note);
      const g = envelope(
        ctx,
        at,
        0.005,
        0.02,
        voice === "boom" ? 1.4 : 0.9,
        0.28 * v,
      );
      g.connect(out);
      const o = osc(ctx, "sine", pitch * 1.5);
      o.frequency.exponentialRampToValueAtTime(pitch, at + 0.08);
      o.connect(g);
      stop(o, at + 1.5);
      break;
    }
    case "kick": {
      const g = envelope(ctx, at, 0.003, 0.01, 0.25, 0.3 * v);
      g.connect(out);
      const o = osc(ctx, "sine", 130);
      o.frequency.exponentialRampToValueAtTime(42, at + 0.2);
      o.connect(g);
      stop(o, at + 0.3);
      break;
    }
    case "taiko":
    case "tom":
    case "bongo": {
      const [from, to, level, decay] =
        voice === "taiko"
          ? [110, 55, 0.3, 0.5]
          : voice === "tom"
            ? [200, 120, 0.2, 0.3]
            : [420, 330, 0.14, 0.15];
      const g = envelope(ctx, at, 0.003, 0.01, decay, level * v);
      g.connect(out);
      const o = osc(ctx, "sine", from);
      o.frequency.exponentialRampToValueAtTime(to, at + decay);
      o.connect(g);
      stop(o, at + decay + 0.05);
      break;
    }
    case "snare":
    case "hat":
    case "shaker":
    case "crash": {
      const [type, freq, level, decay] =
        voice === "snare"
          ? (["bandpass", 1900, 0.16, 0.16] as const)
          : voice === "hat"
            ? (["highpass", 8000, 0.05, 0.05] as const)
            : voice === "shaker"
              ? (["bandpass", 6500, 0.05, 0.07] as const)
              : (["highpass", 5500, 0.07, 1.6] as const);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = envelope(ctx, at, 0.002, 0.005, decay, level * v);
      f.connect(g).connect(out);
      noise(ctx, hiss, at, decay + 0.05).connect(f);
      break;
    }
  }
}

type Composition = ReturnType<typeof composeTheme>;

/** Render note events into a seamless loop (tail folded in), not yet normalised. */
async function renderLoop(theme: Composition) {
  const beat = 60 / theme.bpm,
    loop = Math.round(theme.seconds * RATE);
  const ctx = new OfflineAudioContext(1, loop + TAIL * RATE, RATE);
  const hiss = ctx.createBuffer(1, RATE, RATE);
  const data = hiss.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  const dry = ctx.createGain();
  dry.connect(ctx.destination);
  // A small hall: two filtered feedback delays give the orchestra some space.
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  wet.connect(ctx.destination);
  for (const time of [0.23, 0.37]) {
    const delay = ctx.createDelay(1),
      feedback = ctx.createGain(),
      damp = ctx.createBiquadFilter();
    delay.delayTime.value = time;
    feedback.gain.value = 0.34;
    damp.type = "lowpass";
    damp.frequency.value = 2400;
    dry.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    damp.connect(wet);
  }
  for (const e of theme.events)
    play(
      ctx,
      dry,
      hiss,
      e.voice,
      e.at * beat,
      e.beats * beat,
      e.note,
      e.velocity,
    );
  const rendered = await ctx.startRendering();
  // Fold the release tail into the start so the loop point is seamless.
  const out = new AudioBuffer({
    length: loop,
    sampleRate: RATE,
    numberOfChannels: 1,
  });
  const src = rendered.getChannelData(0),
    dst = out.getChannelData(0);
  dst.set(src.subarray(0, loop));
  for (let i = 0; i < TAIL * RATE && loop + i < src.length; i++)
    dst[i] += src[loop + i];
  // A 3 ms fade either side of the loop point removes any residual click.
  const edge = Math.round(RATE * 0.003);
  for (let i = 0; i < edge; i++) {
    dst[i] *= i / edge;
    dst[dst.length - 1 - i] *= i / edge;
  }
  return out;
}

/** Scale buffers by one factor so their sum peaks at 0.5 (every theme equally loud). */
function normalise(buffers: AudioBuffer[]) {
  const channels = buffers.map((b) => b.getChannelData(0));
  let peak = 0;
  for (let i = 0; i < channels[0].length; i++) {
    let sum = 0;
    for (const c of channels) sum += c[i];
    peak = Math.max(peak, Math.abs(sum));
  }
  const scale = peak > 0 ? 0.5 / peak : 1;
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= scale;
  return buffers;
}

/** Render a theme (optionally its boss variant) into a loopable buffer. */
export async function renderTheme(name: string, boss = false) {
  return normalise([await renderLoop(composeTheme(name, boss))])[0];
}

/**
 * Render the adaptive stems of a stage theme: [base, combat]. They share one
 * normalisation, so base + combat at full intensity matches the full mix level.
 */
export async function renderStems(name: string) {
  const stems = themeStems(name);
  const [base, combat] = await Promise.all([
    renderLoop(stems.base),
    renderLoop(stems.combat),
  ]);
  return normalise([base, combat]) as [AudioBuffer, AudioBuffer];
}
