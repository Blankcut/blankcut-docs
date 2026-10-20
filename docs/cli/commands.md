# Command reference

Every command is run as `blankcut <command>`. Remote commands need you to be
[signed in](index.md#sign-in), or `BLANKCUT_API_KEY` in the environment.

!!! note "The binary is the final word"
    This page describes the current release. For the exact flags of the build
    you have, run `blankcut <command> --help`, and `blankcut --help` for the
    full list of commands. If a command or flag isn't in either, it doesn't
    exist: don't guess. Flags reserved for the Blank Cut team are left out here.

Commands that report on an app take `--app <APP>`. Where it's marked optional,
it's worked out from the git remote when you run the command inside the app's
repository.

---

## Setup

### `blankcut login`

Sign this machine in. Prints a short code and opens your browser to approve it;
the CLI then stores an API key for this machine without ever showing it. See
[Sign in](index.md#sign-in).

| Flag | Effect |
|---|---|
| `--no-browser` | Print the URL to open elsewhere instead of opening a browser. |
| `--device-name <NAME>` | The name this key is listed under in the console. Defaults to the hostname. |

### `blankcut configure --api-key <KEY>`

Store a key you were handed directly in `~/.blankcut/config.json`. Prefer
`blankcut login`. `--endpoint` defaults to `https://api.blankcut.com`.

### `blankcut keys refresh`

Replace this machine's API key with a fresh one and write it straight into your
config. The old key stops working immediately; the new one covers the same
projects. Use it if a key may have been exposed, or on a schedule.

### `blankcut upgrade`

Install the latest release. `--check` reports your version against the latest
and lists what's new since your build, without installing anything. `--force`
reinstalls even when you're up to date. A Homebrew install is upgraded with
`brew upgrade blankcut` instead. See
[Keep the CLI up to date](index.md#keep-the-cli-up-to-date).

### `blankcut sync`

Rewrite the platform block in this repo's `CLAUDE.md` from the copy built into
your binary, so the guidance a coding agent reads matches the CLI you have.
Offline, no API key, and only the text between the `BLANKCUT PLATFORM` markers is
touched. Run it after every upgrade. `--check` reports whether the block is
stale and exits `1` without writing, for use as a CI gate.

### `blankcut completion bash|zsh|fish|powershell`

Print a shell completion script. `blankcut completion <shell> --help` explains
how to load it.

---

## Connect and create

See [Deploy an app](deploy.md) for the whole flow.

### `blankcut onboard`

Connect a repository you already have: register the app and open a setup pull
request. Doesn't deploy.

| Flag | Effect |
|---|---|
| `--repo <URL>` | The GitHub repository. Defaults to the `origin` remote. |
| `--name <APP>` | The app's name on Meerkat. Defaults to the repository name. |
| `--tier sandbox\|production` | The [tier](deploy.md#rough-cut-and-production). Defaults to `production`. |
| `--database` | Also provision a dedicated managed Postgres. |

### `blankcut provision --name <NAME> --owner <GITHUB_ORG>`

Create a new project: a repository with a runnable starter, the app registered,
its backing services provisioned, and a first deploy. **Bills from the moment it
exists.**

| Flag | Effect |
|---|---|
| `--name` | The project name. Required. |
| `--owner` | The GitHub organization the Blank Cut GitHub App is installed on. |
| `--stack nextjs\|vite\|marketing` | The starter. Defaults to `nextjs`. |
| `--tier sandbox\|production` | The tier. Defaults to `production`. |
| `--database` / `--no-database` | Force a dedicated Postgres on or off. By default application stacks get one and marketing sites don't. |
| `--display-name` | A human-readable label. |

### `blankcut init`

Write the platform layout into the current directory. Never overwrites a file;
adds missing entries to `.env.example` and `.gitignore` and refreshes the
platform block in `CLAUDE.md`. Registers and deploys nothing. `--name` sets the
app name (the directory name by default).

### `blankcut validate`

Run the platform readiness checks against the current repository. Local, no
network. Prints `[PASS]` or `[FAIL]` per check and exits `1` if any fail. The
checks are listed in [Deploy an app](deploy.md#connect-an-existing-repo).

`--fix` hands the failing checks to Meerkat, which opens a pull request with the
fixes and watches the build that follows. `--repo` names the GitHub repository
when it can't be read from the git remote.

---

## Deploy and operate

### `blankcut promote`

Deploy an app. A finished `promote` means the deploy is proposed; check
`blankcut status` for when it's live. See
[Deploy a new version](deploy.md#deploy-a-new-version).

| Flag | Effect |
|---|---|
| `--app <APP>` | Deploy a new version of a registered app. |
| `--repo <URL>` | Register and deploy a repository Meerkat hasn't seen before. |
| `--dry-run` | Show the deploy change and the secret keys it would change, without writing anything. |
| `--to-production` | Move a Rough Cut app to production before deploying (needs `--app`). |
| `--model claude\|openai\|gemini` | The model that analyzes the repository. Defaults to `claude`. |

### `blankcut status --app <APP>`

Live status in one view: the latest GitHub Actions run, the deploy's sync and
health, pod counts and recent warnings, and any deploy change still waiting. A
source that can't be reached comes back empty instead of failing the call.

### `blankcut diagnose [--app <APP>]`

Read the same facts as `status` and name the likely cause. Reports nothing to
diagnose when the app is healthy or hasn't been deployed.

### `blankcut deprovision --app <APP>`

Tear an app down. Secrets are deleted immediately and can't be recovered; the
rest is removed through reviewed changes. See
[Pause or remove an app](deploy.md#pause-or-remove-an-app).

| Flag | Effect |
|---|---|
| `--suspend` | Reversible. Stop the running app but keep its secrets, repository, registration and build pipeline. Bring it back with `blankcut promote --app`. |
| `--transfer-to <OWNER>` | Tear down **and** move the GitHub repository to another owner. Irreversible. |
| `--delete-repo` | Tear down **and** delete the GitHub repository. Irreversible. |
| `--yes` | Skip the confirmation. |

---

## Understand the environment

### `blankcut context [subcommand] [--app <APP>] [--json]`

What the app actually runs in, fetched live. JSON when piped. See
[Read your environment](context.md).

| Subcommand | Reports |
|---|---|
| *(none)* | Everything below at once |
| `env` | Namespace, tier, resource envelope, workloads and scaling, hostnames |
| `secrets` | Keys stored, keys reaching the app, and keys stored but not delivered |
| `data` | Database engine, version, connection limit, tables and columns |
| `storage` | Where the app's files live and what its code must do to reach them |
| `image` | The image the app runs from, and whether it's pinned by digest |
| `runtime` | Recent requests, error rate, latency and restarts |
| `routes` | Every route, what guards it, and which tables it touches |
| `conventions` | The patterns the repository actually uses, with counts |

---

## Secrets

Every subcommand except the local `sync-example` takes `--app <APP>`. See
[Secrets](secrets.md) for the workflow and the rules.

| Command | Purpose |
|---|---|
| `blankcut secrets list` | Print key **names** only. Values are never returned. |
| `blankcut secrets sync-example [--env-file FILE] [--example-file FILE]` | Add key names from your local `.env` to `.env.example` (names only). |
| `blankcut secrets set KEY VALUE [--force]` | Write one value. The key must already be in `.env.example` on `main`. A different stored value is kept unless `--force`. |
| `blankcut secrets push [--env-file FILE] [--force]` | Upload a local `.env`. Reports set, skipped and rejected keys. |
| `blankcut secrets pull [--env-file FILE] [--force]` | Download values into a local `.env` (mode `0600`). Won't overwrite a different local value without `--force`. |
| `blankcut secrets diff [--env-file FILE]` | Compare key names (never values). Exits `1` on any difference. |
| `blankcut secrets run [--only K1,K2] [--exclude K1] -- <command>` | Run a command with the secrets in its environment. Never writes a file. |

`--env-file` can be repeated to read or write several files.

---

## Backing services

### `blankcut database add --app <APP>`

Add a dedicated managed Postgres to an app created without one. Meerkat creates
the database, puts its connection details in the app's secrets (`DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and runs the
app's migrations. It takes a few minutes and carries on after the command
returns. Safe to run speculatively: an app that already has a database is
refused, never replaced.

### `blankcut redis enable|disable|reset --app <APP>`

Decide whether the app gets Meerkat's managed Redis. Without a decision, Redis is
inferred from the repository on **every** deploy, so it can appear or disappear
on a deploy that had nothing to do with it. A decision sticks until you change
it; `reset` hands it back to the repository analysis. It takes effect on the
next deploy. On the Rough Cut tier Redis is a billed add-on; on production it's
included.

### `blankcut storage add|status|rm --app <APP>`

File storage for images, video and uploads, reached with the app's own identity
and no access keys. See [File storage](storage.md).

| Command | Effect |
|---|---|
| `blankcut storage add --app <APP>` | Provision storage, or repair a half-finished provision. Deploy afterwards. |
| `blankcut storage status --app <APP>` | Usage against the app's limit. |
| `blankcut storage rm --app <APP> --yes` | Delete the app's files permanently. |

---

## Scheduled jobs

### `blankcut schedule add|list|rm --app <APP>`

Call one of your app's own endpoints on a schedule. See
[Scheduled jobs](schedule.md).

| Command | Effect |
|---|---|
| `blankcut schedule add <name> --cron "<expr>" --path <endpoint>` | Add a job. `--method` (default `POST`) and `--timeout` (seconds, default `120`) are optional. |
| `blankcut schedule list` | The app's jobs as deployed, pending changes, and the app's job limit. |
| `blankcut schedule rm <name>` | Remove a job. It may run once more while the change goes through. |

---

## Image scanning

### `blankcut scan [--app <APP>] [--json]`

The vulnerabilities the image scan found, for the last build and for what's
running now, grouped by the upgrade that fixes them. See
[Image scanning](scan.md).

| Command | Effect |
|---|---|
| `blankcut scan waive --vuln <ID> --pkg <PKG> --reason "<why>"` | Ask the Blank Cut team to waive one finding you can't fix yet. |
| `blankcut scan waivers` | The app's waivers and where each stands. |

---

## Domains

### `blankcut domains`

Buy, transfer in and connect custom domains, and manage their DNS. Registration,
transfer and renewal are charged at cost to your organization's card. See
[Domains](domains.md) for the walkthrough. Every subcommand accepts `--json`.

| Command | Effect |
|---|---|
| `blankcut domains list` | Your domains, and any purchase or transfer still in progress |
| `blankcut domains search <name>` | Availability, yearly price and alternatives |
| `blankcut domains buy <domain> [--app <APP>]` | Register a domain (owner only). Shows the price and asks first. |
| `blankcut domains contact` / `contact set ...` | Show or set the registrant contact used for registrations and transfers |
| `blankcut domains transfer check\|dns\|start <domain>` | Move a domain in from another registrar |
| `blankcut domains attach <domain> --app <APP>` | Serve a domain from an app (also connects a domain registered elsewhere) |
| `blankcut domains detach <domain>` | Stop serving it, keep the domain |
| `blankcut domains status <domain>` | Certificate, DNS records, registration and any order |
| `blankcut domains records <domain>` / `records set` / `records rm` | DNS records for domains Blank Cut hosts |
| `blankcut domains auto-renew <domain> on\|off` | Keep renewing, or let it lapse at expiry |
| `blankcut domains verify-email <domain>` | Resend the registry's owner-verification email |
| `blankcut domains release <domain>` | Points you to Meerkat, where an owner moves a domain to another registrar |

| Flag | On | Effect |
|---|---|---|
| `--no-www` | `buy`, `attach`, `transfer start` | Don't also serve `www.<domain>` (by default it's served and redirects to the bare domain). |
| `--no-auto-renew` | `buy` | Let the registration expire after a year. |
| `--yes` | `buy`, `transfer start` | Skip the price confirmation. Only after the person paying has agreed to the price. |
| `--zone-file <FILE>` | `transfer dns` | A BIND zone file exported from the current DNS host, for a complete copy. |
| `--skip-dns-check` | `transfer start` | Start even though the domain's DNS hasn't been copied to Blank Cut. |

---

## CI key

Onboarding and `provision` give each app's repository its own CI key, stored as
the `BLANKCUT_API_KEY` repository secret and scoped to that one app.
`blankcut keys provision --app <APP>` mints a replacement and rotates the old
one; it needs a Blank Cut team key, so ask the team if a repository's CI key
needs replacing.

---

## Environment variables

| Variable | Read by | Meaning |
|---|---|---|
| `BLANKCUT_API_KEY` | Every remote command | The API key, instead of a saved config. |
| `BLANKCUT_ENDPOINT` | Every remote command | The Meerkat API. Defaults to `https://api.blankcut.com`. |
| `BLANKCUT_DOMAIN_AUTH_CODE` | `domains transfer start` | A domain's transfer code, so it isn't typed into your shell history. |
| `BLANKCUT_INSTALL_DIR` | The install script | Where to install the binary. Defaults to `/usr/local/bin`. |
| `BLANKCUT_VERSION` | The install script | A release to install instead of the latest, for example `v0.23.3`. |
