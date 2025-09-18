/**
 * Responsibility: Geometry helpers (AABB intersection, etc.).
 * Publishes: none
 * Subscribes: none
 * Config: none
 */
export function aabbIntersects(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number
): boolean {
  return Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
}

export function segmentIntersectsAABB(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number
): boolean {
  const minX = cx - hw;
  const maxX = cx + hw;
  const minY = cy - hh;
  const maxY = cy + hh;

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    clip(-dx, x1 - minX) &&
    clip(dx, maxX - x1) &&
    clip(-dy, y1 - minY) &&
    clip(dy, maxY - y1)
  ) {
    return t0 <= t1 && t1 >= 0 && t0 <= 1;
  }
  return false;
}
