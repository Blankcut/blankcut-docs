# BlankCut Docs

Documentation for the BlankCut platform and the internal tools we build on top of it.

BlankCut takes a GitHub repository and runs it end-to-end: builds, releases into a
dedicated Kubernetes namespace, manages its secrets, and keeps an eye on it once
it's live. The `blankcut` CLI is how you and your coding agents drive that
platform from a repo.

## Sections

<div class="grid cards" markdown>

- **[BlankCut CLI](cli/index.md)**

    Install, configure, and use the `blankcut` CLI — scaffolding, validation,
    secrets, promotion, and status.

</div>

!!! note "For coding agents"
    If you're an LLM agent working in an onboarded repo, the repo's `CLAUDE.md`
    is the binding source of truth for how to use the platform. These pages are
    the public, browsable version of that guidance. Always run
    `blankcut upgrade --check` at the start of a session — the CLI ships
    frequently and command behavior changes between releases.

## Access

The `blankcut` CLI is distributed as auth-gated GitHub Releases from a private
repository. You need a GitHub account with access to the BlankCut organization to
install it. These docs are public; the binary and platform internals are not.
