# SDD ledger — plan: docs/superpowers/plans/2026-08-09-milestone-3b-wanderer.md
Task 1: minor (deferred): findPath uses linear open-set scan + unshift reconstruct (fine at ~360 cells); hasLineOfSight has no near-corner grazing test
Task 1: complete (commits bd80599..5692083, review clean)
Task 2: minor (deferred): fraction() unguarded against max=0; damage() does not validate negative amounts
Task 2: fix round 1/5 (1 addressed, 0 open — regen dt clamped to time past the delay; commits 2922ea1..6d9ba1d)
Task 2: complete (commits 5692083..6d9ba1d, review clean after fix round 1)
PLAN DEFECT (fixed in code, plan file still wrong): Task 2's brief used '<' where its own test required '<=' plus dt clamping — do not copy the brief's health update() verbatim if regenerated
Task 3: minor (deferred): burstFreezeFactor returns 1 for all negative t (game time is non-negative); no tests for non-default options
Task 3: complete (commits 6d9ba1d..dedf06a, review clean)
Task 4: fix round 1/5 (5 findings fixed but 2 pre-existing tests brittle vs new speed — implementer escalated NEEDS_CONTEXT, correctly refused to weaken tests)
Task 4: fix round 2/5 (5 addressed, 0 open — chaseSpeed 11 outrun-proof, investigateTimeout 12, throttled repath, LOS-gated melee, attackReachBonus; fixtures moved to 7*CELL; commits 941be5d..e1058d2)
Task 4: minor (deferred): the 'cannot wind up without line of sight' test is vacuous — its wall also blocks canSee so the windup gate is never reached; production fix verified by inspection
Task 4: complete (commits dedf06a..e1058d2, review clean after fix round 2)
Task 5: minor (deferred): new THREE.Color allocated per frame during flash decay (hoist to module constant); no figure test covers windup freeze or flash()
Task 5: complete (commits e1058d2..7e1951e, review clean)
Task 6: minor (deferred): figure collapse/flash tweens advance while paused (matches existing muzzleFlash convention, sub-second); per-frame object allocation in position()/facing()/update snapshot
Task 6: complete (commits 7e1951e..d02512d, review clean)
Task 7: fix round 1/5 (2 addressed, 0 open — isPlaying gates on shoot/reload/jump, HUD refresh in retry; commits 3ec9aeb..5d15566)
Task 7: minor (deferred): one residual frame of movement after death (async pointer unlock, out of scope); screenShake has no reset (decays in 0.16s)
Task 7: complete (commits d02512d..5d15566, review clean after fix round 1)
Task 8: complete (commit b57a764, README status)
Final review: fix wave b57a764..cae7238 — 5 findings addressed (CRITICAL stagger vs gunshot noise; retry overlay fallback; corpse shots pass through; FLASH_COLOR hoisted; look reset on retry), re-review clean
Final review notes for M4: extract an encounter/enemies module (array of {ai, figure}, shootables registry, noise subscription, resetAll) before adding the second enemy; fix the vacuous LOS-windup test; watch staggerTime 0.35 == fireCooldown 0.35 (possible stun-lock); chase tracks true player position through walls for 6s (undocumented design choice)
Perf investigation: user-reported stutter root-caused via evidence (heap sawtooth ~10MB drops = GC pauses; prod build smooth => dev-mode amplification). Fixes: hasLineOfSight per-step allocations removed (8035157); perf overlay kept as permanent debug tool (toggle P), misleading draw-call metric removed (df95a10)
M4 note: further allocation trims available if dev-mode play still stutters (collision string keys, AI snapshot objects)
