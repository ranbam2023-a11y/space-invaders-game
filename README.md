# Space Invaders 👾

A super-simple, mobile-first Space Invaders game. One canvas, no dependencies, no build step.

**Play it:** https://space-invaders-game.space-invaders-game.workers.dev

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Drag on the play field, or hold ◀ / ▶ | `←` / `→` or `A` / `D` |
| Fire | Tap the play field, or hold ▲ | `Space` / `↑` / `W` |

## Features

- Auto-scaling canvas that fits any phone screen (safe-area aware)
- Touch controls: drag to move, tap to shoot, plus on-screen buttons
- Three invader types with different point values (10 / 20 / 30)
- Invaders speed up as their numbers thin out and drop lower on each wall bounce
- Endless waves that get faster; 3 lives with a screen-shake on hit
- Chiptune sound effects generated with the Web Audio API (no audio files)
- Zero dependencies, no build step — just `index.html` + `game.js`

## Project layout

```
public/
  index.html   # markup, styles, touch controls
  game.js      # game loop, rendering, input, audio
wrangler.jsonc # Cloudflare Workers static-assets config
```

## Local development

```bash
npm run dev      # serves at http://localhost:8787
npm run deploy   # publishes to Cloudflare Workers
```

## Deploy

Static assets are served directly from Cloudflare Workers via the `assets` binding —
there is no worker script to maintain.

```bash
npx wrangler deploy
```
