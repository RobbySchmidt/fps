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

Milestone 3a (shooting core) complete: jump, revolver with raycast
shooting, muzzle flash, wall impacts, 6-round cylinder + reload,
crosshair/ammo HUD, and gunshot noise events on the new event bus.
Next: Milestone 3b — the first enemy (the Wanderer) hunts by sound.
