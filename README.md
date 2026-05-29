# escape-base

A mobile-first platform for building customizable **point-and-click** experiences (escape-room / hidden-object style), designed to embed inside the **stqry** app. Games are pure data (a schema-validated JSON document); a Pixi/WebGL engine plays them and a visual editor authors them.

## Live

- **Play:** https://violet-lgtm.github.io/escape-base/
- **Editor:** https://violet-lgtm.github.io/escape-base/?edit

Handy URL flags: `?cluster=<id>` opens a specific room cluster, and `?debug` shows a testing-only reset button.

## What's here

A pnpm + TypeScript monorepo:

```
apps/web/         Vite + React + Pixi app — player, editor, and a sample game
packages/schema/  zod schema + types for a Game (the contract)
packages/engine/  framework-agnostic runtime (state machine / interpreter)
packages/storage/ stqry storage bridge, persistence, and cluster routing
```

Key ideas:

- **Content is data.** A game is a JSON graph of rooms → hotspots → conditions/actions. The engine interprets it; the renderer draws it; the editor produces it.
- **Hotspots** can be invisible regions or clickable **sprite-objects**, in **rect / ellipse / polygon** shapes, all authored in the background image's coordinate space so they stay locked to the art on any screen.
- **stqry integration.** Inventory/progress persist via the stqry storage bridge (which survives across separate room page loads); "rooms" map to stqry web-page items, navigated with a hybrid in-app / `linking.openInternal` routing model.

## Develop

```sh
pnpm install      # deps (the SessionStart hook runs this automatically on the web)
pnpm dev          # run the web app locally
pnpm typecheck    # tsc across all packages
pnpm test         # vitest
pnpm build        # production build of the web app
```

## Deploy

Pushing to the development branch triggers the **Deploy Pages** GitHub Actions workflow, which builds the app (with the `/escape-base/` base path) and publishes it to GitHub Pages.
