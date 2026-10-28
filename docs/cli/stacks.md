# Supported stacks — the platform contract

Meerkat runs a deliberately small, opinionated set of stacks so every app gets
the same guarantees: build, deploy, health, and secrets. An app is checked
against this contract at onboarding; apps outside it are rejected or held for
manual review.

## Supported application stacks

- **Node.js** — Next.js and Vite are first-class; Express / Fastify / NestJS APIs
  run too.
- **Python** — Flask, FastAPI, Django.
- **Go**.

The stack is read from the app's manifest (`package.json`, `requirements.txt`,
`pyproject.toml`, `Pipfile`, `setup.py` or `go.mod`) at the root of the
repository, or, since v0.26.1, beside the `Dockerfile` that builds the app
when it lives in a subfolder such as `client/`.

## Provided backing services

Use these — don't bring your own:

- **PostgreSQL**, preferably **Supabase** (managed per app):
  `blankcut database add`, or `--database` when you onboard or provision.
- **Redis** (in-cluster per app): `blankcut redis enable`.
- **File storage** for images, video and uploads:
  [`blankcut storage add`](storage.md).
- **Scheduled jobs** that call your app's own endpoints:
  [`blankcut schedule add`](schedule.md).

## Rules for any work in a platform repo

- Stay within the supported stack. Do **not** introduce a different
  language/runtime, or a framework the platform doesn't run.
- Do **not** add infrastructure the platform doesn't provide (other databases,
  message brokers, search engines, etc.). If you think you need one, stop and ask
  — it likely means the app isn't a fit, or the capability should be requested
  from the Blank Cut team.
- Every service runs as a container and must expose a **`/health`** endpoint that
  returns `200` when healthy.
- Declare every environment variable the app needs in **`.env.example`** — that
  file is the allowlist the platform's secret store enforces (see
  [Secrets](secrets.md)).
- Builds must be safe to run unattended: no piping downloaded scripts into a
  shell, no install-time hooks that fetch and execute, and base images only from
  trusted registries. The onboarding gate flags these and pauses the app for
  review.
- Every image is [scanned for vulnerabilities](scan.md) before it's pushed.
  Keep the base image patched and dependencies current.

`blankcut validate` checks a repository against these rules locally, before you
connect it. See [Deploy an app](deploy.md#connect-an-existing-repo) for the full
list of checks.

Staying inside the contract is what lets the platform actually support what you
ship.
