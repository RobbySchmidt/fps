# SDD ledger — plan: docs/superpowers/plans/2026-08-10-kitchen-combat-test-slice.md
Branch: feature/kitchen-combat-test-slice (from main @ 12b06a8; baseline 102 tests green; .gitignore commit 4380b07)
Task 1: complete (commits 4380b07..b3f0605, review clean)
Task 2: minor (deferred): expandFurniture silently yields empty footprint when x0>x1 or z0>z1 (no inverted-rect guard)
Task 2: complete (commits b3f0605..91f78cf, review clean; 113 tests verified by controller)
Task 3: fix round 1/5 (1 addressed, 0 open — map literal restored verbatim from brief; commits 40c2d2d..4f9d755)
Task 3: complete (commits 91f78cf..4f9d755, review clean after fix round 1)
Task 4: complete (commits 4f9d755..d44b973, review clean)
Task 5: complete (commits d44b973..5462acf, review clean)
Task 6: complete (commits 5462acf..63e1434, review clean)
Final review: mergeable; fix wave 63e1434..bd54e32 (3 addressed: expandFurniture kind+inverted-rect validation w/ tests; stale comment; test bound 4→2.5), re-review clean, 125 tests
Parked/deferred for M4a proper: door-overlap validation unimplementable today (parseMap does not record D cells) — make it an M4a prerequisite; wandererAI 'defaults' test does not discriminate the cell default (sightSet half is load-bearing); lamp PointLight distance 9m blankets small 1m-cell rooms (may read flat — check in playtest); full mansion at 1m cells => 1000+ wall meshes + per-shot shootables rebuild (perf question 5)
Playtest round 1: mechanics OK (cover, pathing, shoot-over-low). Findings: (1) walk-through chairs read as the monster clipping — new rule: freestanding solid-looking furniture always blocks ('low'); 'decor' reserved for visually passable dressing (rugs, wall decor). (2) 12x8m kitchen too tight vs 11 m/s burst enemy — enlarged to 16x10m for round 2; blueprint sizing rule: kitchen-size is the MINIMUM fight room, small blueprint rooms (study 7x7, drawing 11x6) must grow or be non-combat pressure rooms.
M4b wishlist (user, parked): jump/vault onto low furniture — movement tech, very fun but needs vertical collision + AI reach rules; design note: Wanderer 1.9m reach must cover 0.9m surfaces so tables are repositioning, not safety
