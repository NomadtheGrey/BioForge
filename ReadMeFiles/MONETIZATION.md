# BioForge — Monetization Strategy & Revenue Architecture

> **Status: SUPERSEDED (2026-10-18, the docs sweep).** The plan
> below is AI-Studio-era (in-app purchases, a bio-pass, a
> marketplace) and was never adopted. **The pinned plan**
> (Adam, 2026-10-18): the game is **free**. Its first home is
> **itch.io** ($0-or-donate pricing, donation button on); a
> **Donate** door in the game opens two doors — **Ko-fi**
> (live, via `KOFI_URL` in src/game/links.ts) and the itch page
> itself (lit when the page stands, via `DONATE_URL`). Sequence:
> wrap → itch page → beta test → **CrazyGames** second (ad
> revenue; the donate button is toggled OFF in the portal build)
> → a real domain after beta. Poki is skipped (5-year web
> exclusivity); Steam only if the numbers ever argue for it.
> Adam's stance, verbatim: "I don't expect to make my riches
> with this, but it was fun, and no harm in trying to get this
> where people can find it." The decision brief lives at
> `~/workspace/goals/bioforge-debugging/files/bioforge-future-decision-brief.md`.
> Everything below this note is the unadopted draft, kept for
> the record.
> **Last Updated:** October 7, 2026 (superseded October 18, 2026)
> **Game Version:** v0.1.0  
> **Core Ethos:** Fair-Play, Zero Pay-to-Win, Expression & Community-First

---

## 1. Executive Summary & Philosophy

BioForge is an open-world ecosystem exploration, bio-crafting, and living base-building game set in a vibrant **Prismatic Botanical Tech** aesthetic. The monetization architecture is built on three unbreakable pillars:

1. **Zero Pay-to-Win:** Core progression, material yields, maturation speeds, and crafting recipes are 100% earnable through in-game play. There are no paywalled gameplay advantages, energy-gated timers, or paid shortcuts.
2. **Aesthetic & Creative Expression:** Players invest in self-expression—personalizing their explorer bio-suits, living architectural styles, companion aesthetics, and customized colorways.
3. **Multiplayer "Guest Pass" Inclusion:** Premium expansion biomes can be joined and enjoyed by non-owning friends if the host owns the expansion, preventing community fragmentation.

---

## 2. Revenue Stream Architecture

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      BIOFORGE REVENUE STREAMS                          │
 └──────┬────────────────────┬────────────────────┬──────────────────┬────┘
        │                    │                    │                  │
        ▼                    ▼                    ▼                  ▼
 [ Prismatic Atelier ] [ Sol-Cycle Pass ] [ Biome Expansions ] [ Cloud Groves ]
  Cosmetic Skins &      Seasonal Bio-      Major Worlds with     24/7 Dedicated
  Living Architectures  Track Rewards      Guest Pass Access     World Relays
```

---

### Stream 1: The Prismatic Atelier (Aesthetic In-App Purchases)
Direct-purchase cosmetic enhancements rendered with high-fidelity PBR materials, custom shaders, and bioluminescent particle accents.

#### Architectural Finishes & Themes
* **Chitin-Glass Treatments:**
  * *Holographic Aurora Glass:* Refracts environmental light into rainbow gradients.
  * *Starlight Obsidian Glaze:* Deep smoky crystal with pulsing constellations.
  * *Opalized Pearlescent Finish:* Iridescent mother-of-pearl sheen.
* **Living Door Apertures:**
  * *Lotus Petal Iris:* Multi-layered floral leaves that unfold outward.
  * *Spiral Nautilus Conch:* Organic spiral opening inspired by marine geometry.
  * *Bioluminescent Nebula Seal:* Swirling starry portal that dissipates upon approach.
* **Root-Tile Foundation Dyes:**
  * Bioluminescent cyan circuitry veins, violet mycelial rugs, golden crystalline parquet.

#### Explorer Bio-Suit Customization
* **Chassis Overhauls:**
  * *Void Botanist:* Deep indigo carbon plating with pulsating star-spore canisters.
  * *Porcelain Valkyrie:* Fluted ivory ceramic armor with golden filament joints.
  * *Solar Arbiter:* Radiant amber carapace plates that shimmer in daylight.
* **Particle Trails & FX:**
  * Luminescent footsteps that sprout micro-ferns as you sprint.
  * Bioluminescent vapor jet trails during high-speed travel.
  * Customizable visor HUD color palettes and audio frequency visualizers.

#### Companion Critter Adornments
* Crown crests, crystal horn caps, and glowing trailing ribbons for tamed Soft-Puffs.
* Polished harness plating and customized neon chitin tints for guardian Chitin-Stalkers.

---

### Stream 2: Ecosystem Sol-Cycles (Seasonal Bio-Pass)
Quarterly themed seasons synchronized with community events:

* **Structure:** 50 tiers of rewards achieved through natural exploration, harvesting, and building milestones.
* **Dual Track:**
  * **Free Naturalist Track:** Awards foundational seeds, compost nodes, and standard seasonal codex badges.
  * **Premium Bio-Pass Track ($9.99):** Unlocks 50 tiers of premium architectural skins, synthesizer soundscape packs, animated holographic emotes, and exclusive seasonal companion colorways.
* **No Expiration Fatigue:** Once a pass is purchased, players can continue progressing it at their own pace without fear of missing out.

---

### Stream 3: World Expansion Biome Packs (Major Expansions)
Semi-annual content expansions introducing massive new biomes, exotic lifeforms, and advanced building nodes:

* **Example Expansions:**
  * *The Sub-Surface Mycosphere:* Bioluminescent cavern ecosystems, deep fungal networks, spore elevators, and subterranean burrowing fauna.
  * *The Aerial Cloud-Canopy:* Floating floating-island biomes, aerial vine-gliders, spore-kites, and high-altitude predatory avians.
* **Guest-Pass Co-Op Protocol:**
  * As long as the session host owns the expansion, any friend connecting via room code can explore, build, and harvest within the new biome for free.

---

### Stream 4: Persistent "Cloud Groves" (Dedicated World Relays)
BioForge natively supports free browser-to-browser P2P networking. For dedicated player groups and communities:

* **Cloud Grove Subscription ($4.99 / month):**
  * Persistent 24/7 dedicated world relay hosted in the cloud.
  * Worlds remain online and accessible even when the creator’s browser tab is closed.
  * Plants continue to mature and tamed companions continue collecting perimeter byproducts.
  * Automated cloud backups with single-click snapshot restores.

---

### Stream 5: Community Architect Marketplace
* A creator-driven ecosystem allowing advanced builders to package and publish architectural templates, base blueprints, and custom botanical gardens.
* **Revenue Split:** 70% to the community creator, 30% to platform infrastructure and development.
* Curated quality standards ensure all published blueprints adhere to performance benchmarks.

---

## 3. Long-Term Growth Roadmap

| Phase | Milestone | Primary Monetization Focus |
|---|---|---|
| **Phase 1: Genesis (v0.1 – v0.5)** | Core Sandbox Polish & P2P Stability | Launch of Prismatic Atelier (Base Cosmetics & Dyes) |
| **Phase 2: Sol-Cycles (v0.6 – v1.0)** | Seasonal Ecosystem Progression | Introduction of Season 1 Bio-Pass & Custom Suites |
| **Phase 3: Deep Frontier (v1.1+)** | World Expansions & Relays | Cloud Grove Dedicated Relays & First Major Biome Pack |
| **Phase 4: Open Ecosystem (v2.0+)** | Creator Economy | Community Architect Marketplace Launch |
