# Deploy an app

There are two ways to get an app onto Meerkat, depending on whether the code
already exists:

| You have | Run | What you get |
|---|---|---|
| A repository on GitHub | [`blankcut onboard`](#connect-an-existing-repo) | The app registered, and a setup pull request on your repo |
| Nothing yet | [`blankcut provision`](#create-a-new-project) | A new repo with a runnable starter, its backing services, and a first deploy |

Either way, you ship changes afterwards with
[`blankcut promote --app`](#deploy-a-new-version).

!!! info "Before you start: connect GitHub"
    Meerkat reaches your repositories through the **Blank Cut GitHub App**, and
    your organization installs it on the GitHub account that owns the repo. Do
    that once from [meerkat.blankcut.com](https://meerkat.blankcut.com). If it
    isn't installed, `onboard` and `provision` stop and say so.

---

## Connect an existing repo

Run it inside the repository, or point at one with `--repo`:

```bash
cd my-app
blankcut validate      # optional: the readiness checks, run locally
blankcut onboard
```

`onboard` registers the app to your organization and opens a **setup pull
request** with the platform layout: a `Dockerfile`, `docker-compose.yml`,
`.env.example` and a `CLAUDE.md` for coding agents, plus a migrations workflow
when the app gets a database. It never overwrites a file you already have. It
also gives the repository the CI key its build uses, so you don't have to set
one up. The build workflow itself arrives with your first `promote`.

**It doesn't deploy anything.** When it finishes, it prints the next three
steps:

```bash
# 1. Review and merge the setup pull request
# 2. Set the app's secrets
blankcut secrets push --app my-app
# 3. Deploy
blankcut promote --app my-app
```

| Flag | Effect |
|---|---|
| `--repo <URL>` | The GitHub repository. Defaults to the current checkout's `origin` remote. |
| `--name <APP>` | The app's name on Meerkat. Defaults to the repository name. |
| `--tier sandbox` | Start on the [Rough Cut tier](#rough-cut-and-production). Defaults to `production`. |
| `--database` | Also provision a dedicated managed Postgres for the app. |

`blankcut validate` runs the same readiness checks locally, offline. It prints
`[PASS]` or `[FAIL]` for each check and exits `1` if any fail, so it works as a
CI gate:

- The stack is a [supported one](stacks.md) (Node.js, Python or Go)
- No risky build or install patterns (scripts piped into a shell, install hooks
  that download and run code, untrusted base images)
- A `Dockerfile` exists and uses a multi-stage build
- A `docker-compose.yml` exists
- `.env` is listed in `.gitignore`, and `.env.example` exists
- No hardcoded secrets (API keys, tokens, connection strings with passwords)

`blankcut validate --fix` hands the failing checks to Meerkat, which opens a
pull request with the fixes and watches the build that follows.

??? note "Scaffolding locally with `blankcut init`"
    `blankcut init` writes the same project layout into the current directory
    without contacting Meerkat. It never overwrites a file: it only creates
    missing ones and adds missing entries to `.env.example` and `.gitignore`.
    `--name` sets the app name (the directory name by default).

    `init` registers nothing and deploys nothing, and there's no build workflow
    until a promote generates one. To deploy a repo scaffolded this way, push it
    to GitHub and run `blankcut onboard` in it to register the app, then
    `blankcut promote --app <name>`. Until it is onboarded, `promote` answers
    "not authorized" for it.

---

## Create a new project

```bash
blankcut provision --name my-app --owner my-github-org
```

`provision` creates a repository in your GitHub organization, seeded with a
runnable starter: backing services already wired in, a `/health` endpoint, and a
`CLAUDE.md` that keeps a coding agent on the supported stack. It registers the
app and provisions its backing services. **The starter deploys on its own** once
its first image builds; watch it with `blankcut status --app my-app`. Then clone
the repo and ship your changes with `blankcut promote --app my-app`.

| Flag | Effect |
|---|---|
| `--name` | The project name. Required. |
| `--owner` | The GitHub organization to create the repo in, the one the Blank Cut GitHub App is installed on. |
| `--stack` | The starter: `nextjs` (default), `vite`, or `marketing`. |
| `--tier` | `production` (default), or `sandbox` for [Rough Cut](#rough-cut-and-production). |
| `--database` / `--no-database` | Force a dedicated Postgres (and its migration pipeline) on or off. Leave both off for the stack's default: application stacks get one, marketing sites don't. |
| `--display-name` | A human-readable label for the project. |

!!! warning "This spends money"
    `provision` creates a real repository, a build pipeline, a place in the
    cluster and usually a database, and all of them bill from the moment they
    exist. If it's refused, the message is an answer rather than a glitch:
    a plan, trial, card or account limit (`402`/`403`) or project creation not
    being enabled for the CLI (`503`) won't change if you retry.

Personal GitHub accounts need a consent step that only the browser can host, so
create projects for a personal account in the [Meerkat console](https://meerkat.blankcut.com).

---

## Deploy a new version

```bash
blankcut promote --app my-app
```

`promote` deploys the current `main` of a registered app. It starts a job on
Meerkat and shows each phase as it runs: analyzing the repo, generating the
build workflow, building the image, and proposing the deploy.

Deploying needs an active organization with a payment method on file. Without
one, `promote` stops before it changes anything and says so: add a card at
[meerkat.blankcut.com/billing](https://meerkat.blankcut.com/billing) and run
it again. Apps that are already running keep running.

**A finished `promote` means the deploy is proposed, not that it's live.** It
opens a pull request on your repo (when the build workflow changes) and a
deploy change on the platform side, and both have to land before the new
version runs. The platform checks an app deploy and applies it, usually within
minutes; if a check doesn't pass, it waits for a Blank Cut engineer.

An app's **first** deploy also waits for its first successful build, because
until then there is no image to run. Merge the pull request that adds the build
workflow; when that build goes green, the deploy is checked and applied the same
way. If the build fails, fix it and push to `main`: the next green build carries
the deploy through, without running `promote` again.

| Flag | Effect |
|---|---|
| `--app <APP>` | Deploy a new version of a registered app. |
| `--repo <URL>` | Register **and** deploy a repository Meerkat hasn't seen before, in one step. |
| `--dry-run` | Show the deploy change and which secret keys would change, without writing anything. |
| `--to-production` | Move a Rough Cut app to production before deploying it (needs `--app`). |
| `--model claude\|openai\|gemini` | The model that analyzes the repo. Defaults to `claude`. |

### Is it live?

```bash
blankcut status --app my-app      # the facts
blankcut diagnose --app my-app    # what they mean
```

`status` brings the latest GitHub Actions run, the deploy's sync and health
state, the running pods and recent warnings, and any deploy change still waiting
into one view. A source that can't be reached right now comes back empty instead
of failing the whole call. `diagnose` reads the same facts and names the likely
cause, so you get a reason rather than symptoms. A merged pull request is not a
deploy; `status` is the honest answer.

**If the site loads but every data call fails,** suspect build-time
configuration before the code: see [Browser-visible
config](secrets.md#browser-visible-config-next_public_).

### How the build works

The build workflow in your repo holds no cloud credentials and names no build
service. It uploads the source and asks Meerkat to build it, and Meerkat picks
where. Don't add registry credentials or a builder-specific step to it: the
workflow can't reach the registry by design. Anything about the build you want
to change belongs in the `Dockerfile`.

When a build fails, the workflow log names the `Dockerfile` step that failed and
the error it hit, such as a `COPY` of a path the repository doesn't have.
`docker build .` locally reproduces it with the full output.

Every image is **scanned for known vulnerabilities before it's pushed**, and the
build log tells you what the scan found. See [Image scanning](scan.md).

### Several apps from one repository

Some repositories build more than one app (for example a set of sites built from
one codebase). When an app's registered name differs from its repository's,
`promote --app` rebuilds **only that app's image** and leaves the others, and
the app's ingress and secrets, as they are.

- Run it from a clean checkout that matches the repository's current `main`.
  Only committed files are uploaded; local secret files are left out.
- The committed build workflow needs exactly one build entry for the app's
  image, with an explicit `Dockerfile`.
- `--dry-run` prints the one image it would build and the `Dockerfile` it would
  use, without uploading or building anything.
- An image pushed isn't proof of a rollout: check `blankcut status` and load the
  site afterwards.

---

## Rough Cut and production

Every app runs on one of two tiers:

| | Rough Cut (`sandbox`) | Production |
|---|---|---|
| For | MVPs, prototypes, demos | Apps people depend on |
| Resources | Capped | The full envelope |
| Custom domain | No | Yes |
| Redis | Optional add-on, billed separately | Included |

Rough Cut comes with no SLA. A Rough Cut app bills while it's deployed, so pause
it when you're done with it (from the console, or with
`blankcut deprovision --suspend`). Your organization can run a limited number at
once.

When it's ready, move it up:

```bash
blankcut promote --app my-app --to-production
```

That lifts the resource cap, allows a custom domain, puts deploys through review,
and moves billing to the production rate, then deploys.

---

## Your app's address

A deployed app is served at **`https://<app>.blankcut.app`**.
`blankcut context env` lists every hostname it answers on. To serve it on your
own name, see [Domains](domains.md).

!!! note "Apps are moving to `.blankcut.app`"
    Apps used to be served at `<app>.blankcut.com`. Those addresses keep
    working until 2026-10-28, and after that they redirect to the app's
    `.blankcut.app` address. Point webhooks, OAuth redirect URIs and API
    clients at `.blankcut.app` now rather than relying on the redirect.

---

## Pause or remove an app

```bash
blankcut deprovision --app my-app --suspend   # stop it; keep everything needed to bring it back
blankcut promote --app my-app                 # bring a suspended app back
```

`--suspend` stops the running app (so it stops costing) and keeps its secrets,
repository, registration and build pipeline.

Without `--suspend`, `deprovision` tears the app down: **its secrets are deleted
immediately and can't be recovered**, and the rest of its configuration is
removed through reviewed changes, so nothing disappears from the cluster until a
Blank Cut engineer approves it. Two options go further, and both are
irreversible:

- `--transfer-to <github-owner>`: tear everything down and move the GitHub
  repository to another owner, so you keep the code.
- `--delete-repo`: tear everything down and delete the GitHub repository.

`deprovision` asks for confirmation; `--yes` skips the question.
