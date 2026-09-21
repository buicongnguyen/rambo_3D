/** Roofless, two-exit compounds stay inside the old building footprints.
 * Main roads, vehicle bays and permanent relay barracks are unchanged. */
export function addRuins(mission, boxes) {
  if (mission.stage === 0 && mission.level === 0) {
    for (const b of boxes
      .filter((b) => b.kind === "screen" && b.height > 2)
      .slice(0, 2)) {
      b.asset = "ruinWall";
      b.hp = 112;
      b.d = 0.65;
    }
  }
  if (mission.biome !== "city") return;
  const buildings = boxes.filter((b) => b.kind === "building" && !b.asset);
  // Prefer accessible street-side buildings, not distant decorative corners.
  const distance = (b) =>
    Math.min(...mission.route.map((p) => Math.hypot(p.x - b.x, p.z - b.z)));
  buildings.sort((a, b) => distance(a) - distance(b));
  for (const b of buildings.slice(0, 4)) {
    const t = 0.45,
      door = 2.2,
      wing = (b.w - door) / 2;
    const wall = (x, z, w, d) => ({
      x,
      z,
      w,
      d,
      height: 2.4,
      hp: 112,
      kind: "building",
      asset: "ruinWall",
    });
    const pieces = [];
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        pieces.push(
          wall(
            b.x + side * (b.w / 2 - wing / 2),
            b.z + end * (b.d / 2 - t / 2),
            wing,
            t,
          ),
        );
        pieces.push(
          wall(
            b.x + side * (b.w / 2 - t / 2),
            b.z + (end * (b.d - 2 * t)) / 4,
            t,
            (b.d - 2 * t) / 2,
          ),
        );
      }
    }
    // One offset partition makes the intact route turn; shooting it opens a shortcut.
    pieces.push(wall(b.x - b.w / 4, b.z, b.w / 2, t));
    boxes.splice(boxes.indexOf(b), 1, ...pieces);
  }
}
