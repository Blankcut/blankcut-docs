# BlankCut CLI — overview & setup

`blankcut` is the single CLI that connects a repository to the BlankCut platform.
You use it to scaffold the standard layout, validate platform readiness, manage
secrets, promote an app through the build/deploy pipeline, and check live status.

There are two flavors of commands:

- **Local** commands (`init`, `validate`) operate purely on the working directory
  and need nothing but the binary.
- **Remote** commands (`secrets`, `promote`, `status`, `validate --fix`) talk to
  the hosted Agent Service and need a configured API key.

---

## Create your account

The CLI drives the BlankCut platform, so start with an account. Sign up at
**[meerkat.blankcut.com](https://meerkat.blankcut.com/register)** — the BlankCut
web console. There you join the organization, connect GitHub, create your first
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
    BlankCut organization yet. Run `gh auth status` to confirm you're logged in
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

Remote commands need an API key and the Agent Service endpoint. Save them once:

```bash
blankcut configure \
  --api-key <YOUR_API_KEY> \
  --endpoint https://agent.blankcut.com
```

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

## Next steps

- **[Command reference](commands.md)** — every command and its flags.
- **[Secrets](secrets.md)** — the pull / push / diff / run lifecycle and the hard
  rule about never emitting secret values.
- **[Supported stacks](stacks.md)** — what the platform runs and the rules every
  app must follow.
