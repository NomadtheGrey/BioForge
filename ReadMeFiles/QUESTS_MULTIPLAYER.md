# Quests in Multiplayer — the design take

*Sweep addendum (2026-10-18): what has SHIPPED since this take
was recorded. Co-op runs on the **host's law**: the host's save
carries the session difficulty (world_sync transports it), and
guests play under it — including Hostile, where explorer harm is
live (WEAPONS.md). Guests attach no save of their own and their
autosave stays disarmed in-session. The Asks Back sagas (§3)
shipped S1–S6, including the BioTunnel guest fix and Movable
Vaults; the party-native sagas (§4) remain design. The open
questions in §6 stand as written — they are Adam's calls, and
the shipped law above does not presume them.*

*Recorded 2026-10-17 by the dev lane. Status: DESIGN TAKE —
delivered to Adam 2026-10-16 in answer to his question, and
carried as the working design since. It is NOT a pinned build
plan: Adam's pin turns it into one. The two cheap-now constraints
in section 5 were folded into the single-player build from S1
onward precisely so this design would still fit when its turn
came — and they held.*

## 1. The four principles

1. **Quests stay personal.** Your quest log, your offers, your
   progress, your rewards. Joining someone's world does not hand
   you their quests, and hosting does not merge yours into theirs.
2. **The world stays shared.** One world, one population of
   creatures, one set of zones, one sky — the host's world is the
   real one, and everything in it is shared, creature for
   creature (the primer's promise, kept).
3. **The host owns consequences.** World-state outcomes of quests
   (a species thinned, a herd grown, a settled individual sown)
   are written once, by the host, whoever's quest caused them.
4. **Interference is a branch, never a break.** Another player
   touching your quest's subject can reroute your quest. It can
   never fail it, void it, or strand it incompletable.

## 2. Authored quests

**Chain quests** (the chapter lines, Ask the World) are already
personal by construction: they read the player's own signals and
latch against the player's own state. In co-op they simply
continue — two players in one world can be chapters apart, each
on their own chain, and neither chain knows the other exists.

**World quests** have exactly one pinch point: *one-shot loot in
a shared world.* A ruin heart grants its fate fragment once;
whoever reaches it first would take the content out of the world
for everyone else. Racing your family for story is the one
outcome this design refuses.

- **Rule: quest-critical loot is per-player.** The heart
  remembers being read *by you*. Each player who reaches the
  heart receives the fragment; the structure itself stays
  one-shot for the world (its glow spent, its room plundered) —
  what is per-player is the *grant*, not the world dressing.
- The same rule covers any future authored one-shot: glyphs,
  named artifacts, chapter triggers. If completing it is a
  quest beat, the beat is per-player; if it is world dressing,
  it is shared and singular.

## 3. Automated sagas (The World Asks Back)

The dynamic layer turns out to be the *easiest* kind in co-op,
because the single-player build was shaped for it:

- **Personal Directors over a shared world.** Each player's
  Director runs against their own notebook and offers them their
  own sagas, reading the same shared world state. Offers are
  never synced — a guest's Director never generates for the
  host, and the host's never generates for guests. (This was the
  build's assumption from S1: the host runs the Director for
  *their* sagas over *their* world; a guest is running their own
  Director against the world they're visiting.)
- **Anchors are soft claims.** A saga anchored on a creature
  does not reserve it. If the other player tames it, feeds it,
  or kills it, your saga takes the branch it already owns for
  that outcome — the death branch, the echo — exactly as it does
  solo when the world moves without you. Nobody can grief a
  saga by playing the game near it.
- **Consequences are singular and host-applied.** When a saga
  resolves with a world consequence, the host's world writes it
  once, through the one apply path (section 5), no matter whose
  saga resolved it. If two players run kindred sagas and one
  resolves first, the second player's resolution becomes the
  *already-answered echo*: their quest completes, their reward
  lands, and the world records that the asking was answered
  before they arrived — a story outcome, not a lockout.
- **Guest sagas and the guest's own world.** A saga a guest
  progresses while visiting lives in the guest's notebook. World
  consequences it earns apply to the *host's* world while they
  visit (the shared world is the stage); the guest's personal
  record (resolutions, echoes, settled names) travels home with
  the guest. A saga mid-flight when the session ends simply
  waits — anchors are re-read on the next world it can read,
  the same way neglected sagas already resolve into echoes
  rather than expiring.

## 4. Party sagas — the co-op-native kind

The one genuinely new content class, and the one that serves
the north star (family co-op) directly:

- Offered **only while a session is live** — a party saga is
  never dealt to a solo player and never lingers when the
  session ends (an unfinished party saga closes as an echo:
  *we almost did this together*).
- Its beats **require two people**: stand in two places at
  once, carry and cover (the Fenback's Shared Cover is the
  mechanical precedent — defense already knows how to be a
  two-person verb), witness the same creature from two sides.
- Rewards are **per-player and equal** — a party saga is a
  shared memory with two keepsakes, never a prize to split.
- The deferred Ask the World *co-op pair* from Line 1's own
  backlog is the natural first content for this class when
  Line 1 grows again.

## 5. What the single-player build already did (the audit)

The design's two cheap-now constraints, and where they stand:

1. **Every saga/event record carries the owning player's id.**
   Folded in at S1 (the asksBack ledger) and held through S5 —
   a saga already knows whose it is, so per-player Directors
   need no data migration. ✓ standing.
2. **All world-state consequence writes flow through ONE
   host/author-only apply function.** Landed as
   `applyZoneConsequences` with its author gate in S4
   (`!isConnected || isHost`). Party and guest resolutions will
   call the same gate; nothing writes around it. ✓ standing.
3. Supporting structure already live: host-authoritative zone
   snapshots; the BioTunnel guest fix (S5) proving host-state
   can be lent to guests safely; Shared Cover (shield family)
   proving the sim can reason about a second player's position
   relative to the first.

## 6. Open questions — Adam's pin settles these

1. **Guest persistence:** does a guest's in-progress saga in a
   host's world appear in the guest's log between sessions, or
   only while connected? (Design leans: it appears — personal
   quests are personal; its beats simply can't progress in a
   world it can't read.)
2. **Party saga dealing:** offered to the host only (who shares
   it by accepting together), or dealt to both players as a
   joint offer both must accept?
3. **The already-answered echo's reward:** full reward, or the
   echo's lighter keepsake? (Design leans full — the player did
   the work; the world answered early.)
4. **Per-player heart grants vs. the fragment economy:** five
   fragments complete a world's chapter — in co-op, two players
   can each complete it from the same five ruins. Design says
   that is correct (the chapter is a personal revelation about
   a shared world), but it is Adam's flavor call to confirm.
5. **Guest-built structures and settled individuals in a host
   world** already persist host-side; should a guest's settled
   record outlive their last visit when the *host* later kills
   the individual? (Connects to S7's settled-deaths ledger —
   the two designs should be read together at build time.)
