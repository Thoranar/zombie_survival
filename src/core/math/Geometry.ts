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

