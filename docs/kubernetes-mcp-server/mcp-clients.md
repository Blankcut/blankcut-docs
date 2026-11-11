# Connect an MCP client

Since v1.5.0 the server speaks the Model Context Protocol. An AI assistant that
supports MCP can connect to it and read your cluster through tools, with no
script or `curl` in between.

---

## Connect

The endpoint is `/mcp` on the server's address, over Streamable HTTP. It takes
the same API key as the REST API, as an `X-API-Key` header or a bearer token.

In Claude Code:

```bash
claude mcp add --transport http kubernetes https://your-server.example.com/mcp \
  --header "X-API-Key: $KUBERNETES_MCP_API_KEY"
```

Any client that supports Streamable HTTP with a custom header connects the same
way.

!!! note "No local (stdio) mode yet"
    The server doesn't have a stdio transport, so a client that can only launch
    a local process can't use it directly. Run the server somewhere the client
    can reach over HTTP.

---

## Tools

Every tool only reads. Nothing an assistant does through them changes
Kubernetes or ArgoCD.

| Tool | What it returns |
|---|---|
| `troubleshoot_resource` | One resource's state, its events, related objects, the deployment history behind it, and the issues the server's own checks found. The first call to make when something is failing. |
| `list_namespaces` | The cluster's namespaces. |
| `list_resources` | Resources of one kind, each with its name, namespace, age and a one-line status. |
| `get_resource` | One resource's full object. |
| `get_events` | Recent events in a namespace, optionally for one resource. |
| `namespace_topology` | What exists in a namespace, how the resources relate, and each one's health. |
| `list_argocd_applications` | ArgoCD applications with their sync and health status. Offered only when ArgoCD is configured. |
| `get_argocd_application` | One ArgoCD application. Offered only when ArgoCD is configured. |

---

## How it differs from the REST API

**No tool calls Claude.** The REST analysis endpoints send what they collect to
Claude and return its answer, using the server's Claude credentials. An MCP
client is a model already, so it gets the collected facts and does its own
reasoning. Tool calls add nothing to your Claude usage on the server side.

**Secret values are never returned.** `get_resource` on a Secret keeps the key
names and replaces every value, so an assistant can see that a key exists
without seeing what it holds. The Helm chart's default role can't read Secrets
at all; this protects a server you run with wider access.

---

## What a tool can see

The tools read with the server's own Kubernetes permissions, the same as the
REST API. To narrow what an assistant can reach, narrow the server's role: see
[Configuration](configuration.md).
