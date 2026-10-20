# Troubleshooting

This page has two halves: using the server to find out what's wrong with a
workload, and fixing the server itself when it misbehaves.

---

## Diagnose a workload

### Pick the endpoint

| You want to know | Use |
|---|---|
| "Is anything wrong in this namespace?" | [`GET /namespaces/{namespace}/analysis`](api-overview.md#get-namespacesnamespaceanalysis) |
| "What's wrong with this Pod or Deployment?" | [`POST /mcp/troubleshoot`](api-overview.md#post-mcptroubleshoot) |
| A specific question about one object | [`POST /mcp/resource`](api-overview.md#post-mcpresource) |
| "What will this merge request do?" | [`POST /mcp/mergeRequest`](api-overview.md#post-mcpmergerequest) |

### Start with the namespace

Ask for the findings first. They come back in seconds and don't involve Claude:

```bash
curl -s -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/namespaces/shop/analysis?narrative=false" \
  | jq '.issues[] | {category, title, description}'
```

Every Warning event in the namespace becomes an issue, so expect some repeats.
Then drop `?narrative=false` to have Claude read the same findings, together
with the namespace's health and relationships, and write up what they mean and
what to do.

#### A failing CronJob

A CronJob that fails leaves every Deployment and Pod healthy, and its warning
event is gone within the hour. The analysis reads the CronJob's own status
instead, and reports it as a `CronJobFailing` issue:

```json
{
  "title": "Scheduled job failing: nightly-sync",
  "category": "CronJobFailing",
  "severity": "Warning",
  "source": "Kubernetes",
  "description": "Scheduled job nightly-sync (0 3 * * *) did not succeed on its last run at 2026-10-20T03:00:00Z; last success 2026-10-17T03:00:00Z. End of the failed run's log:\nconnecting to db...\nError: connect ECONNREFUSED 10.0.12.4:5432"
}
```

The issue includes the last 8 lines of the failed run's log; the prompt Claude
gets includes the last 40. When there's no log, the description says why:

| Note in the description | What it means |
|---|---|
| `no failed run is still recorded (failedJobsHistoryLimit may be 0)` | The CronJob doesn't keep failed Jobs, so there's nothing to read. Raise `failedJobsHistoryLimit`. |
| `the failed run's pod has already been cleaned up (ttlSecondsAfterFinished), so its log is gone` | The Job is still there but its Pod was deleted. Raise the Job's `ttlSecondsAfterFinished`, or ship logs somewhere that keeps them. |
| `could not read the run's log: ...` | The server isn't allowed to read Pod logs. Give its role `get` on `pods/log` (the Helm chart does from 1.4.0; see [Installation](installation.md#what-the-server-can-read)). |

A CronJob counts as failing when its last scheduled run is newer than its last
success (or it has never succeeded), it isn't suspended, and no run is in
progress. A suspended CronJob is never reported.

### Look at one object

Run the rule-based checks first, without a query:

```bash
curl -s -X POST http://localhost:8080/api/v1/mcp/troubleshoot \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"resource": "Pod", "name": "web-7d9c6b5f4-x2k8p", "namespace": "shop"}' \
  | jq '{issues, errors: .resourceContext.errors}'
```

The checks cover a Pod's phase, conditions, container states, restart counts and
volume claims, and a Deployment's replica counts and conditions. The full list
is in [Issue categories](api-overview.md#issue-categories). For other kinds,
the server checks only the object's Warning events, and the ArgoCD and GitLab
status it finds for it.

Then add a `query`. Claude gets the detected issues and is asked for concrete
`kubectl` commands to investigate and fix them:

```bash
curl -s -X POST http://localhost:8080/api/v1/mcp/troubleshoot \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "resource": "Pod",
    "name": "web-7d9c6b5f4-x2k8p",
    "namespace": "shop",
    "query": "It started crash-looping after this morning'\''s deploy."
  }' | jq -r .analysis
```

### Get better answers

- **Spell the kind as Kubernetes does** (`Pod`, `Deployment`). A lowercase kind
  still finds the object, but the event lookup compares the kind exactly and
  returns nothing, so Claude never sees the events.
- **Look at `resourceContext.errors`.** It lists what the server couldn't
  collect. With ArgoCD or GitLab not configured, those lookups always show up
  there; that's expected.
- **Ask soon.** Kubernetes keeps events for an hour by default. After that the
  server, and Claude, can't see them.
- **Claude only knows what the server sent.** It has no access to your cluster
  and can't run commands. If the answer is vague, the context probably didn't
  hold the evidence: check the Pod's logs yourself, or pass them in your
  question.
- **Be specific.** Say what changed and what you've ruled out.

---

## Fix the server

### The server won't start

The last log line names the problem. Configuration errors appear as
`"msg":"Invalid configuration"`:

| `error` | Fix |
|---|---|
| `server address is required` | Set `server.address`, such as `":8080"`. |
| `server read timeout must be non-negative` (or `write timeout`) | Use `0` or a positive number of seconds. |
| `claude authentication is required: set claude.apiKey, or configure claude.federation ...` | Set `claude.apiKey` (or `CLAUDE_API_KEY`), or all three required [federation](configuration.md#workload-identity-federation) fields. A `${VAR}` that isn't set expands to nothing. |
| `claude model ID is required` | Set `claude.modelID`. |
| `claude base URL is required` | Set `claude.baseURL` to `https://api.anthropic.com`. |
| `claude max tokens must be positive` / `cannot exceed 8192` | Set `claude.maxTokens` between `1` and `8192`. |
| `claude temperature must be between 0.0 and 1.0` | Fix `claude.temperature`, or remove it. |
| `cannot specify both inCluster=true and kubeconfig path` | Remove `kubeconfig`, or unset `KUBECONFIG` in the server's environment, or set `inCluster: false`. |
| `ArgoCD requires either authToken or username/password` | `argocd.url` is set without credentials. Add a token, or clear the URL. |
| `GitLab auth token is required when GitLab URL is provided` | `gitlab.url` is set without a token. Provide one (`secrets.gitlabToken` with the Helm chart), or clear the URL. Chart versions before 1.4.0 set `https://gitlab.com` by default. |

Other fatal errors:

| `msg` | Cause |
|---|---|
| `Failed to load configuration` | The config file is missing or isn't valid YAML. Check the `--config` path. |
| `Failed to create Kubernetes client` | No kubeconfig at the expected path, an unknown `defaultContext`, or `inCluster: true` outside a Pod. In a container, also check that the kubeconfig is readable by the container's user. |

### Every request answers `401`

Check the `error` in the response:

- `Invalid authorization format`: the header must be exactly
  `Authorization: Bearer <key>`, with `Bearer` capitalized and one space. Or
  send `X-API-Key: <key>` instead.
- `Invalid API key` with a key you're sure of: the server's own key is probably
  not what you think. If the config says `apiKey: "${API_KEY}"` and `API_KEY`
  wasn't set in the server's environment, the server's key is empty and nothing
  matches it. Set `API_KEY` and restart.

### ArgoCD shows no applications, or answers `503`

Check `components.argocd` in [`/api/v1/health`](api-overview.md#get-health):

| `status` | What to do |
|---|---|
| `denied` | The token works but its account can't `get` Applications. Grant it in ArgoCD's `argocd-rbac-cm`, for example `g, <account>, role:readonly` in `policy.csv`. |
| `unauthenticated` | ArgoCD rejected the token: it was revoked or has expired, or its account is disabled. Generate a new token and restart the server. |
| `unavailable` | The server can't reach ArgoCD. Check `argocd.url`, network access, and TLS (`insecure` for a test instance with a self-signed certificate). |
| `unknown` | ArgoCD isn't configured, or the first check hasn't finished. It runs at startup and every 60 seconds. |

While the token is refused, the applications list answers `503` with the reason
rather than an empty list, and readiness reports `degraded` but keeps the Pod
in service. A list that's empty with `status: authorized` really is empty.

### ArgoCD and GitLab calls all fail with `401`

Check that the token is current, and that a value read from a file in
[`SECRETS_DIR`](configuration.md#credential-files) has no trailing newline.

On v1.3.0 and earlier, also check that `VAULT_ADDR` and `VAULT_TOKEN` aren't
both set: those releases then replaced the ArgoCD and GitLab credentials with
placeholder values (the startup log says `Loaded ArgoCD credentials from vault`).
v1.4.0 removed that code and ignores both variables.

### GitLab shows `available` but project calls fail

Set `gitlab.apiVersion: "v4"`. The health check always uses the v4 path, but
every other GitLab call builds its path from `apiVersion`, and fails when it's
empty.

### A request returns nothing at all

If `curl` reports `Empty reply from server`, or your client sees the connection
close, the request ran longer than the server's
[`writeTimeout`](configuration.md#server). Claude-backed requests often take
tens of seconds, and asking about a whole namespace makes two Claude calls of up
to 120 seconds each. Set `writeTimeout` to `300`, or `0` for no limit, and check
any proxy or Ingress timeout in front of the server too.

### Claude-backed requests fail

They answer `500` with `"error": "Failed to process request"`, or
`"Failed to process troubleshoot analysis"`, and Claude's own error in
`details`:

| In `details` | Fix |
|---|---|
| `status 400` and `temperature` | The model rejects an explicit temperature (Claude Sonnet 5 does). Remove `claude.temperature` or set it to `0`. |
| `status 404` and the model | The model ID doesn't exist. See [Choosing a model](configuration.md#choosing-a-model). |
| `status 401` | The API key is wrong or revoked. |
| `token exchange failed` | Federation failed. See [Workload Identity Federation](configuration.md#workload-identity-federation). |

Namespace analysis is the exception: when Claude fails it still answers `200`,
with the findings and a plain summary in place of Claude's write-up. The server
logs `Claude analysis unavailable; returning deterministic findings` with the
reason.

If an answer comes back empty or cut short with `claude-sonnet-5`, the model
spent its token budget thinking. Keep `claude.maxTokens` at `8192`, the
maximum the server accepts.

### Namespace endpoints fail with `failed to get server resources`

The topology, graph, resources and analysis endpoints start by asking the
Kubernetes API which resource types exist. If any API group fails to answer,
for example `metrics.k8s.io` while metrics-server is down, that step fails and
the whole request answers `500`. Find the broken group with
`kubectl get apiservices` (look for `False` under `AVAILABLE`), and fix or
remove it.

### Getting more detail

Start the server with `--log-level debug`, or set `LOG_LEVEL=debug` in its
environment (with the Helm chart, through `extraEnv`). It then logs every call it
makes to Kubernetes, ArgoCD, GitLab and Claude, including retries. An explicit
flag wins over the variable. Before v1.4.0 the variable had no effect.

A few `WARN` lines at startup are normal: no secrets directory, and missing
credentials or failed connection checks for any integration you haven't
configured.
