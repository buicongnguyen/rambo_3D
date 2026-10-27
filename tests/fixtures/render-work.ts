import * as T from "three";
import {
  writeComponents,
  stagingComponents,
  commitComponents,
} from "../../src/render-work";
import { ImpactEffects } from "../../src/impacts";
export function verifyRenderWork() {
  const attr = new T.InstancedBufferAttribute(new Float32Array(64), 16),
    v = new T.Matrix4().makeRotationY(0.13).elements;
  writeComponents(attr, 0, v);
  const version = attr.version;
  writeComponents(attr, 0, v);
  if (attr.version !== version)
    throw Error("Unchanged float32 values uploaded");
  writeComponents(attr, 32, v);
  if (
    attr.updateRanges.length !== 1 ||
    attr.updateRanges[0].start !== 0 ||
    attr.updateRanges[0].count < 48
  )
    throw Error("Pending hidden ranges lost");
  attr.clearUpdateRanges();
  writeComponents(attr, 16, v);
  if (attr.updateRanges[0].start !== 16 || attr.updateRanges[0].count > 16)
    throw Error("Selective range wrong");
  const staged = stagingComponents(attr);
  staged.set(attr.array);
  staged[2] = 7;
  commitComponents(attr, staged, 48);
  const committed = attr.version;
  commitComponents(attr, staged, 48);
  if (attr.version !== committed) throw Error("Unchanged staged data uploaded");
  staged[40] = 9;
  commitComponents(attr, staged, 48);
  if (
    attr.array[2] !== 7 ||
    attr.array[40] !== 9 ||
    attr.updateRanges[0].start !== 2 ||
    attr.updateRanges[0].count !== 39
  )
    throw Error("Staged pending range lost");
  const effects = new ImpactEffects(new T.Group());
  effects.emit(0, 0, 0, "rocket", false, 2, true);
  effects.update(0.8);
  const burst = (effects as any).bursts[0];
  if (
    burst.core.visible ||
    burst.ring.visible ||
    burst.sparks.some((s: any) => s.visible) ||
    !burst.smoke.every((s: any) => s.visible)
  )
    throw Error("Explosion layers wrong");
  effects.update(3);
  if (effects.activeCount !== 0) throw Error("Effect did not expire");
  effects.emit(0, 0, 0, "rocket", true, 2, true);
  if (
    effects.capacity !== 1 ||
    !burst.core.visible ||
    burst.sparks.filter((s: any) => s.visible).length !== 3
  )
    throw Error("Pool reuse lost layers");
  effects.clear();
  if (effects.activeCount) throw Error("Clear failed");
  return true;
}
