# SDD ledger — plan: docs/superpowers/plans/2026-08-09-milestone-1-greybox-mansion.md
Task 1: complete (commits fd2cbfb..07f1860, review clean)
Task 2: minor (deferred): no negative-delta lower clamp in gameLoop; no explicit double-start/stop tests
Task 2: complete (commits 07f1860..235fab5, review clean)
Task 3: minor (deferred): parseMap accepts ragged rows silently; no cols/rows assertion for production MAP; multiple S silently uses last
Task 3: complete (commits 235fab5..07744a5, review clean)
Task 4: minor (deferred): no corner-approach/tangency edge tests beyond brief's suite
Task 4: complete (commits 07744a5..ab70f1c, review clean; wallSet key-format cross-check resolved by controller)
Task 5: minor (deferred): pixelRatio not re-evaluated on resize; pixel-level visual check pending human (Task 9 acceptance)
Task 5: complete (commits ab70f1c..c696559, review clean)
Task 6: minor (deferred): setupPointerLock has no unsubscribe path (listener stacking if called twice); interactive pointer-lock check pending human
Task 6: complete (commits c696559..b0b5e19, review clean)
Task 7: minor (deferred): keys can stick on window blur/alt-tab (no blur handler clearing key state); no e.repeat guard
Task 7: complete (commits b0b5e19..56998fe, review clean)
Task 8: minor (deferred): no integration test for KeyF-on-keydown
Task 8: complete (commits 56998fe..6c4f813, review clean)
Task 9: complete (commits 6c4f813..ef1698c, review clean; flood-fill: 236/236 floor cells reachable; interactive walkthrough pending human)
Final review: fix wave ef1698c..5b2fbbd — 8/8 findings addressed
Final review: parked — gameLoop start() schedules '() => frame(generation)' closing over live variable; two stop/start cycles before first frame flush can double-fire update — ruling: real but unreachable in M1 (stop() never called); MUST fix (snapshot 'const gen = generation') before M2 pause menu; minimal 2-line change
