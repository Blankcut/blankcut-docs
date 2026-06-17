# Secrets

The platform stores every app's secrets in an encrypted parameter store. The CLI
is the only thing you need to manage them — you never touch the store directly,
and **values never live in git**.

All `secrets` subcommands take `--app <APP>`, where `<APP>` is the lowercased repo
name. The platform resolves where that app's secrets live; you never specify a
path.

---

## The `.env.example` gate

`.env.example` is the **allowlist** for an app's secrets. The platform refuses to
write a key that isn't declared there (rejection reason `not_in_env_example`).
This keeps secret keys reviewable in code before any value is set.

Keys must be **flat** — a key may not contain `/` (use `_`, e.g. `DB_PASSWORD`,
not `DB/PASSWORD`).

---

## Add a new environment variable

1. **Declare the key** in `.env.example` (names only) — add it with an empty
   value, e.g. `STRIPE_API_KEY=`, or run `blankcut secrets sync-example` to copy
   missing key names from your local `.env`.
2. **Open a PR with the `.env.example` change and merge it to `main`.** This gate
   must merge first, or the write is rejected.
3. **Set the value:**

    ```bash
    blankcut secrets set --app <APP> STRIPE_API_KEY <value>
    # or update your local .env and:
    blankcut secrets push --app <APP>
    ```

    If the platform already holds a different value, the write is held back as
    `skipped` / `would_overwrite` — re-run with `--force` only if you intend to
    overwrite.
4. **If the app is already deployed**, a brand-new key needs to be wired into the
   running deployment's sync list before the pod can see it; the platform opens a
   small GitOps merge request for that automatically, and a maintainer merges it.
   Updating an **existing** key needs no such step — the new value syncs on its
   own.

---

## Common tasks

**Pull existing secrets into a fresh clone:**

```bash
git clone <REPO_URL> && cd <REPO_NAME>
blankcut secrets pull --app <APP>   # writes .env with mode 0600
```

If a key in `.env` already has a different value, the pull refuses by default —
inspect the diff and re-run with `--force` only if intentional.

**Run a command with platform secrets, without writing a file:**

```bash
blankcut secrets run --app <APP> -- npm run dev
```

The wrapped process inherits the secrets via its environment; nothing is written
to disk. The CLI's own auth (`BLANKCUT_API_KEY`, `AWS_*`) is stripped from the
child environment.

**Gate a PR on secret-key parity:**

```bash
blankcut secrets diff --app <APP>   # exits 1 on any drift; never sends values
```

---

## Hard rule — never emit secret values

Secret **values** must never appear in any of the following, in any form:

- chat or commit messages
- PR titles or descriptions
- issue / review / thread comments
- code comments
- documentation, READMEs, runbooks
- error messages, logs, stack traces
- test fixtures, snapshots, golden files
- scaffolded examples, demo data, mock payloads
- any committed file other than gitignored `.env*` files

If you encounter a value (in a stack trace, a fixture, an existing file), redact
it as `<REDACTED:KEY_NAME>` before any further mention, and do not propagate the
raw value. When a command genuinely needs a value but you don't want it on disk or
on screen, use `blankcut secrets run -- <cmd>`.
