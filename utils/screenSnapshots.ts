import { DependencyList } from "react";

/**
 * In-memory snapshots of feed screens, so a screen re-opened with the forward
 * swipe or button comes back with the same items and scroll position instead
 * of reloading from the top.
 *
 * Every mounted feed keeps its snapshot up to date under its route key. When
 * a screen is popped into the forward history (StackFutureContext) its
 * snapshot is retained; otherwise it's dropped when the screen unmounts.
 */

export type FeedSnapshot = {
  data: unknown[];
  cursor: string | undefined;
  fullyLoaded: boolean;
  hitFilterLimit: boolean;
  /**
   * The page's refreshDependencies when the snapshot was taken. Some pages
   * keep state outside the URL (e.g. UserPage's posts/comments toggle), so a
   * snapshot is only restored when these still match.
   */
  dependencies: unknown[];
  /**
   * The item at the top of the visible area (just below the header) and how
   * many pixels of it were scrolled past, so a restore lands on the same spot.
   */
  anchorIndex: number;
  anchorOffset: number;
};

/** Forward history beyond this many screens reloads instead of restoring. */
const MAX_RETAINED = 10;

const snapshots = new Map<string, Partial<FeedSnapshot>>();
const retained: string[] = [];

export function updateSnapshot(key: string, patch: Partial<FeedSnapshot>) {
  snapshots.set(key, { ...snapshots.get(key), ...patch });
}

export function getSnapshot(key: string): Partial<FeedSnapshot> | undefined {
  return snapshots.get(key);
}

export function getRestorableSnapshot(
  key: string | undefined,
  dependencies: DependencyList,
): FeedSnapshot | undefined {
  if (!key) return undefined;
  const snapshot = snapshots.get(key);
  if (!snapshot?.data?.length) return undefined;
  const saved = snapshot.dependencies ?? [];
  if (
    saved.length !== dependencies.length ||
    saved.some((dep, i) => !Object.is(dep, dependencies[i]))
  ) {
    return undefined;
  }
  return snapshot as FeedSnapshot;
}

/** Keep a popped screen's snapshot so going forward can restore it. */
export function retainSnapshot(key: string) {
  if (!retained.includes(key)) retained.push(key);
  while (retained.length > MAX_RETAINED) {
    const oldest = retained.shift();
    if (oldest) snapshots.delete(oldest);
  }
}

export function isSnapshotRetained(key: string) {
  return retained.includes(key);
}

export function releaseSnapshot(key: string) {
  const index = retained.indexOf(key);
  if (index !== -1) retained.splice(index, 1);
  snapshots.delete(key);
}
