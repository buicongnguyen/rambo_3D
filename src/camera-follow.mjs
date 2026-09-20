/** Frame-rate independent follow with a stationary inner region. */
export function followAxis(anchor, focus, radius, dt) {
  const distance = focus - anchor;
  const excess = Math.max(0, Math.abs(distance) - radius);
  return (
    anchor +
    Math.sign(distance) *
      excess *
      (1 - Math.exp(-5 * Math.min(Math.max(dt, 0), 0.1)))
  );
}
