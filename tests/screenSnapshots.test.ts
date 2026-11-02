import { describe, expect, test } from "bun:test";

import {
  getRestorableSnapshot,
  getSnapshot,
  isSnapshotRetained,
  releaseSnapshot,
  retainSnapshot,
  updateSnapshot,
} from "../utils/screenSnapshots";

const feed = (key: string, deps: unknown[] = ["hot", undefined]) =>
  updateSnapshot(key, {
    data: [{ id: "a" }, { id: "b" }],
    cursor: "t3_b",
    fullyLoaded: false,
    hitFilterLimit: false,
    dependencies: deps,
  });

describe("screen snapshots", () => {
  test("restores when dependencies match", () => {
    feed("s1");
    updateSnapshot("s1", { anchorIndex: 1, anchorOffset: 120 });
    const snapshot = getRestorableSnapshot("s1", ["hot", undefined]);
    expect(snapshot?.cursor).toBe("t3_b");
    expect(snapshot?.anchorIndex).toBe(1);
    expect(snapshot?.anchorOffset).toBe(120);
    expect(snapshot?.data.length).toBe(2);
    releaseSnapshot("s1");
  });

  test("skips restore when dependencies differ", () => {
    feed("s2", ["posts"]);
    expect(getRestorableSnapshot("s2", ["comments"])).toBe(undefined);
    expect(getRestorableSnapshot("s2", ["posts", "extra"])).toBe(undefined);
    releaseSnapshot("s2");
  });

  test("skips restore for missing keys and empty feeds", () => {
    expect(getRestorableSnapshot(undefined, [])).toBe(undefined);
    expect(getRestorableSnapshot("nope", [])).toBe(undefined);
    updateSnapshot("s3", { data: [], dependencies: [] });
    expect(getRestorableSnapshot("s3", [])).toBe(undefined);
    releaseSnapshot("s3");
  });

  test("retained snapshots survive until released", () => {
    feed("s4");
    retainSnapshot("s4");
    expect(isSnapshotRetained("s4")).toBe(true);
    releaseSnapshot("s4");
    expect(isSnapshotRetained("s4")).toBe(false);
    expect(getSnapshot("s4")).toBe(undefined);
  });

  test("only the 10 most recent popped screens are kept", () => {
    for (let i = 0; i < 12; i++) {
      feed(`cap${i}`);
      retainSnapshot(`cap${i}`);
    }
    expect(getSnapshot("cap0")).toBe(undefined);
    expect(getSnapshot("cap1")).toBe(undefined);
    expect(getSnapshot("cap2")).toBeDefined();
    expect(getSnapshot("cap11")).toBeDefined();
    for (let i = 0; i < 12; i++) releaseSnapshot(`cap${i}`);
  });
});
