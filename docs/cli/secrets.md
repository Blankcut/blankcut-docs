# Secrets

Meerkat keeps every app's secrets in an encrypted store. The CLI is all you need
to manage them: you never touch the store directly, and **values never live in
git**.

Every `secrets` command except the local `sync-example` takes `--app <APP>`,
where `<APP>` is the app's name (normally the lowercased repository name).
Meerkat works out where that app's secrets live; you never give a path.

| Command | What it does |
|---|---|
| `blankcut secrets list --app <APP>` | Print the key **names**. Values are never returned. |
| `blankcut secrets sync-example` | Add the key names from your local `.env` to `.env.example` (names only). |
| `blankcut secrets set --app <APP> KEY VALUE` | Write one value. |
| `blankcut secrets push --app <APP>` | Upload a local `.env` in bulk. |
| `blankcut secrets pull --app <APP>` | Download values into a local `.env`. |
| `blankcut secrets diff --app <APP>` | Compare local key names with Meerkat's. Exits `1` on any difference. |
| `blankcut secrets run --app <APP> -- <command>` | Run a command with the secrets in its environment, without writing a file. |

`push`, `pull`, `diff` and `sync-example` read or write `.env` by default. Pass
`--env-file` to use another file, and repeat it to use several
(`--env-file .env --env-file .env.prod`).

---

## The `.env.example` gate

`.env.example` is the **allowlist** for an app's secrets. Meerkat refuses to
store a key that isn't declared in `.env.example` on the repository's default
branch (`not_in_env_example`). That way every secret key is visible and
reviewed in code before any value is set.

Keys must be **flat**: a key can't contain `/`. Use `_` instead (`DB_PASSWORD`,
not `DB/PASSWORD`).

---

## Add a new environment variable

1. **Declare the key** in `.env.example`, by name only, with an empty value:
   `STRIPE_API_KEY=`. Or let the CLI copy the missing names from your local
   `.env`:

    ```bash
    blankcut secrets sync-example                       # from .env
    blankcut secrets sync-example --env-file .env.prod  # from another file
    ```

2. **Merge that change to `main`.** The gate reads the default branch, so this
   has to land first or the write is rejected.
3. **Set the value:**

    ```bash
    blankcut secrets set --app <APP> STRIPE_API_KEY <value>
    # or put it in your local .env and:
    blankcut secrets push --app <APP>
    ```

    If Meerkat already holds a *different* value for the key, the write is held
    back (`skipped` / `would_overwrite`) rather than overwriting it. Re-run with
    `--force` only if you mean to replace it.

4. **If the app is already deployed,** a brand-new key has to be added to the
   list of keys the running app receives. Meerkat opens that change
   automatically, a Blank Cut engineer approves it, and the app gets the value
   on its next sync. Updating a key that already exists needs none of this: the
   new value syncs on its own.
5. **Check it:** `blankcut secrets diff --app <APP>` should show the key on both
   sides, and `blankcut context secrets --app <APP>` should list it as reaching
   the app.

If a new secret isn't reaching a running app, it's almost always waiting on step
4. `blankcut context secrets` shows it under *not yet reaching the app* until
then.

---

## Browser-visible config (`NEXT_PUBLIC_*`)

This is the most common way a deploy goes wrong, and it fails in a shape that
looks like a broken app rather than missing config: **the page renders and every
data call fails.**

`next build` compiles `NEXT_PUBLIC_*` values **into the browser bundle**, so
they have to exist when the image is built. Nothing supplied to the running app
afterwards can reach code that's already compiled, so **changing one needs a
rebuild** (`blankcut promote --app <APP>`), not a restart.

Two routes reach the build, and you can use either:

| Route | How | Reaches |
|---|---|---|
| `blankcut secrets set --app <APP> NEXT_PUBLIC_FOO <value>` | The same `.env.example` gate as any other key | The build **and** the running app |
| A GitHub repository **variable** (or secret) named `NEXT_PUBLIC_FOO` | Picked up automatically, with no workflow edit | The build only |

If both set the same key, the repository's value wins when it isn't empty.

**What Meerkat provisioned for you is already supplied.** If Meerkat created the
app's database, its URL and public key reach every build without you setting
anything. Set only the keys that are yours: an app ID, a feature flag, your own
public API address.

!!! danger "`NEXT_PUBLIC_` publishes the value"
    Anything with the `NEXT_PUBLIC_` prefix can be read by anyone who opens the
    site. Never give a service-role key, admin token or private API key a
    `NEXT_PUBLIC_` name. Those belong in `blankcut secrets` under their ordinary
    names, where they reach the server and stop there.

---

## Common tasks

**Pull existing secrets into a fresh clone:**

```bash
git clone <REPO_URL> && cd <REPO_NAME>
blankcut secrets pull --app <APP>   # writes .env with mode 0600
```

If a key in your `.env` already has a different value, `pull` refuses by
default. Look at the difference and re-run with `--force` only if you mean it.
Keys that exist locally but not on Meerkat are left in place, with a warning.

**Run a command with the secrets, without writing a file:**

```bash
blankcut secrets run --app <APP> -- npm run dev
blankcut secrets run --app <APP> --only DATABASE_URL -- npm run migrate
```

The command inherits the secrets through its environment and nothing is written
to disk. `--only` and `--exclude` choose which keys are passed. The CLI's own
credentials (`BLANKCUT_API_KEY` and any `AWS_*` variables) are removed from the
child's environment.

`run` refuses `sh -c`, `bash -c` and the like, because the command string would
carry the values into the process list and your shell history. If you need a
shell, write a script that reads its environment and run that.

On Linux, any process running as the same user can read a running process's
environment while it runs. If you need a stricter boundary, `pull` to the `0600`
`.env` file and load it explicitly.

**Gate a pull request on key parity:**

```bash
blankcut secrets diff --app <APP>
```

It prints three groups (on Meerkat only, local only, both) and exits `1` if the
first two aren't empty. Only key names are compared; values are never sent or
printed.

**Bulk upload:** `push` strips comments and blank lines, drops keys that aren't
in your local `.env.example` before sending anything (and lists them as
rejected), and reports which keys were set, skipped and rejected.

---

## Hard rule: never emit secret values

Secret **values** must never appear in any of these, in any form:

- chat or commit messages
- pull request titles or descriptions
- issue, review or thread comments
- code comments
- documentation, READMEs, runbooks
- error messages, logs, stack traces
- test fixtures, snapshots, golden files
- scaffolded examples, demo data, mock payloads
- any committed file other than gitignored `.env*` files

If you come across a value (in a stack trace, a fixture, an existing file),
replace it with `<REDACTED:KEY_NAME>` before mentioning it anywhere, and don't
pass the raw value on. When a command needs a value that you don't want on disk
or on screen, use `blankcut secrets run -- <command>`.
