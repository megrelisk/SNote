/**
 * Fractional ordering: inserting between two items picks the midpoint so only
 * the moved item is rewritten (cheap, conflict-free reorders across devices).
 */

export const ORDER_STEP = 1024;

export function orderBetween(before?: number | null, after?: number | null): number {
  if (before == null && after == null) return ORDER_STEP;
  if (before == null) return (after as number) - ORDER_STEP;
  if (after == null) return before + ORDER_STEP;
  return (before + after) / 2;
}

/** Order value for inserting at `index` in an already sorted list of orders. */
export function orderAtIndex(sortedOrders: readonly number[], index: number): number {
  const before = index > 0 ? sortedOrders[index - 1] : undefined;
  const after = index < sortedOrders.length ? sortedOrders[index] : undefined;
  return orderBetween(before, after);
}

/** Order for moving the item at `from` so that it ends up at position `to`. */
export function orderForMove(sortedOrders: readonly number[], from: number, to: number): number {
  const rest = sortedOrders.filter((_, i) => i !== from);
  return orderAtIndex(rest, to);
}

/** True when two neighbours are too close for floating point midpoints to stay distinct. */
export function needsRebalance(sortedOrders: readonly number[]): boolean {
  for (let i = 1; i < sortedOrders.length; i++) {
    if ((sortedOrders[i] as number) - (sortedOrders[i - 1] as number) < 1e-6) return true;
  }
  return false;
}

export function rebalancedOrders(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * ORDER_STEP);
}

export function byOrder<T extends { order: number; createdAt?: number }>(a: T, b: T): number {
  return a.order - b.order || (a.createdAt ?? 0) - (b.createdAt ?? 0);
}
