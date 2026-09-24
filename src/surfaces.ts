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

/** Per-biome painted ground palette: shade / light patches, accent blotches, grass and road. */
export const GROUND_PAINT: Record<
  string,
  {
    shade: number;
    light: number;
    accent: number;
    amount: number;
    grass: number;
    road: number;
  }
> = {
  ice: {
    shade: 0xbcd5e6,
    light: 0xffffff,
    accent: 0x9fd2ec,
    amount: 0.35,
    grass: 0xf1f7fa,
    road: 0xa6c6d8,
  },
  volcano: {
    shade: 0x332623,
    light: 0x6f5446,
    accent: 0x5a2a1e,
    amount: 0.2,
    grass: 0x8a7a44,
    road: 0xa7825b,
  },
  sand: {
    shade: 0xc99a58,
    light: 0xf5d89d,
    accent: 0xd9a861,
    amount: 0.3,
    grass: 0xc2ae52,
    road: 0xc49a60,
  },
  jungle: {
    shade: 0x2f6326,
    light: 0x6ba63e,
    accent: 0x8f7a3f,
    amount: 0.28,
    grass: 0x6fb83f,
    road: 0xc59a62,
  },
  city: {
    shade: 0x8f887d,
    light: 0xc2baab,
    accent: 0x76934f,
    amount: 0.22,
    grass: 0x78a646,
    road: 0x3b4248,
  },
  quake: {
    shade: 0x8c6f4f,
    light: 0xd6b886,
    accent: 0x6f5840,
    amount: 0.3,
    grass: 0xa8a04c,
    road: 0xc9a46c,
  },
  mud: {
    shade: 0x3d4a27,
    light: 0x7d8c4b,
    accent: 0x3f3524,
    amount: 0.38,
    grass: 0x7a9c3f,
    road: 0xb69464,
  },
};

/**
 * Large-scale hand-painted ground for the whole playfield: soft light and shade
 * patches plus biome accents, sampled once per mission (repeat 1 across the slab).
 * Fine grain still comes from the tiling soil bump map.
 */
export function groundPaint(
  biome: string,
  base: number,
  width: number,
  depth: number,
) {
  const p = GROUND_PAINT[biome] ?? GROUND_PAINT.jungle;
  const w = 512,
    h = Math.max(128, Math.min(1024, Math.round((512 * depth) / width)));
  const data = new Uint8Array(w * h * 4);
  const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const [b, s, l, a] = [base, p.shade, p.light, p.accent].map(rgb);
  let seed = 1013904223 ^ (biome.length * 7919);
  const table = new Float32Array(4096);
  for (let i = 0; i < table.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    table[i] = seed / 4294967296;
  }
  const lattice = (x: number, y: number) =>
    table[((x * 73856093) ^ (y * 19349663)) & 4095];
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    const top = lattice(ix, iy) * (1 - u) + lattice(ix + 1, iy) * u,
      bottom = lattice(ix, iy + 1) * (1 - u) + lattice(ix + 1, iy + 1) * u;
    return top * (1 - v) + bottom * v;
  };
  // Metres per texel, so patch sizes stay constant across map sizes.
  const mx = width / w,
    my = depth / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const wx = x * mx,
        wy = y * my;
      const n =
        noise(wx / 22, wy / 22) * 0.55 +
        noise(wx / 9 + 31, wy / 9 + 17) * 0.3 +
        noise(wx / 3.5 + 7, wy / 3.5 + 3) * 0.15;
      const t = Math.min(1, Math.max(0, (n - 0.5) * 2.2 + 0.5));
      const patch = noise(wx / 13 + 91, wy / 13 + 57);
      const accent =
        Math.min(1, Math.max(0, (patch - 0.62) / 0.14)) * p.amount * 2.2;
      let paving = 0;
      if (biome === "city") {
        const gx = wx % 4,
          gy = wy % 4;
        paving = gx < 0.18 || gy < 0.18 ? 0.14 : 0;
      }
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const grain = 1 + (seed / 4294967296 - 0.5) * 0.05;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const tone =
          t < 0.5
            ? s[c] + (b[c] - s[c]) * t * 2
            : b[c] + (l[c] - b[c]) * (t - 0.5) * 2;
        const mixed = tone + (a[c] - tone) * Math.min(1, accent);
        data[i + c] = Math.max(0, Math.min(255, mixed * grain * (1 - paving)));
      }
      data[i + 3] = 255;
    }
  const texture = new T.DataTexture(data, w, h, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
