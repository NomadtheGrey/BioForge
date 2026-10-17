/**
 * playtestSearch — the Playtest Kit's row filter (pure).
 *
 * The panel searches two registries (items, species) by
 * substring over display name and id. Kept free of React
 * and of the registries themselves so the shield-driver
 * pattern applies: driver/playtest-driver.ts pins the
 * matching and ranking rules against synthetic rows.
 *
 * Rules: the query is trimmed and lower-cased; underscores
 * in ids read as spaces (typing "lantern shield" finds
 * lantern_shield). A row matches when its name or its id
 * contains the query. Ranking: name-prefix matches first,
 * then name matches, then id-only matches — alphabetical
 * by name inside each band, so the thing you meant floats
 * up without the list jumping around as you type.
 */

export interface SearchRow {
  id: string;
  name: string;
}

export function filterSearchRows<T extends SearchRow>(rows: readonly T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows.slice(0, limit);
  const band = (row: T): number => {
    const name = row.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    if (row.id.toLowerCase().replace(/_/g, ' ').includes(q) || row.id.toLowerCase().includes(q)) return 2;
    return -1;
  };
  return rows
    .map((row) => ({ row, band: band(row) }))
    .filter((entry) => entry.band >= 0)
    .sort((a, b) => a.band - b.band || a.row.name.localeCompare(b.row.name))
    .slice(0, limit)
    .map((entry) => entry.row);
}
