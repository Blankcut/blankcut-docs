# Meerkat CLI — overview & setup

`blankcut` is the Meerkat CLI: the command-line tool that connects a repository
to Meerkat. With it you connect a repo or create a new project, deploy it, read
the environment it actually runs in, manage its secrets, files, scheduled jobs
and domains, see what its image scan found, and check live status.

There are two kinds of commands:

- **Local** commands (`init`, `validate`, `sync`) work on the current directory
  and need nothing but the binary.
- **Remote** commands (everything else) talk to the Meerkat API and need you to
  be signed in, or `BLANKCUT_API_KEY` set in the environment.

---

## Create your account

The CLI drives Meerkat, so you need an account. Sign up at
**[meerkat.blankcut.com](https://meerkat.blankcut.com/register)**, the Meerkat
console, where you join your organization and connect GitHub. If you skip this
step, `blankcut login` sends you to sign-up in the browser anyway.

[Create your account →](https://meerkat.blankcut.com/register){ .md-button .md-button--primary }

---

## Install

No GitHub login or special access is needed. Pick one:

=== "Homebrew"

    macOS or Linux. Newer Homebrew asks you to trust the tap once.

    ```bash
    brew install blankcut/tap/blankcut
    ```

=== "Install script"

    Anywhere with `curl`: Linux, CI, containers, agent sandboxes. Download the
    script first, then run it. Piping a failed download straight into `bash`
    runs an error page instead.

    ```bash
    curl -fsSL https://raw.githubusercontent.com/Blankcut/blankcut-cli-releases/main/install.sh \
      -o /tmp/blankcut-install.sh && bash /tmp/blankcut-install.sh
    ```

=== "Manual"

    Download your platform's archive and `checksums.txt` from the
    [latest release](https://github.com/Blankcut/blankcut-cli-releases/releases/latest),
    then check and install it:

    ```bash
    shasum -a 256 -c <(grep blankcut_Darwin_arm64 checksums.txt)   # sha256sum on Linux
    tar -xzf blankcut_Darwin_arm64.tar.gz
    sudo install -m 755 blankcut /usr/local/bin/
    ```

Then confirm it works:

```bash
blankcut --version
```

The install script detects your OS and architecture, checks the download against
the release's `checksums.txt` (and that file's signature too, when
[`cosign`](https://docs.sigstore.dev/cosign/system_config/installation/) is
installed), and installs to `/usr/local/bin`, asking for `sudo` only if it needs
to. Two environment variables change what it does:

| Variable | Effect |
|---|---|
| `BLANKCUT_INSTALL_DIR=~/bin` | Install somewhere else. Use a directory you can write to in CI, where nothing can answer a `sudo` prompt. |
| `BLANKCUT_VERSION=v0.23.3` | Install a specific release instead of the latest. |

!!! warning "Only two places to get it"
    The CLI is distributed only through the Homebrew tap and
    [`Blankcut/blankcut-cli-releases`](https://github.com/Blankcut/blankcut-cli-releases).
    Don't download a `blankcut` binary from anywhere else.

??? note "Verify the signature yourself"
    ```bash
    cosign verify-blob --bundle checksums.txt.sigstore.json \
      --certificate-identity-regexp '^https://github\.com/Blankcut/blankcut-cli/\.github/workflows/release\.yml@refs/(tags/v[0-9]+\.[0-9]+\.[0-9]+|heads/main)$' \
      --certificate-oidc-issuer https://token.actions.githubusercontent.com checksums.txt
    ```

    If verification fails, don't install the download. Try again, and if it
    keeps failing, tell the Blank Cut team.

---

## Sign in

```bash
blankcut login
```

That's the whole setup. The CLI prints a short code and opens your browser. You
approve the code there (signing up first if you're new), and the CLI collects an
API key on its own and saves it to `~/.blankcut/config.json`.

**You never see or paste the key.** A key that never passes through a clipboard
can't end up in your shell history, a screenshot or an agent transcript.

- Each machine gets its own key, listed in the console under the machine's name.
  Signing in on a new laptop doesn't sign out your other one or your CI.
  `--device-name` sets a clearer name than the hostname, such as `CI`.
- On a machine with no browser (a server, a container), run
  `blankcut login --no-browser`. It prints the URL to open somewhere else. The
  code expires after 15 minutes.
- The key covers every project in your organization, including ones created
  later. Replace it at any time with `blankcut keys refresh`.
- If a command fails with `This API key has been replaced`, the key was rotated
  or revoked from the console. Run `blankcut login` again.

!!! warning "Keep `~/.blankcut/config.json` private"
    Never commit it, and never paste an API key into chat, a pull request,
    a commit message or a log.

### CI and other non-interactive environments

Nobody can approve a browser prompt in CI, so don't run `blankcut login` there.
Set the key in the environment instead. Every remote command reads it, and no
config file is needed.

| Variable | Meaning |
|---|---|
| `BLANKCUT_API_KEY` | The API key. Required. |
| `BLANKCUT_ENDPOINT` | The Meerkat API. Optional; defaults to `https://api.blankcut.com`. |

Environment variables win over the saved config one field at a time, so
exporting only `BLANKCUT_ENDPOINT` points a signed-in machine at a different
API while keeping its stored key.

### If someone handed you a key

```bash
blankcut configure --api-key <KEY>
```

`configure` stores a key you were given directly. Prefer `blankcut login`: a
key handed over by a person is exactly the leak that signing in avoids.
`--endpoint` defaults to `https://api.blankcut.com`. Configs that name the
API's original address, `https://agent.blankcut.com`, keep working.

---

## Keep the CLI up to date

The CLI is released often, and new releases add commands. Check at the start of
any session that uses it:

```bash
blankcut upgrade --check   # current vs latest, and what changed since your build; installs nothing
blankcut upgrade           # install the latest release
```

`--check` prints the changelog entries newer than the build you're running, so
it's the quickest way to find out what Meerkat can newly do. The full history is
in the [CLI changelog](https://github.com/Blankcut/blankcut-cli-releases/blob/main/CHANGELOG.md).

A Homebrew install is updated with `brew upgrade blankcut`; `blankcut upgrade`
tells you so instead of overwriting it. `blankcut upgrade --force` reinstalls
even when you're already on the latest release.

**Then refresh your repo's `CLAUDE.md`:**

```bash
blankcut sync
```

Every repo connected to Meerkat carries a platform block in its `CLAUDE.md`,
including the list of commands the CLI ships, for coding agents to read. `sync`
rewrites that block from the binary you now have. It runs offline, needs no API
key, and touches only the text between the `BLANKCUT PLATFORM` markers. See
[Coding agents](agents.md) for why this matters.

---

## Next steps

- **[Deploy an app](deploy.md):** connect an existing repo or create a new
  project, and get it running.
- **[Read your environment](context.md):** what your app actually runs in,
  before you write code against it.
- **[Command reference](commands.md):** every command and its flags.
- **[Secrets](secrets.md):** declaring, setting and using environment
  variables, and the rule about never emitting secret values.
- **[Supported stacks](stacks.md):** what Meerkat runs, and the rules every app
  follows.
