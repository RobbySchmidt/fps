# SDD ledger — plan: docs/superpowers/plans/2026-08-09-milestone-2-art-pass.md
Task 1: complete (commits bdb7a9f..7fbf573, review clean — parked M1 finding resolved)
Task 2: complete (commits 7fbf573..7fc47b5, review clean)
Task 3: minor (deferred): createPostStack has no dispose path for its resize listener
Task 3: complete (commits 7fc47b5..ebf38f1, review clean; GPU shader compile pending human visual check)
Task 4: complete (commits ebf38f1..99a66e8, review clean)
Task 5: complete (commits 99a66e8..d5e1a53, review clean)
Final review: fix wave d5e1a53..c517d79 — PALETTE.ink wired, re-review clean
Final review: tuning inputs for human visual check — grain applied in linear space (may read strong/blotchy in darks; structural fix if so), composer target has no MSAA samples (jaggies possible), grain animation formula near-static at bottom-left corner
Deferred: postStack/scene resize listeners + render targets have no dispose path (page-lifetime objects; revisit with M3 pause/teardown); depth pre-pass pays full shading (override material when M3 adds enemies)
Feedback round 1: complete (commits c517d79..3d28f4e, review clean) — grain removed, moody lighting: 6 warm lamps, 2 dark rooms, ambient up, fog relaxed; MAP walls verified identical
Note: user idea logged — basement/cellar as dark endgame area, candidate for M4 content
