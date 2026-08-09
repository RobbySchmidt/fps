# Mansion (working title)

A stylized survival-horror FPS for the browser. Three.js + Vite, plain
JavaScript. See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Run

    npm install
    npm run dev    # dev server
    npm test       # unit tests
    npm run build  # production build to dist/

## Controls

| Input | Action |
|---|---|
| Click | Start / resume (locks the mouse) |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| Space | Jump |
| F | Flashlight on/off |
| Left click | Fire revolver |
| R | Reload |
| Esc | Pause (releases the mouse) |

## Status

Milestone 3b (the Wanderer) complete: a mantis-bladed monster hunts the
mansion with A* pathfinding, hears gunshots and sprinting, charges in
stop-motion jitter, and telegraphs its strike by going utterly still.
Shoot it to stagger it; four body shots or one headshot kill it. The player
has health with regeneration, a death screen and instant retry.
Next: Milestone 4 — content (keys, second enemy, shotgun, pickups, basement).
