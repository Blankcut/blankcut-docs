---
hide:
  - navigation
  - toc
---

<div class="bc-hero" markdown>

<img class="bc-hero__logo" src="assets/logo.svg" alt="BlankCut">

# BlankCut Docs

Guides, references, and how-tos for the BlankCut platform and the tools we build
on it — like <span id="bc-rotator" class="bc-rotator">the blankcut CLI</span>.

[Get started](cli/index.md){ .md-button .md-button--primary }
[Kubernetes MCP Server](kubernetes-mcp-server/index.md){ .md-button }

</div>

## Explore the docs

<div class="grid cards" markdown>

-   :material-console-line:{ .bc-card-icon } **[BlankCut CLI](cli/index.md)**

    ---

    Ship a GitHub repo to production — scaffolding, validation, secrets,
    promotion, and live status, all from the `blankcut` CLI.

-   :material-kubernetes:{ .bc-card-icon } **[Kubernetes MCP Server](kubernetes-mcp-server/index.md)**

    ---

    AI-powered analysis and troubleshooting for your Kubernetes + GitOps
    workflows over the Model Context Protocol.

</div>

More tools land here as we build them — each gets its own section in the sidebar.

!!! note "For coding agents"
    Working in an onboarded repo? That repo's `CLAUDE.md` is the binding source
    of truth — these pages are its public, browsable version. Run
    `blankcut upgrade --check` at the start of any session that uses the CLI.

## New to BlankCut?

[Create an account at **meerkat.blankcut.com**](https://meerkat.blankcut.com/register)
— the web console where you join the organization, spin up projects, and get the
API key the CLI uses. Then head to the [CLI guide](cli/index.md) to install and
configure.

These docs are public; the platform binaries and internals are not.
