# ENGINEERING NOTES — incidents that taught the codebase something

*Started 2026-10-18 (the docs sweep), from the day's incident
reports. The rule of this file: an entry exists only where a
real failure taught a reusable lesson. Add the lesson, date
it, name the mechanism — never just the story.*

## The frozen hand (2026-10-18) — mount-only effects freeze props

The game loop's engine effect in `useGameLoop` is mount-only
(`useEffect(..., [])`). Three reads inside it used the
destructured `playerState` prop — the FIRST render's state,
frozen forever. The held-light drive tested a hand that never
changed after load, so the hand lantern never lit (day, night,
or cave — invisible by day, total in the dark). The same frozen
read fed the shield viewmodel/graft/ward and the Lodestone
drop-magnet.

**The rule:** inside a mount-only effect, anything needed LIVE
comes through a ref (`latestStateRef` is the standing mirror —
it carries the save-session bundle, refreshed every render).
A bare prop read inside `}, [])` is a bug whether or not it has
fired yet. When a feature "never works, anywhere, for anyone,"
suspect this class before tuning numbers.

## The heal loop (2026-10-18) — a rescue that can't converge is a bomb

PR #56's panel self-healing measured panels with
`getBoundingClientRect` and nudged any panel showing under
56 px. A `display:none` panel measures **zero** — which the
heal read as "off-screen" — so it nudged, re-measured the same
zeros, and nudged again, forever: render saturation, the React
tree unmounted, black screen on the player's phone. A second
ignition waited behind it: a malformed saved offset (a NaN
component) makes the transform invalid, the rect never moves,
and the same nudge recomputes forever.

**The guards, all load-bearing** (HudPanel + useHudLayout):
zero-size rects are *unmeasurable* and never healed; the heal
fires **at most once** per panel per mount and once more per
resize; `setOffset` has an **equality bail** and refuses
non-finite writes; every offset from every source passes
`sanitizeHudLayout` on load. And the **HudErrorBoundary** wraps
the panels: a HUD fault now drops the furniture (tap restores,
and the restore resets the layout), never the world.

**The rule:** any self-correcting UI loop must be *incapable*
of iterating — bounded by construction, not by hoping the
correction converges — and must treat "cannot measure" as a
stop, not as a zero.

## Light rides the ground (2026-10-18) — the pooled light rules

The light pool (`threeEngine.updateLighting`) merges sources
into 4 m cells; the nearest cells win the 12 real PointLights.
Two traps live here:

- **Sources must ride their terrain.** Before the ground-light
  fix, light heights were flat-era constants and pooled lights
  sat underground on tall ground — the world had lights that
  lit nothing. Every source's y is its ground plus its ride
  height, and light-table intensities are written in the
  physical scale (halo 1–3, a real lamp 6–15, the lantern post
  40). The probe is `window.__bioforgeLightPool`.
- **The merge caps distance** (`mergedD = min(48, ...)`) — a
  source raised past the cap silently does nothing. When a
  light "doesn't take," check the cap before the source. (This
  is how the carried lantern's radius raise — 90/38, braced
  120/46 — had to land with the cap lifted 24 → 48 in the
  same change.)

## Whole-file pushes and stale bases (standing, relearned 2026-10-18)

Pushes write whole files; a batch composed from a stale clone
silently reverts whatever landed meanwhile (one such push
removed two item defs another lane had verified at origin).
The disciplines that exist because of it: fresh-reset the
build clone to the origin tip **before** composing on shared
files; keep **canary markers** for the newest cross-lane work
and grep them before every push; a tool's OK is advisory in
both directions — a push counts only when origin's history
shows the commit **and** its content matches; a byte-compare
"MATCH" proves origin carried your file, not that your file
was current. All changes stage on `wip`; main moves only by
merge. Docs travel alone, never mixed with code.
