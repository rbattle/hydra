import { describe, expect, test } from "bun:test";

import {
  isSubredditFiltered,
  makeSubredditFilterMatcher,
  normalizeSubredditFilter,
} from "../utils/filters/SubredditFiltering";

describe("subreddit filtering", () => {
  const now = 1_000_000;

  test("wildcard matches anywhere, case insensitive", () => {
    const m = makeSubredditFilterMatcher({ "*news*": true });
    for (const sub of ["news", "WorldNews", "UpliftingNews", "techNEWStoday"]) {
      expect(isSubredditFiltered(m, sub, now)).toBe(true);
    }
    expect(isSubredditFiltered(m, "newyork", now)).toBe(false);
  });

  test("prefix and suffix wildcards are anchored", () => {
    const m = makeSubredditFilterMatcher({ "nfl*": true, "*memes": true });
    expect(isSubredditFiltered(m, "nfl_draft", now)).toBe(true);
    expect(isSubredditFiltered(m, "fantasynfl", now)).toBe(false);
    expect(isSubredditFiltered(m, "dankmemes", now)).toBe(true);
    expect(isSubredditFiltered(m, "memesgalore", now)).toBe(false);
  });

  test("exact filters still work and are case insensitive", () => {
    const m = makeSubredditFilterMatcher({ pics: true });
    expect(isSubredditFiltered(m, "Pics", now)).toBe(true);
    expect(isSubredditFiltered(m, "picsofdogs", now)).toBe(false);
  });

  test("expired filters are ignored", () => {
    const m = makeSubredditFilterMatcher({
      "*news*": now - 1,
      pics: now - 1,
      funny: now + 1,
    });
    expect(isSubredditFiltered(m, "news", now)).toBe(false);
    expect(isSubredditFiltered(m, "pics", now)).toBe(false);
    expect(isSubredditFiltered(m, "funny", now)).toBe(true);
  });

  test("normalizes input", () => {
    expect(normalizeSubredditFilter(" /r/*news* ")).toBe("*news*");
    expect(normalizeSubredditFilter("r/pics")).toBe("pics");
    expect(normalizeSubredditFilter("***")).toBe(null);
    expect(normalizeSubredditFilter("bad.name")).toBe(null);
    expect(normalizeSubredditFilter("")).toBe(null);
  });
});
