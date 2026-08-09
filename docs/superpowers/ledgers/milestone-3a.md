# SDD ledger — plan: docs/superpowers/plans/2026-08-09-milestone-3a-shooting-core.md
Task 1: complete (commits 49599b5..ce412f0, review clean)
Task 2: fix round 1/5 (1 addressed, 0 open — deferred reload refill; commits c70c9b1..822e991)
Task 2: complete (commits ce412f0..822e991, review clean after fix round 1)
Note for Task 4: HUD should call setReloading(isReloading(elapsed)) BEFORE setAmmo so the settle() side effect lands first
Task 3: fix round 1/5 (1 addressed, 0 open — world-space impact normals; commits 2f530e3..53c8c36)
Task 3: complete (commits 822e991..53c8c36, review clean after fix round 1)
Task 4: complete (commits 53c8c36..7e1ec3c, review clean)
Final review: fix wave 7e1ec3c..f385554 — overlay z-order, re-review clean
Final review notes for M3b/M4: view kick permanent + sensitivity-coupled (extract KICK_RADIANS, consider recovery); jumping under a lamp can clip the bulb (eye 2.28-2.52m band); shots pass through bulbs (introduce explicit shootables set in M3b); lock referenced before declaration in main.js (TDZ trap, reorder in M3b); hardcoded '6 / 6' in index.html; consider extracting input wiring to src/player/input.js when enemy lands
