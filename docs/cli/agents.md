# Coding agents

The CLI is built to be run by coding agents (Claude Code, Cursor, Codex and the
like) as much as by people. This page is for whoever sets an agent up, and for
the agent itself.

---

## The repo's `CLAUDE.md` is the agent's rulebook

Every repository connected to Meerkat carries a platform block in its
`CLAUDE.md`, between `BLANKCUT PLATFORM` markers. It tells an agent what the CLI
can do and the rules that apply in that repo. **Inside a connected repo, that
block is the binding source**; these pages are its public, browsable version.

The block is the same in every repo and is owned by Blank Cut. Don't edit inside
the markers, since `init` and `sync` overwrite them. Put repo-specific notes
above or below the block, where they're always kept.

Keep it current with `blankcut sync`. The block includes the list of commands
the CLI ships, and it also tells agents not to invent commands, so a stale list
makes an agent conclude a capability doesn't exist when it shipped weeks ago.
`blankcut sync --check` exits `1` when the block is behind your binary, which
makes a good CI gate.

---

## Start of every session

```bash
blankcut upgrade --check    # what's new since this build; installs nothing
blankcut upgrade            # only if an update was reported
blankcut sync               # refresh the CLAUDE.md block from the binary you now have
```

Then, before writing code that touches infrastructure:

```bash
blankcut context --app <APP>
```

It's the resource envelope, the database's connection limit and schema, and which
secrets actually reach the running app. See [Read your environment](context.md).

If `blankcut` isn't installed, [install it](index.md#install): no GitHub login
is needed.

---

## Signing in with an agent

An agent can run `blankcut login`, but it **can't approve it**; a person has to.
The command prints a URL and a short code. Relay both to the person exactly as
printed, ask them to approve in their browser, and wait. The command keeps
polling for up to 15 minutes and finishes by itself once they approve, so run it
with a long timeout or in the background. Never try to approve it yourself or
find a key some other way.

**In CI, or with no person present,** don't run `blankcut login`. Set
`BLANKCUT_API_KEY` in the environment; every remote command reads it.

---

## Reading output

`context` and `scan` print JSON automatically when stdout isn't a terminal, so an
agent piping them gets machine-readable data while a person in a terminal gets a
table. Both carry the same facts. `--json` forces JSON; `domains` commands accept
`--json` too.

For flags and subcommands, `blankcut <command> --help` comes from the binary
that's actually installed, so it can't be out of date. If a command or flag isn't
in `blankcut --help`, it doesn't exist. Ask rather than guess.

---

## Rules

- **Never emit a secret value**, anywhere: chat, commits, pull requests,
  comments, logs, fixtures. Redact anything you find as `<REDACTED:KEY_NAME>`.
  When a command needs a value, use `blankcut secrets run -- <command>`. See
  [Secrets](secrets.md#hard-rule-never-emit-secret-values).
- **Don't infer a deploy from a merged pull request.** `blankcut status` is the
  answer to "is it live?". A freshly connected repo often isn't running because
  `promote` was never run.
- **Show the person the price before spending money.** `domains buy` and
  `domains transfer start` print a price and ask. Pass `--yes` only after the
  person paying has agreed to it. Without `--yes` and without a terminal to ask
  on, these commands stop rather than spend, by design.
- **A domain's transfer code is the person's to handle.** Have them run
  `domains transfer start` themselves (it asks without echoing), or set
  `BLANKCUT_DOMAIN_AUTH_CODE` in their own shell. Never ask for, write down or
  pass on a transfer code. Moving a domain away is done by an owner in Meerkat,
  never from the CLI.
- **Don't run `provision` speculatively.** It creates billable resources the
  moment it runs. A plan or permission refusal is an answer, not a glitch to
  retry.
- **Fix scan findings before asking for a waiver.** A waiver is for a finding
  that genuinely can't be fixed yet, one finding per request, with the reason.
  Tell the person when you file one. See [Image scanning](scan.md).
- **Stay on the supported stack.** No new languages, frameworks or
  infrastructure the platform doesn't run. See [Supported stacks](stacks.md).
