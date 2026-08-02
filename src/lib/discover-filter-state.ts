export type DiscoverRange = {
  min: string;
  max: string;
};

/**
 * Keep a two-sided numeric filter valid while preserving the boundary the
 * user just chose. If it crosses the other side, move that side with it.
 */
export function updateDiscoverRange(
  current: DiscoverRange,
  boundary: "min" | "max",
  value: string,
): DiscoverRange {
  const next = { ...current, [boundary]: value };
  if (!value) return next;

  const changed = Number(value);
  const otherBoundary = boundary === "min" ? "max" : "min";
  const otherValue = next[otherBoundary];
  if (!Number.isFinite(changed) || !otherValue) return next;

  const other = Number(otherValue);
  if (!Number.isFinite(other)) return next;

  if (boundary === "min" && changed > other) next.max = value;
  if (boundary === "max" && changed < other) next.min = value;
  return next;
}
