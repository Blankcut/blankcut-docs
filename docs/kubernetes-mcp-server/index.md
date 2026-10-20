# Kubernetes MCP Server

The Kubernetes MCP Server is an open-source Go service that answers questions
about a Kubernetes cluster with Claude. It reads from the Kubernetes API, and
optionally from ArgoCD and GitLab, gathers what's relevant to a question, sends
it to the Claude API, and returns Claude's analysis. Everything is exposed as a
plain **REST API** over HTTP.

- Source: [github.com/Blankcut/kubernetes-mcp-server](https://github.com/Blankcut/kubernetes-mcp-server) (MIT licence)
- Current release: **v1.3.0**
- Docker image: [`blankcut/kubernetes-mcp-server`](https://hub.docker.com/r/blankcut/kubernetes-mcp-server) (`linux/amd64`, `linux/arm64`)

!!! note "About the name"
    "MCP" comes from the Model Context Protocol, but this server does **not**
    implement the MCP wire protocol. There is no JSON-RPC transport (stdio, SSE
    or streamable HTTP) and no `tools/list`, so MCP clients such as Claude
    Desktop or Claude Code can't connect to it directly. You call it over HTTP
    like any other API. The `/api/v1/mcp/*` endpoints are the ones that gather
    cluster context and ask Claude about it. See [How it works](model-context-protocol.md).

---

## What it does

| Area | What you get |
|---|---|
| **Kubernetes reads** | Namespaces, any resource type (built-in or custom), events, and a per-namespace map of resources, relationships and health. |
| **Namespace analysis** | Warning events and failing CronJobs (with the end of the failed run's log) turned into a list of issues, plus an optional written analysis from Claude. Ask for the findings alone and you get them in seconds. |
| **Resource troubleshooting** | Rule-based checks on a Pod or Deployment (crash loops, image pulls, scheduling, unbound volumes, unavailable replicas), plus ArgoCD and GitLab status when the server can find them. Add a question and Claude explains the findings. |
| **Ask Claude** | Send a question about one resource, a whole namespace, or a GitLab merge request. |
| **ArgoCD** | List and read Applications. Every 60 seconds the server checks that its token can actually read them, so a lost RBAC grant shows up as an error instead of an empty list. |
| **GitLab** | List projects and recent pipelines. |

None of the endpoints change anything in Kubernetes, ArgoCD or GitLab. They
only read.

---

## What you need

- **A Kubernetes cluster** the server can reach: a kubeconfig file when it runs
  outside the cluster, or a service account when it runs inside.
- **Claude API access**: an API key, or
  [Workload Identity Federation](configuration.md#workload-identity-federation)
  so the server holds no long-lived key.
- **ArgoCD** (optional): an API token, or a username and password.
- **GitLab** (optional): an access token for gitlab.com or a self-managed
  instance.

---

## Where to go next

| Page | Read it to |
|---|---|
| [Quick start](quick-start.md) | Run the server on your machine against your current kubeconfig and make your first calls. |
| [Installation](installation.md) | Deploy with the Helm chart, run the Docker image, or use a release binary. |
| [Configuration](configuration.md) | Look up every config key, environment variable and flag, choose a model, or set up Workload Identity Federation. |
| [API reference](api-overview.md) | See every endpoint with its request and response. |
| [Troubleshooting](troubleshooting-resources.md) | Diagnose a namespace or a failing workload, or fix the server itself. |
| [How it works](model-context-protocol.md) | Understand what the server collects, what it sends to Claude, and its limits. |
