# Meerkat CLI — overview & setup

`blankcut` is the Meerkat CLI: the single command-line tool that connects a
repository to Meerkat. You use it to scaffold the standard layout, validate
platform readiness, read the environment your app actually runs in, manage
secrets, provision projects and backing services, promote an app through the
build/deploy pipeline, and check live status.

There are two flavors of commands:

- **Local** commands (`init`, `validate`, `sync`) operate purely on the working
  directory and need nothing but the binary.
- **Remote** commands (`context`, `secrets`, `promote`, `status`, `diagnose`,
  `validate --fix`) talk to the Meerkat API and need a configured API key — or
  `BLANKCUT_API_KEY` and `BLANKCUT_ENDPOINT` in the environment.

---

## Create your account

The CLI drives Meerkat, so start with an account. Sign up at
**[meerkat.blankcut.com](https://meerkat.blankcut.com/register)** — the Meerkat
console. There you join the organization, connect GitHub, create your first
project, and issue the **API key** the CLI authenticates with.

[Create your account →](https://meerkat.blankcut.com/register){ .md-button .md-button--primary }

Then continue with installing the CLI below.

---

## Install

The CLI is published as **auth-gated GitHub Releases** from a private repo, so the
install reuses your existing GitHub CLI (`gh`) session for the download.

1. Install and authenticate `gh` (skip if you already have it):

    ```bash
    brew install gh && gh auth login        # macOS
    # or: sudo apt install gh && gh auth login   # Debian/Ubuntu
    ```

2. Run the installer — it pulls the latest release matching your OS + architecture:

    ```bash
    gh api -H "Accept: application/vnd.github.raw" \
      /repos/Blankcut/blank-cut-cli/contents/cli/install.sh | bash
    ```

3. Verify:

    ```bash
    blankcut --version
    ```

!!! tip "404 on install?"
    A 404 almost always means your `gh` account doesn't have access to the
    Blank Cut GitHub organization yet. Run `gh auth status` to confirm you're logged in
    as the **same GitHub account you connected in Meerkat** — that's what grants
    the org access the download needs.

---

## Keep the CLI up to date

The CLI is released frequently and command behavior changes between releases —
**check for updates at the start of any session that uses `blankcut`.**

```bash
blankcut upgrade --check   # report current vs latest; installs nothing
blankcut upgrade           # install the latest release (same gh-auth-gated installer)
```

`blankcut upgrade --force` reinstalls even if you're already on the latest tag.

---

## Configure

Remote commands need an API key and the Meerkat API endpoint. Save them once:

```bash
blankcut configure \
  --api-key <YOUR_API_KEY> \
  --endpoint https://api.blankcut.com
```

`https://agent.blankcut.com` is the same API under its original name and stays
supported, so an existing config needs no change; CLI v0.22.0 and later default
new configs to `https://api.blankcut.com`.

Credentials are stored in `~/.blankcut/config.json`. For one-off invocations
(CI runners, fresh sandboxes) you can instead set `BLANKCUT_API_KEY` and
`BLANKCUT_ENDPOINT` as environment variables.

!!! warning "Handle your API key carefully"
    Issue or copy your API key from your account at
    [meerkat.blankcut.com](https://meerkat.blankcut.com). It's shown to you
    **once**; the platform only stores a hash. Never commit
    `~/.blankcut/config.json`, and never paste your key into chat, PR
    descriptions, commit messages, or logs.

---

## Before you write code

Run [`blankcut context`](commands.md#understanding-your-environment) against your
app. It reports the resource envelope the container actually gets, how far it
scales, which secret keys reach the running pod, and the database's connection
limit and schema.

```bash
blankcut context --app <APP>
```

Those are the details that are invisible from inside a repository and expensive
to get wrong — a connection pool sized for one process when six are running, or
code reading a secret that is stored but never delivered. Nothing is cached, so
what you see is what is deployed.

When something is broken, [`blankcut diagnose`](commands.md#blankcut-diagnose-app-app)
names the likely cause rather than leaving you to infer it from pod counts.

---

## Next steps

- **[Command reference](commands.md)** — every command and its flags.
- **[Secrets](secrets.md)** — the pull / push / diff / run lifecycle and the hard
  rule about never emitting secret values.
- **[Supported stacks](stacks.md)** — what Meerkat runs and the rules every app
  must follow.
