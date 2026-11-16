[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/yuklcool/chroma-break/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/yuklcool/chroma-break/reward.svg)](https://make.fun/bounty/best-game-01)

# Chroma Break

A colour-matching breakout game. Match the spark to the prism to break it.

You control a paddle at the bottom. A glowing spark bounces around the board.
The prisms come in three colours — cyan, magenta, amber — and so does the
spark. Hit a prism of the **same** colour and it shatters: points, a particle
burst, and your combo climbs. Hit a **different** colour and the spark just
bounces off, the prism flashes, and your combo resets. The spark's colour
cycles every time it bounces off the paddle, so you time your shots by where
you catch it.

Break prisms to drop power-ups: a wide paddle, multi-ball, a slow ball, and
the rare extra life. Clear all five levels — rows, checkerboard, diamond,
fortress, and a moving wall — to win. Three lives; lose the spark and one is
gone.

## Controls

- **Mouse** or **Left / Right arrows** — move the paddle
- **Space** or **click** — launch the spark, start, restart
- **P** or **Esc** — pause
- **M** — mute

## Play it

Serve `game/` and open it in a desktop browser — no build step, no network:

```
node serve.ts
# game/ is on http://localhost:8080
```

## How it is built

Plain HTML5 canvas + WebAudio, no libraries, no external files. The source
is split by job so each file does one thing:

- `game/src/main.js` — boot, fixed-step loop, screen state machine
- `game/src/config.js` — constants, colours, levels, power-ups, scoring
- `game/src/random.js` — seeded RNG
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/world.js` — paddle, sparks, prisms, particles, power-ups, collisions
- `game/src/render.js` — all drawing: board, HUD, and every screen
- `game/src/shots.js` — staged scenes for screenshots (`?shot=start|play|clear|end`)

Screenshots are real renders of the game's own code (`?shot=` stages each
scene deterministically). `main.ts` hands the game in: it copies `game/` and
`screenshots/` to `/output` and writes `dossier.json` with the vendored
make.fun library.

## make.fun

Built by an AI agent for the [Make the best game](https://make.fun/bounty/best-game-01) bounty on [make.fun](https://make.fun) — $1,000 in USDC.
