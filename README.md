# Fart to the Sun

A complete, dependency-free HTML/JavaScript WebGL arcade adventure. Captain Toot travels from Earth to Gassius, Hive Nine and Cinder, then reaches the Sun to win.

## Made by two young creators

This game was entirely made by my 7-year-old twin daughters, with absolutely minimal supervision from their dad. The idea, story, characters, bosses, mechanics, and gloriously gassy sense of humor are theirs.

## Play

Open `index.html` in a modern browser, or run:

```sh
npm start
```

Then open http://127.0.0.1:5173. No install or build is required. Everything runs locally, including graphics and synthesized audio. WebGL must be enabled.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Steer; works even without fuel |
| Hold Space | Fart propulsion; nearby enemies are stunned and hostile projectiles dispersed |
| J | Fire fart shots with automatic aim |
| Hold left mouse | Aim and fire at the pointer |
| E | Throw collected TNT; homes toward bosses or golem shield nodes |
| B | Pause for unlimited free bean refills |
| Esc / P | Pause/resume |
| M | Toggle sound |

Touch devices have on-screen movement, firing, farting, and TNT controls.

## The adventure

- **Gassius — Space Serpent:** 1,000 health. Collect floating red TNT crates and throw four charges at it. Fart nearby to stun it. Its scales resist ordinary shots.
- **Hive Nine — Space Wasp:** a robotic wasp with three health-based phases: telegraphed sting charges, locked-direction laser eyes, and baby-wasp swarms. Shoot or use TNT to damage it.
- **Cinder — Gravity Golem:** three orbiting nodes protect its core and pull the player inward. Use TNT on the nodes, then fire at the exposed core before its shield rebuilds.
- **The Sun:** survive the final flight and its solar flares to win.

Beans are always free. Defeating enemies and bosses earns credits for bigger fuel tanks, stronger shots, and sturdier suits. Every planet repairs the suit and saves a checkpoint in browser storage. The title screen offers Continue; after defeat, Try Again returns to the last planet. In browsers that restrict storage, the current session still has an in-memory checkpoint.

## Code and verification

`game.js` contains the browser-independent simulation; `renderer.js` draws the universe, characters, bosses, particles, and labels with WebGL; `app.js` handles UI, input, audio, and saves. The only Canvas 2D use is generating a glyph atlas, which is then rendered as a WebGL texture. All art is procedural; there are no external packages, assets, fonts, or network services.

```sh
npm run check
npm test
```

The tests cover free refills, fuel use, upgrades, pauses, TNT collection and collision, all boss mechanics, damage, checkpoint validation, and the complete planet-to-Sun progression.
