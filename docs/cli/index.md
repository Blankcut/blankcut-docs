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
    BlankCut organization. Run `gh auth status` to confirm who you're logged in
    as, and ask a BlankCut admin for access.

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
    Your API key is shown to you **once** when it's issued; the platform only
    stores a hash. Never commit `~/.blankcut/config.json`, and never paste your
    key into chat, PR descriptions, commit messages, or logs. Ask the BlankCut
    admin who onboarded your team for a key.

---

## Next steps

- **[Command reference](commands.md)** — every command and its flags.
- **[Secrets](secrets.md)** — the pull / push / diff / run lifecycle and the hard
  rule about never emitting secret values.
- **[Supported stacks](stacks.md)** — what the platform runs and the rules every
  app must follow.
