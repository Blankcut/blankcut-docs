# Command reference

All commands are run as `blankcut <command>`. Remote commands require a
configured API key (see [Overview & setup](index.md#configure)).

!!! note
    Don't invent flags or endpoints. If a command or flag you need isn't
    documented here, run `blankcut <command> --help`, or ask the Blank Cut team —
    don't guess.

---

## Local commands

### `blankcut init [--name <app>]`

Scaffold the standard platform layout into the current repo. **Non-destructive** —
it never overwrites your files; it merges missing entries into `.env.example` and
`.gitignore`, and refreshes the platform-managed block in `CLAUDE.md` in place.
`--name` overrides the app name (defaults to the current directory name).

### `blankcut validate`

Run the platform readiness checks against the repo. Pure local, no network. Exits
`0` on PASS, `1` on FAIL — usable as a CI gate.

### `blankcut validate --fix`

Delegate failing checks to Meerkat. It opens a pull request (or pushes directly
to `main` where branch protection allows) with the fixes, then watches the
resulting pipeline and self-heals known failure modes.

### `blankcut upgrade`

Update the CLI to the latest release. `--check` reports current vs latest and
lists what changed since your build, without installing anything; `--force`
reinstalls even if up to date. See
[Keep the CLI up to date](index.md#keep-the-cli-up-to-date).

### `blankcut sync`

Rewrite the platform-managed block in this repo's `CLAUDE.md` from the copy built
into your binary, so the guidance a coding agent reads matches the CLI you
actually have. Local and offline — nothing is fetched and no API key is needed.
Only the content between the `BLANKCUT PLATFORM` markers is touched; anything
else in the file is left alone.

Run it after `blankcut upgrade`, since a newer binary usually means new commands
the block should mention. `--check` reports whether the block is stale and exits
`1` without writing, which makes it usable as a CI gate.

---

## Configuration

### `blankcut configure --api-key <KEY> --endpoint <URL>`

Save credentials to `~/.blankcut/config.json`. See
[Configure](index.md#configure).

The endpoint is `https://api.blankcut.com`. `https://agent.blankcut.com` remains
supported, and CLI v0.22.0 and later default new configs to `api.blankcut.com`.

For CI runners, containers, and any environment with no saved config, set
`BLANKCUT_API_KEY` and `BLANKCUT_ENDPOINT` instead — every remote command reads
them. They take precedence per-field, so exporting only `BLANKCUT_ENDPOINT`
points a configured machine at a different service while keeping its stored key.

!!! note
    Environment-variable configuration works from **v0.9.0** onward. Earlier
    builds required `~/.blankcut/config.json` and failed with "CLI not
    configured" regardless of what was exported.

---

## Secrets

All `secrets` subcommands take `--app <APP>` (the lowercased repo name); the
platform resolves where the app's secrets live — you never specify a path. See
the dedicated **[Secrets](secrets.md)** page for the full workflow and rules.

| Command | Purpose |
|---|---|
| `blankcut secrets list --app <APP>` | Print key **names** only — values are never returned. |
| `blankcut secrets sync-example [--env-file FILE]` | Declare the keys from your local `.env` into `.env.example` (names only). Run before `set`/`push` so new keys clear the `.env.example` gate. |
| `blankcut secrets set --app <APP> KEY VALUE [--force]` | Write a single value. The key must already be declared in `.env.example` on `main`. If it already holds a different value the write is held back unless `--force`. |
| `blankcut secrets pull --app <APP> [--env-file FILE] [--force]` | Fetch decrypted values into a local `.env` (mode `0600`). Refuses to overwrite a locally-differing key without `--force`. |
| `blankcut secrets push --app <APP> [--env-file FILE] [--force]` | Bulk-upload a local `.env`. Returns a `set` / `skipped` / `rejected` partition. |
| `blankcut secrets diff --app <APP> [--env-file FILE]` | Compare local keys to platform keys (**names only, never values**). Exits `1` on drift. |
| `blankcut secrets run --app <APP> [--only K1,K2] [--exclude K1] -- <cmd>` | Fetch values and exec a command with them injected into its environment. Never writes a file. |

---

## Understanding your environment

### `blankcut context [--app <APP>] [--json]`

Report what the app **actually** runs in, so code is written against the real
target rather than an assumed one: the resource envelope, how far it scales,
which secret keys reach the running pod, the database engine and version and
connection limit and schema, the image posture, and recent traffic.

Run it before writing or changing code that touches infrastructure.

```bash
blankcut context --app my-app
```

`--app` is optional in a repo the platform knows — the app name is inferred from
the git remote.

**Nothing is cached.** Every run fetches live state or fails, and each response
ends with a `Freshness` block reporting how old each part is. There is no refresh
step and no local cache that can quietly go stale.

**Output is JSON automatically when stdout is not a terminal**, so piping it into
a tool or an agent gives machine-readable data while running it interactively
gives a readable table. `--json` forces JSON either way. Both carry the same
facts.

#### Subcommands

Each narrows the request — the platform only gathers what you asked for.

| Command | Reports |
|---|---|
| `blankcut context env` | Namespace, tier, resource envelope, each workload and its replica count, and the hostnames the app serves |
| `blankcut context secrets` | Which keys are stored, which reach the running pod, and any that are stored but not yet delivered |
| `blankcut context data` | Database engine, version, connection limit, and the tables and columns that exist |
| `blankcut context image` | The container image the app runs and whether it is pinned by digest |
| `blankcut context runtime` | Requests, error rate, latency and resource use over a recent window |

#### What the answers mean

Four things are worth reading carefully, because none of them are visible from
inside your repository:

- **The resource envelope is enforced, not advisory.** The memory limit is a hard
  ceiling: exceed it and the container is killed rather than throttled. Size what
  you build to the limit reported, not to what your development machine has.

- **Connection limits are shared across every replica of every workload.**
  `context data` reports the database's `max connections`; `context env` lists
  each workload and how far it scales. Your pool size is multiplied by the total.
  An app with an API at two replicas and two workers at two each is **six**
  processes opening connections — a pool of 20 in each exhausts a 60-connection
  database on its own. This is the most common way an app that behaves in staging
  falls over under load.

- **"Stored" and "reaching the app" are different numbers.** A secret can exist in
  the platform's store and still not be delivered to the pod, because the
  deployment receives a specific list of keys. If `context secrets` shows a key
  under *not yet reaching the app*, reading it at runtime yields nothing,
  whatever the store holds. [Secrets](secrets.md) covers how a new key is wired
  in.

- **`context data` lists the tables that actually exist**, with their columns and
  types. Write queries against that rather than against what your ORM models
  imply — the two drift, and the database decides.

#### When a section is unavailable

Unavailable is not the same as absent, and the reason distinguishes them. *"No
managed database is attached to this app"* means there is no database. *"The
database schema for this app is not available yet"* means there is one that
cannot be described right now — do not conclude the app has no storage and write
around it.

### `blankcut diagnose [--app <APP>]`

Ask the platform what is wrong with a deployment.

Where [`blankcut status`](#blankcut-status-app-app) reports the raw facts — pod
counts, sync state, recent warnings — `diagnose` reads those facts and names the
likely cause, so you get a diagnosis instead of symptoms to interpret. It returns
nothing to diagnose when the app is healthy or has not been deployed.

---

## Promotion & status

### `blankcut promote --repo <GITHUB_URL> [--model claude\|openai\|gemini]`

Trigger the full LLM-driven onboarding run on Meerkat: it analyzes the repo,
generates the CI workflow, reconciles the build pipeline, and opens the necessary
pull requests. The CLI polls and renders phase transitions until the job reaches
a terminal state. `--model` selects the LLM (default `claude`).

Once deployed, the app is served at `https://<app>.blankcut.app` by default;
`blankcut context env` lists the exact hostnames it answers on.

!!! note "App addresses are moving to `.blankcut.app`"
    Apps were previously served at `<app>.blankcut.com`. Those addresses keep
    working; after 2026-10-28 they redirect to the app's `.blankcut.app`
    address. Point webhooks, OAuth redirect URIs, and API clients at
    `.blankcut.app` before then rather than relying on the redirect.

### `blankcut status --app <APP>`

Aggregate live status across GitHub Actions, ArgoCD, Kubernetes, and GitLab into
one view. Partial upstream failures show as empty for that source rather than
failing the whole call.


---

## Projects & backing services

### `blankcut provision --name <NAME> [--stack nextjs|vite|marketing] [--tier sandbox|production]`

Create a whole new project: a repository seeded with a runnable starter (backing
services pre-wired, a `/health` endpoint, and a `CLAUDE.md` that steers a coding
agent toward the supported stack), the app registered with the platform, and its
backing services provisioned. Deploy it afterwards with
`blankcut promote --app <NAME>`.

The repository is created in your own GitHub organization by default. `--owner`
names the target org and `--installation-id` identifies the Blank Cut GitHub App
installation on it.

| Flag | Effect |
|---|---|
| `--stack` | Starter to seed: `nextjs` (default), `vite`, or `marketing` |
| `--tier` | `production` (default), or `sandbox` for a capped MVP/prototype environment with no custom domain and no SLA |
| `--database` / `--no-database` | Force a dedicated Postgres and migration pipeline on or off. Omit both to take the stack's default — application stacks get one, marketing sites do not |
| `--display-name` | Human-readable label for the project |

### `blankcut database add --app <APP>`

Attach a managed Postgres to an app that was created without one. Safe to call
speculatively: the platform refuses if the app already has a database.

### `blankcut redis enable|disable|reset --app <APP>`

Record whether the app gets the platform's managed Redis. Without an explicit
decision, Redis is inferred from the repository on **every** deploy — so it can
appear or disappear on a deploy that had nothing to do with it. A decision made
here sticks until it is changed; `reset` clears it and hands the choice back to
the repository analysis.

### `blankcut storage add|status|rm --app <APP>`

Give an app somewhere to keep files — images, video, uploads, anything it needs
to serve or hold onto.

| Command | Effect |
|---|---|
| `blankcut storage add --app <APP>` | Provision storage. Deploy afterwards so the running app picks it up |
| `blankcut storage status --app <APP>` | Show usage against the app's limit |
| `blankcut storage rm --app <APP> --yes` | Delete the app's files permanently |

Files live in one of two places: `public`, which gets a stable public URL, or
`private`, reachable only through a time-limited link the application generates.
The app reads and writes both using its own identity, so there are no access keys
to copy, paste or leak.

### `blankcut deprovision --app <APP>`

Tear an app down. Secrets are deleted immediately and irreversibly; the
configuration removals are opened as **review-gated merge requests** against the
platform's GitOps and Terraform repositories, so nothing disappears from the
cluster until a maintainer merges them.

| Flag | Effect |
|---|---|
| `--suspend` | Reversible. Prunes the running workload but preserves secrets, repository, registry entry and build pipeline. Restore with `blankcut promote` |
| `--transfer-to <OWNER>` | Tear down **and** transfer the GitHub repository to another owner. Irreversible |
| `--delete-repo` | Tear down **and** delete the GitHub repository. Irreversible |
| `--yes` | Skip the interactive confirmation |

### `blankcut domains`

Buy, transfer and connect custom domains, and manage their DNS. Registration,
transfer and renewal are charged at cost to your organization's card; the
walkthrough, including moving a domain in from GoDaddy or Squarespace, is in
[Domains](domains.md).

| Command | Effect |
|---|---|
| `blankcut domains list` | Your domains and any purchase or transfer still in progress |
| `blankcut domains search <name>` | Availability, yearly price and alternatives |
| `blankcut domains buy <domain> [--app <APP>]` | Register a domain (owner only) |
| `blankcut domains contact set ...` | The registrant contact used for registrations and transfers |
| `blankcut domains transfer check\|dns\|start <domain>` | Move a domain in from another registrar |
| `blankcut domains attach <domain> --app <APP>` | Serve a domain from an app (connects a domain you own elsewhere, too) |
| `blankcut domains detach <domain>` | Stop serving it, keep the domain |
| `blankcut domains status <domain>` | Certificate, DNS records, registration and any order |
| `blankcut domains records <domain>` / `records set` / `records rm` | DNS for domains Blank Cut hosts |
| `blankcut domains auto-renew <domain> on\|off` | Keep renewing, or let it lapse at expiry |
| `blankcut domains release <domain>` | Unlock and get the transfer code to move it elsewhere |
| `blankcut domains verify-email <domain>` | Resend the registry's owner-verification email |

---

## API keys

### `blankcut keys provision --app <APP>`

Mint the app-scoped `BLANKCUT_API_KEY` and set it as a secret on the app's
repository, so the repo's pipeline can call the platform without a shared
credential. Scoped to that one app, and re-running rotates it — any previously
issued CI key for the app stops working.
