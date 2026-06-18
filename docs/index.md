---
hide:
  - navigation
  - toc
---

<div class="bc-hero" markdown>

<img class="bc-hero__logo" src="assets/logo.svg" alt="BlankCut">

# BlankCut Docs

Ship a GitHub repo all the way to production — builds, deploys, secrets, and
monitoring — driven by the <span class="bc-type">blankcut</span> CLI.

[Get started](https://meerkat.blankcut.com/register){ .md-button .md-button--primary }
[Browse the CLI docs](cli/index.md){ .md-button }

</div>

Documentation for the BlankCut platform and the internal tools we build on top of
it. BlankCut takes a repository and runs it end-to-end: builds, releases into a
dedicated Kubernetes namespace, manages its secrets, and watches it once it's
live. The `blankcut` CLI is how you and your coding agents drive that.

## Explore

<div class="grid cards" markdown>

-   :material-console-line:{ .bc-card-icon } **[BlankCut CLI](cli/index.md)**

    ---

    Install, configure, and use the CLI — scaffolding, validation, secrets,
    promotion, and status.

-   :material-shield-key-outline:{ .bc-card-icon } **[Secrets](cli/secrets.md)**

    ---

    The pull / push / diff / run lifecycle, the `.env.example` gate, and the hard
    rule on never emitting values.

-   :material-cube-outline:{ .bc-card-icon } **[Supported stacks](cli/stacks.md)**

    ---

    The platform contract: what we run, the backing services, and the rules every
    app must follow.

</div>

!!! note "For coding agents"
    If you're an LLM agent working in an onboarded repo, that repo's `CLAUDE.md`
    is the binding source of truth — these pages are its public, browsable
    version. Always run `blankcut upgrade --check` at the start of a session: the
    CLI ships frequently and command behavior changes between releases.

## Access

New to BlankCut? **[Create an account at meerkat.blankcut.com](https://meerkat.blankcut.com/register)** —
that's the web console where you join the organization, create your first
project, and get the API key the CLI uses. Then follow
[Overview & setup](cli/index.md) to install and configure the CLI.

The CLI binary itself is distributed as auth-gated GitHub Releases, so your
GitHub account needs access to the BlankCut organization (granted when you
connect GitHub in Meerkat). **These docs are public; the binary and platform
internals are not.**
