/** Raw GPU submission counts, including Three.js shadow passes. Install before load. */
export function installDrawProbe() {
  const probe = (window.__drawReview = {
    active: false,
    calls: 0,
    instanced: 0,
    triangles: 0,
  });
  for (const proto of [
    window.WebGLRenderingContext?.prototype,
    window.WebGL2RenderingContext?.prototype,
  ]) {
    if (!proto) continue;
    for (const name of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
    ]) {
      const original = proto[name];
      if (!original) continue;
      proto[name] = function (...args) {
        if (probe.active) {
          const arrays = name.startsWith("drawArrays"),
            instanced = name.endsWith("Instanced");
          probe.calls++;
          if (instanced) probe.instanced++;
          if (args[0] === this.TRIANGLES)
            probe.triangles +=
              ((arrays ? args[2] : args[1]) / 3) *
              (instanced ? args[arrays ? 3 : 4] : 1);
        }
        return original.apply(this, args);
      };
    }
  }
}
