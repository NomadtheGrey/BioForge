# BioForge Multiplayer — Two-Tab Test Checklist

**Setup:** Open the game in two browser tabs (same machine). Tab A presses `M` → Host → copy the room code. Tab B presses `M` → Join → enter the code. Both tabs start with the identical world.

Work through in order. Mark each ✓ or ✗ and note what you see.

## 1. Connection
- [ ] Tab B shows "Explorer Joined" toast in Tab A
- [ ] Each tab sees the other's avatar (colored capsule) moving in the world

## 2. Planting (Tab A plants → Tab B sees it)
- [ ] In Tab A, plant a seed with the trowel
- [ ] The seedling appears in Tab B within a second

## 3. Fertilizer (Tab A fertilizes → Tab B sees it)
- [ ] In Tab A, apply growth fertilizer to a plant
- [ ] Tab B sees the plant jump in growth / become harvest-ready

## 4. Harvest (Tab A harvests → Tab B sees reset)
- [ ] In Tab A, harvest a ready plant with the glove
- [ ] Tab B sees the plant reset to seed stage (not stuck "ready")
- [ ] Wait — Tab B's plant becomes harvestable again after the regrow timer

## 5. Building (Tab A builds → Tab B sees it)
- [ ] In Tab A, place a structure with the builder
- [ ] It appears in Tab B
- [ ] In Tab A, dissolve it with the solvent sprayer
- [ ] It disappears in Tab B

## 6. Doors (Tab A walks to a door → Tab B sees it open)
- [ ] In Tab A, walk up to an iris door
- [ ] The door opens on Tab B's screen too, even though Tab B's player is far away

## 7. Drops (the host-authority test)
- [ ] Tame a soft_puff (Tab A), wait for it to excrete a bio_pellet
- [ ] **Exactly one** pellet appears — and it appears in Tab B as well (no duplicates = authority working)
- [ ] In Tab B, walk over the pellet to pick it up
- [ ] It disappears in Tab A (no ghost drop)

## 8. Host authority over time (let it run 2–3 minutes)
- [ ] Plants keep growing on both tabs (guest tab grows via host upserts)
- [ ] Critters wander on both tabs (positions may snap slightly on the guest — expected at 2Hz)
- [ ] Day/night stays in sync between tabs (check the sky/lighting matches)

## 9. Chat (regression check)
- [ ] `M` → send a chat message from Tab A → arrives in Tab B

## Known limitations (don't file as bugs)
- Tamed critters in follow mode track the **host's** player on both screens
- Guest-side fauna positions update twice a second — slight stepping is expected
- Fauna tame notifications say "tamed a companion for the base" on both tabs

## If something fails
Note: which step, which tab did the action, what the other tab showed (or didn't). The message layer logs to the console — F12 → Console in the tab that should have *received* the update, and look for errors.
