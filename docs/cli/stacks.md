# Supported stacks — the platform contract

BlankCut runs a deliberately small, opinionated set of stacks so every app gets
the same guarantees: build, deploy, health, and secrets. An app is checked
against this contract at onboarding; apps outside it are rejected or held for
manual review.

## Supported application stacks

- **Node.js** — Next.js and Vite are first-class; Express / Fastify / NestJS APIs
  run too.
- **Python** — Flask, FastAPI, Django.
- **Go**.

## Provided backing services

Use these — don't bring your own:

- **PostgreSQL**, preferably **Supabase** (managed per app).
- **Redis** (in-cluster per app).

## Rules for any work in a platform repo

- Stay within the supported stack. Do **not** introduce a different
  language/runtime, or a framework the platform doesn't run.
- Do **not** add infrastructure the platform doesn't provide (other databases,
  message brokers, search engines, etc.). If you think you need one, stop and ask
  — it likely means the app isn't a fit, or the capability should be requested
  from the platform team.
- Every service runs as a container and must expose a **`/health`** endpoint that
  returns `200` when healthy.
- Declare every environment variable the app needs in **`.env.example`** — that
  file is the allowlist the platform's secret store enforces (see
  [Secrets](secrets.md)).
- Builds must be safe to run unattended: no piping downloaded scripts into a
  shell, no install-time hooks that fetch and execute, and base images only from
  trusted registries. The onboarding gate flags these and pauses the app for
  review.

Staying inside the contract is what lets the platform actually support what you
ship.
