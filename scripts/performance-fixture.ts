import * as T from "three";
export function workFixture(config: any) {
  const { game: g, world: w, input } = (window as any).__nightfall;
  let seed = 98765;
  Math.random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  g.start(14, { armor: 0, power: 3, mobility: 3 }, "crazy", 98765);
  g.phase = "won";
  g.invincible = 10000;
  g.ambushes.forEach((a: any) => (a.fired = true));
  w.quality(config.phone);
  w.cameraOverride = undefined;
  w.guide = undefined;
  const enemy = g.enemies[Math.floor(g.enemies.length * 0.45)];
  g.pos.set(enemy.x, 0, enemy.z);
  g.player.position.copy(g.pos);
  w.resetCamera(g.pos);
  if (config.effects) {
    for (let i = 0; i < 16; i++)
      g.impacts.emit(
        g.pos.x + ((i % 4) - 2) * 3,
        1,
        g.pos.z + (Math.floor(i / 4) - 2) * 3,
        "rocket",
        false,
        2,
        true,
      );
    g.impacts.update(0.8);
  }
  let frame = 0;
  const step = () => {
    if (config.combat) {
      g.phase = "playing";
      g.update(1 / 60, {
        ...input,
        x: 0.2,
        z: -0.3,
        fire: true,
        assist: true,
        interact: false,
        swap: false,
        turbo: false,
      });
      g.phase = "won";
    }
    w.render(config.combat ? 100 + frame++ / 60 : 100, g.pos, false, true);
  };
  const counts = { compose: 0, multiply: 0 };
  const originals = {
    compose: T.Matrix4.prototype.compose,
    multiply: T.Matrix4.prototype.multiplyMatrices,
  };
  const instrument = (on: boolean) => {
    T.Matrix4.prototype.compose = on
      ? function (...a: Parameters<T.Matrix4["compose"]>) {
          counts.compose++;
          return originals.compose.apply(this, a);
        }
      : originals.compose;
    T.Matrix4.prototype.multiplyMatrices = on
      ? function (...a: Parameters<T.Matrix4["multiplyMatrices"]>) {
          counts.multiply++;
          return originals.multiply.apply(this, a);
        }
      : originals.multiply;
  };
  const memory = () => {
    const geometry = new Set<ArrayBufferLike>(),
      instances = new Set<ArrayBufferLike>();
    w.scene.traverse((o: any) => {
      if (o.geometry)
        for (const a of [
          ...Object.values(o.geometry.attributes),
          o.geometry.index,
        ] as any[]) {
          const array = a?.array ?? a?.data?.array;
          if (array) geometry.add(array.buffer);
        }
      for (const a of [o.instanceMatrix, o.instanceColor])
        if (a) instances.add(a.array.buffer);
    });
    return {
      geometryBytes: [...geometry].reduce((n, b) => n + b.byteLength, 0),
      instanceBytes: [...instances].reduce((n, b) => n + b.byteLength, 0),
      ...w.renderer.info.memory,
      programs: w.renderer.info.programs.length,
    };
  };
  return {
    step,
    instrument,
    counts,
    memory,
    png: () => {
      w.render(100, g.pos, false, true);
      return w.renderer.domElement.toDataURL();
    },
    mainCalls: () => w.renderer.info.render.calls,
  };
}
