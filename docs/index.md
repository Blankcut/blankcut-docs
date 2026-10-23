---
hide:
  - navigation
  - toc
---

<div class="bc-hero" markdown>

<img class="bc-hero__logo" src="assets/logo.svg" alt="Blank Cut">

# Meerkat docs

**Meerkat by Blank Cut** hosts your apps. Connect a GitHub repo and Meerkat
takes care of <span id="bc-rotator" class="bc-rotator">builds and deploys</span>.

[Get started](cli/index.md){ .md-button .md-button--primary }
[Open the console](https://meerkat.blankcut.com){ .md-button }

</div>

## Explore the docs

<div class="grid cards" markdown>

-   :material-console-line:{ .bc-card-icon } **[Blank Cut CLI](cli/index.md)**

    ---

    Ship a GitHub repo to production on Meerkat from the `blankcut` CLI:
    connect or create a project, deploy it, and manage its secrets, storage,
    scheduled jobs, image scans and domains.

-   :material-kubernetes:{ .bc-card-icon } **[Kubernetes MCP Server](kubernetes-mcp-server/index.md)**

    ---

    Open source from Blank Cut: ask Claude about your Kubernetes cluster,
    ArgoCD and GitLab over a REST API, with fast rule-based findings for
    failing workloads and CronJobs.

</div>

!!! note "For coding agents"
    Working in a repo connected to Meerkat? That repo's `CLAUDE.md` is the
    binding source of truth; these pages are its public, browsable version. Run
    `blankcut upgrade --check` and `blankcut sync` at the start of any session
    that uses the CLI. See [Coding agents](cli/agents.md).

## New to Meerkat?

[Create an account at **meerkat.blankcut.com**](https://meerkat.blankcut.com/register),
the Meerkat console, where you join your organization and connect GitHub. Then
[install the CLI](cli/index.md#install), run `blankcut login`, and
[deploy your first app](cli/deploy.md). Platform health is at
[status.blankcut.com](https://status.blankcut.com).

These docs are public; the platform binaries and internals are not.
