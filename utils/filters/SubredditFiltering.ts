export type SubredditFilterValue = number | true;

export type SubredditFilterMap = Record<string, SubredditFilterValue>;

export type SubredditFilterMatcher = {
  exact: Record<string, SubredditFilterValue>;
  wildcards: { regex: RegExp; value: SubredditFilterValue }[];
};

export function isWildcardSubredditFilter(filter: string): boolean {
  return filter.includes("*");
}

/**
 * Normalizes user input into a subreddit filter key. Strips any leading
 * "r/" or "/r/" and whitespace. Returns null if nothing usable remains.
 */
export function normalizeSubredditFilter(input: string): string | null {
  const filter = input
    .trim()
    .replace(/^\/?r\//i, "")
    .replace(/\s+/g, "");
  if (!filter || /^\*+$/.test(filter)) return null;
  if (!/^[A-Za-z0-9_*]+$/.test(filter)) return null;
  return filter;
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function makeSubredditFilterMatcher(
  filters: SubredditFilterMap,
): SubredditFilterMatcher {
  const matcher: SubredditFilterMatcher = { exact: {}, wildcards: [] };
  for (const [filter, value] of Object.entries(filters)) {
    if (isWildcardSubredditFilter(filter)) {
      matcher.wildcards.push({ regex: wildcardToRegex(filter), value });
    } else {
      matcher.exact[filter.toLowerCase()] = value;
    }
  }
  return matcher;
}

function isFilterActive(value: SubredditFilterValue, now: number): boolean {
  return value === true || now < value;
}

export function isSubredditFiltered(
  matcher: SubredditFilterMatcher,
  subreddit: string,
  now = Date.now(),
): boolean {
  const exactValue = matcher.exact[subreddit.toLowerCase()];
  if (exactValue !== undefined && isFilterActive(exactValue, now)) {
    return true;
  }
  return matcher.wildcards.some(
    ({ regex, value }) => isFilterActive(value, now) && regex.test(subreddit),
  );
}
