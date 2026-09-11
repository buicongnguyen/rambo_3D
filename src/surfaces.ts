import * as T from "three";
/** Deterministic tileable surface maps shared by the three environments. */
export function surface(kind: "soil" | "road" | "water") {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number, n: number) => {
    const fx = (x / size) * n,
      fy = (y / size) * n,
      ix = Math.floor(fx),
      iy = Math.floor(fy);
    const smooth = (v: number) => v * v * (3 - 2 * v),
      u = smooth(fx - ix),
      v = smooth(fy - iy);
    const h = (a: number, b: number) => {
      const t = Math.sin((a % n) * 127.1 + (b % n) * 311.7) * 43758.5453;
      return t - Math.floor(t);
    };
    return (
      (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) +
      (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v
    );
  };
  let seed = kind === "soil" ? 771 : 91;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (seed * 16807) % 2147483647;
      const grain = seed / 2147483647;
      const wave = Math.sin(
        (x / size) * Math.PI * 12 + Math.sin((y / size) * Math.PI * 8),
      );
      const large =
        Math.sin((x / size) * Math.PI * 4) * Math.cos((y / size) * Math.PI * 6);
      const value =
        kind === "water"
          ? 128 + wave * 36 + large * 16
          : 165 + grain * 16 + noise(x, y, 5) * 22 + noise(x, y, 17) * 12;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
/** Crossed, tapered grass blades with a rooted wind deformation. */
export function grassGeometry() {
  const vertices: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4,
      x = Math.cos(a) * 0.13,
      z = Math.sin(a) * 0.13,
      h = 0.25 + i * 0.06;
    vertices.push(x - 0.045, 0, z, x + 0.045, 0, z, x + 0.09, h, z + 0.06);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
