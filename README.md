# Multiverse Git

An interactive GitHub commit-history visualizer with a multiverse vocabulary:

- **Sacred Timeline** — the default branch
- **Variants** — feature branches
- **Nexus Events** — branch points
- **Convergences** — merges
- **Incursions** — risky or divergent history

It is built with Next.js, React Flow, ELK layout, Zustand, and Tailwind CSS.

## What it does

- Loads a public GitHub repository from `owner/repository` or a GitHub URL.
- Draws a bounded, readable commit DAG rather than attempting to render an
  entire large repository history.
- Highlights the Sacred Timeline, active Variants, real merge relationships,
  Nexus Events, and estimated Incursion risk.
- Supports pan, zoom, minimap navigation, semantic zoom, commit search,
  timeline windows, Variant focus, keyboard selection, shareable focused views,
  and SVG export.
- Includes a demo timeline and clear loading, empty, rate-limit, and fetch-error
  states.

Private repositories are not yet supported. GitHub App-based, per-repository
read access is the intended approach for that work.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then load a public
repository such as `facebook/react`.

## Configuration

All configuration stays on the server; this project does not use
`NEXT_PUBLIC_` variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | No | Uses GitHub GraphQL for richer public-repository data. Without it, the app uses its bounded REST fallback. |
| `MULTIVERSE_REPOSITORY` | No | The public repository loaded when no `repo` URL query is supplied. |

Never commit `.env.local` or expose a GitHub token to browser code.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same quality checks for pushes and pull requests.

## Product boundaries

The graph prioritizes correct ancestry, clear layout, and responsive interaction.
It samples recent history and selected Variant connections, so it deliberately
does not claim to show every commit in very large repositories. Missing ancestry
is not invented in the graph or in risk explanations.
