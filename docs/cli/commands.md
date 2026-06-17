# Command reference

All commands are run as `blankcut <command>`. Remote commands require a
configured API key (see [Overview & setup](index.md#configure)).

!!! note
    Don't invent flags or endpoints. If a command or flag you need isn't
    documented here, run `blankcut <command> --help`, or ask the platform team —
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

Delegate failing checks to the Agent Service. The server opens a pull request (or
pushes directly to `main` where branch protection allows) with the fixes, then
watches the resulting pipeline and self-heals known failure modes.

### `blankcut upgrade`

Update the CLI to the latest release. `--check` reports current vs latest without
installing; `--force` reinstalls even if up to date. See
[Keep the CLI up to date](index.md#keep-the-cli-up-to-date).

---

## Configuration

### `blankcut configure --api-key <KEY> --endpoint <URL>`

Save credentials to `~/.blankcut/config.json`. See
[Configure](index.md#configure).

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

## Promotion & status

### `blankcut promote --repo <GITHUB_URL> [--model claude\|openai\|gemini]`

Trigger the full LLM-driven onboarding run on the Agent Service: it analyzes the
repo, generates the CI workflow, reconciles the build pipeline, and opens the
necessary pull requests. The CLI polls and renders phase transitions until the
job reaches a terminal state. `--model` selects the LLM (default `claude`).

### `blankcut status --app <APP>`

Aggregate live status across GitHub Actions, ArgoCD, Kubernetes, and GitLab into
one view. Partial upstream failures show as empty for that source rather than
failing the whole call.
