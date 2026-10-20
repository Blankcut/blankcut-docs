# API reference

Every endpoint is under `/api/v1` and speaks JSON over HTTP. The examples assume
the server is at `http://localhost:8080` and your key is in `$API_KEY`.

---

## Endpoints

| Method | Path | Key needed | Calls Claude |
|---|---|---|---|
| `GET` | [`/api/v1/health`](#get-health) | no | no |
| `GET` | [`/api/v1/health/live`](#get-healthlive) | no | no |
| `GET` | [`/api/v1/health/ready`](#get-healthready) | no | no |
| `GET` | [`/api/v1/namespaces`](#get-namespaces) | yes | no |
| `GET` | [`/api/v1/resources/{type}`](#get-resourcestype) | yes | no |
| `GET` | [`/api/v1/resources/{type}/{name}`](#get-resourcestypename) | yes | no |
| `GET` | [`/api/v1/events`](#get-events) | yes | no |
| `GET` | [`/api/v1/namespaces/{namespace}/topology`](#get-namespacesnamespacetopology) | yes | no |
| `GET` | [`/api/v1/namespaces/{namespace}/graph`](#get-namespacesnamespacegraph) | yes | no |
| `GET` | [`/api/v1/namespaces/{namespace}/resources`](#get-namespacesnamespaceresources) | yes | no |
| `GET` | [`/api/v1/namespaces/{namespace}/analysis`](#get-namespacesnamespaceanalysis) | yes | yes, unless `?narrative=false` |
| `GET` | [`/api/v1/argocd/applications`](#get-argocdapplications) | yes | no |
| `GET` | [`/api/v1/argocd/applications/{name}`](#get-argocdapplicationsname) | yes | no |
| `GET` | [`/api/v1/gitlab/projects`](#get-gitlabprojects) | yes | no |
| `GET` | [`/api/v1/gitlab/projects/{projectId}/pipelines`](#get-gitlabprojectsprojectidpipelines) | yes | no |
| `POST` | [`/api/v1/mcp/resource`](#post-mcpresource) | yes | yes |
| `POST` | [`/api/v1/mcp/troubleshoot`](#post-mcptroubleshoot) | yes | only with a `query` |
| `POST` | [`/api/v1/mcp/mergeRequest`](#post-mcpmergerequest) | yes | yes |
| `POST` | [`/api/v1/mcp`](#post-mcp) | yes | yes |
| `POST` | [`/api/v1/mcp/commit`](#post-mcpcommit) | yes | not implemented |

Endpoints that call Claude typically take tens of seconds. Make sure your
client's timeout, any proxy in between, and the server's own
[`writeTimeout`](configuration.md#server) all allow for that.

None of these endpoints change anything in Kubernetes, ArgoCD or GitLab.

---

## Authentication

Every endpoint except the three health endpoints needs the key from
`server.auth.apiKey`. Send it either way:

```bash
curl -H "X-API-Key: $API_KEY" http://localhost:8080/api/v1/namespaces
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/api/v1/namespaces
```

If both headers are present, `X-API-Key` is the one checked. A failed check
returns `401` with one of these bodies:

| `error` | Cause |
|---|---|
| `Authentication required` | Neither header was sent. |
| `Invalid authorization format` | `Authorization` isn't exactly `Bearer <key>`. |
| `Invalid API key` | The key doesn't match. |

If the server has no key configured, every request fails this check.

Call the API from a server-side client. Responses carry
`Access-Control-Allow-Origin: *`, but the server doesn't answer CORS preflight
(`OPTIONS`) requests: they get a `404` or `405`, with no CORS headers. A browser
on another origin sends a preflight before any request with an API-key header,
so it can't call the API.

---

## Errors

Errors are JSON with an `error` message and, when there's an underlying cause,
`details`:

```json
{
  "details": "failed to get deployment shop/web: deployments.apps \"web\" not found",
  "error": "Failed to get resource"
}
```

| Status | When |
|---|---|
| `400` | The body isn't valid JSON, or a required field is missing. |
| `401` | The API key is missing or wrong. |
| `500` | Anything else that fails, including an object that doesn't exist. A missing object is a `500`, not a `404`; read `details`. |
| `503` | ArgoCD refused the server's token (ArgoCD endpoints), or readiness failed. |

`details` carries the underlying error as-is, which can include part of an
upstream response body. An unknown path returns a plain-text
`404 page not found`. A known path called with the wrong method returns `404` or
`405`, depending on the route.

There's no pagination: list endpoints return everything in one response.

---

## Health

### `GET /health`

Checks Kubernetes, ArgoCD and GitLab live on every call and always answers
`200`. Read `status` for the verdict. Because it calls out to ArgoCD and GitLab,
don't use it as a Kubernetes probe; use [`/health/live`](#get-healthlive) and
[`/health/ready`](#get-healthready).

```json
{
  "status": "degraded",
  "services": {
    "argocd": "unauthorized",
    "claude": "assumed available",
    "gitlab": "available",
    "kubernetes": "available"
  },
  "components": {
    "argocd": {
      "status": "denied",
      "reachable": true,
      "authorized": false,
      "checkedAt": "2026-10-20T14:03:11.402918Z",
      "message": "the ArgoCD token authenticates but lacks applications:get; check argocd-rbac-cm"
    }
  }
}
```

| Field | Values |
|---|---|
| `status` | `ok`, or `degraded` when Kubernetes isn't available or ArgoCD refused the token. An unconfigured or unreachable ArgoCD or GitLab doesn't make it `degraded`. |
| `services.kubernetes` | `available` or `unavailable`. |
| `services.argocd` | `available`; `unavailable` when it can't be reached or isn't configured; `unauthorized` when it's reachable but refused the token. |
| `services.gitlab` | `available` or `unavailable`. |
| `services.claude` | Always `assumed available`. Health checks never call Claude. |
| `components.argocd` | The ArgoCD authorization probe. See below. |

#### The ArgoCD authorization probe

Reaching ArgoCD doesn't prove the server can read anything from it. ArgoCD
silently leaves out Applications the caller isn't allowed to `get`, so a token
that has lost its RBAC grant still connects, and simply sees an empty list. To
catch that, the server asks ArgoCD's
`GET /api/v1/account/can-i/applications/get/*/*` at startup and every 60
seconds, and reports the cached answer here:

| `status` | Meaning | `reachable` | `authorized` |
|---|---|---|---|
| `authorized` | The token may get Applications in every project. | `true` | `true` |
| `denied` | The token is valid but lacks `applications, get`. Check ArgoCD's `argocd-rbac-cm`. | `true` | `false` |
| `unauthenticated` | ArgoCD rejected the token itself (HTTP `401`): it's revoked, expired, or its account is disabled. | `true` | `false` |
| `unavailable` | ArgoCD couldn't be reached or gave no usable answer. | `false` | `null` |
| `unknown` | No probe has finished yet, or ArgoCD isn't configured. | `false` | `null` |

`checkedAt` is when the last probe ran, and is left out until the first one
finishes. `message` appears only for `denied` and `unauthenticated`, and names
the fix. A change of state is logged once, at `ERROR` for `denied` and
`unauthenticated`.

### `GET /health/live`

Liveness. Answers `200` whenever the process can respond:

```json
{ "status": "ok", "alive": true }
```

### `GET /health/ready`

Readiness. Checks only that the Kubernetes API is reachable, and adds the
cached ArgoCD probe result without calling ArgoCD:

```json
{
  "status": "ready",
  "ready": true,
  "checks": { "kubernetes": true },
  "components": {
    "argocd": { "status": "authorized", "reachable": true, "authorized": true, "checkedAt": "2026-10-20T14:03:11.402918Z" }
  }
}
```

| Situation | HTTP | `status` | `ready` |
|---|---|---|---|
| Kubernetes reachable | `200` | `ready` | `true` |
| Kubernetes reachable, ArgoCD refused the token | `200` | `degraded` | `true` |
| Kubernetes unreachable | `503` | `not ready` | `false` |

ArgoCD never fails readiness on purpose. A failing readiness probe takes the Pod
out of its Service, which would take down every Kubernetes and GitLab endpoint
along with the ArgoCD ones.

---

## Kubernetes

### `GET /namespaces`

```json
{ "namespaces": ["default", "kube-system", "shop"] }
```

### `GET /resources/{type}`

Lists objects of one type, as full Kubernetes objects.

| Parameter | In | Notes |
|---|---|---|
| `type` | path | A resource type. These short names always work: `pod`, `deployment`, `service`, `configmap`, `secret`, `statefulset`, `daemonset`, `job`, `cronjob`, `ingress`, `namespace`, `node`, `pv`, `pvc`. Any other plural or singular name the cluster serves also works, including custom resources (`certificates`, `application`). Case doesn't matter. |
| `namespace` | query | Optional. Leave it out to list across all namespaces. |

```bash
curl -s -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/resources/deployment?namespace=shop"
```

```json
{
  "resources": [
    {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": { "name": "web", "namespace": "shop", "...": "..." },
      "spec": { "...": "..." },
      "status": { "...": "..." }
    }
  ]
}
```

An unknown type returns `500` with `details` `unknown resource type: <type>`.

### `GET /resources/{type}/{name}`

Returns one object, as-is. Pass `?namespace=` for namespaced types; without it,
the lookup fails.

```bash
curl -s -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/resources/deployment/web?namespace=shop"
```

### `GET /events`

Events about one object, newest first.

| Parameter | Notes |
|---|---|
| `namespace` | The object's namespace. Leave it out for cluster-scoped objects. |
| `resource` | The object's **kind**, spelled exactly as Kubernetes does: `Pod`, `Deployment`. Kubernetes compares it exactly, so `pod` matches nothing. |
| `name` | The object's name. |

```bash
curl -s -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/events?namespace=shop&resource=Pod&name=web-7d9c6b5f4-x2k8p"
```

```json
{
  "events": [
    {
      "reason": "BackOff",
      "message": "Back-off restarting failed container web in pod web-7d9c6b5f4-x2k8p_shop(…)",
      "type": "Warning",
      "count": 42,
      "firstTime": "2026-10-20T13:02:10Z",
      "lastTime": "2026-10-20T13:41:55Z",
      "object": { "kind": "Pod", "name": "web-7d9c6b5f4-x2k8p", "namespace": "shop" }
    }
  ]
}
```

`events` is `null` when there are none. Kubernetes keeps events for an hour by
default. Events recorded through the newer events API may show
`0001-01-01T00:00:00Z` for `firstTime` and `lastTime`.

### `GET /namespaces/{namespace}/topology`

A map of the namespace: which objects exist, how they relate, and a quick health
read of each. The server lists every namespaced resource type it's allowed to
list and skips the ones it isn't.

```json
{
  "namespace": "shop",
  "resources": {
    "Deployment": ["web"],
    "Pod": ["web-7d9c6b5f4-x2k8p"],
    "Service": ["web"]
  },
  "relationships": [
    {
      "sourceKind": "Service", "sourceName": "web", "sourceNamespace": "shop",
      "targetKind": "Pod", "targetName": "web-7d9c6b5f4-x2k8p", "targetNamespace": "shop",
      "relationType": "selects"
    }
  ],
  "metrics": {
    "Deployment": { "count": 1 },
    "Pod": { "count": 1 },
    "Service": { "count": 1 }
  },
  "health": {
    "Deployment": { "web": "healthy" },
    "Pod": { "web-7d9c6b5f4-x2k8p": "healthy" },
    "Service": { "web": "healthy" }
  }
}
```

`relationType` is one of:

| Value | Meaning |
|---|---|
| `owns` | The source is listed in the target's `ownerReferences` (Deployment → ReplicaSet → Pod). |
| `selects` | A Service's selector matches a Pod. |
| `mounts` | A Pod mounts a ConfigMap or Secret as a volume. |
| `configures` | A Pod reads a ConfigMap or Secret through `env` or `envFrom`. |
| `binds` | A PersistentVolumeClaim is bound to a PersistentVolume. |
| `routes` | An Ingress sends traffic to a Service. |

`health` values are `healthy`, `progressing`, `unhealthy` or `unknown`. They
come from a quick read of each object's status, not a full check:

- A Pod reads `healthy` while its phase is `Running`, which includes a container
  that's crash-looping. The analysis endpoint's `issues` catch that.
- Deployments, StatefulSets and ReplicaSets compare available replicas with
  `spec.replicas`. One scaled to zero, such as an old ReplicaSet left by a
  rollout, reads `unhealthy`, and so does every DaemonSet.

### `GET /namespaces/{namespace}/graph`

The topology as nodes and edges, for drawing:

```json
{
  "nodes": [
    { "id": 0, "kind": "Service", "name": "web", "health": "healthy", "group": "Service" },
    { "id": 1, "kind": "Pod", "name": "web-7d9c6b5f4-x2k8p", "health": "healthy", "group": "Pod" }
  ],
  "edges": [
    { "source": 0, "target": 1, "relationship": "selects" }
  ]
}
```

`source` and `target` are node `id`s. A relationship whose other end is outside
the namespace, such as a PersistentVolume, has no edge.

### `GET /namespaces/{namespace}/resources`

Every object in the namespace, grouped by kind, as full Kubernetes objects,
with a count per kind. This can be a large response.

```json
{
  "namespace": "shop",
  "resources": {
    "Deployment": [ { "apiVersion": "apps/v1", "kind": "Deployment", "...": "..." } ]
  },
  "stats": { "Deployment": 1, "Pod": 1, "Service": 1 }
}
```

### `GET /namespaces/{namespace}/analysis`

Looks for problems in a namespace and, by default, asks Claude to write them up.

| Parameter | Notes |
|---|---|
| `narrative` | `false` skips Claude and returns the findings alone, usually within seconds. Any other value, or none, includes Claude's analysis. |

The findings come from two places:

- **Warning events** in the namespace. Each becomes an issue.
- **CronJobs whose last scheduled run didn't succeed.** A failing CronJob leaves
  every Deployment and Pod healthy, and its warning event expires within the
  hour, so the server reads the CronJob's own status instead: it counts as
  failing when its last scheduled run is newer than its last success (or it has
  never succeeded), it isn't suspended, and no run is in progress. The issue
  carries the end of the failed run's Pod log when that Pod still exists.

A trimmed response with `?narrative=false`:

```json
{
  "namespace": "shop",
  "resourceCounts": { "CronJob": 1, "Deployment": 1, "Job": 1, "Pod": 2, "ReplicaSet": 1, "Service": 1 },
  "healthStatus": {
    "CronJob": { "unknown": 1 },
    "Deployment": { "healthy": 1 },
    "Job": { "unhealthy": 1 },
    "Pod": { "healthy": 1, "unhealthy": 1 },
    "ReplicaSet": { "healthy": 1 },
    "Service": { "healthy": 1 }
  },
  "resourceRelationships": [
    {
      "sourceKind": "Deployment", "sourceName": "web", "sourceNamespace": "shop",
      "targetKind": "ReplicaSet", "targetName": "web-7d9c6b5f4", "targetNamespace": "shop",
      "relationType": "owns"
    }
  ],
  "issues": [
    {
      "title": "Scheduled job failing: nightly-sync",
      "category": "CronJobFailing",
      "severity": "Warning",
      "source": "Kubernetes",
      "description": "Scheduled job nightly-sync (0 3 * * *) did not succeed on its last run at 2026-10-20T03:00:00Z; last success 2026-10-17T03:00:00Z. End of the failed run's log:\nconnecting to db...\nError: connect ECONNREFUSED 10.0.12.4:5432"
    }
  ],
  "recommendations": [],
  "analysis": "1 issue(s) found in shop:\n\n- Scheduled job failing: nightly-sync: Scheduled job nightly-sync ..."
}
```

| Field | What it holds |
|---|---|
| `resourceCounts` | Objects per kind. |
| `healthStatus` | Per kind, how many objects read `healthy`, `progressing`, `unhealthy` or `unknown` (see [topology](#get-namespacesnamespacetopology) for how that's judged). |
| `resourceRelationships` | As in the topology. `null` when there are none. |
| `issues` | The findings. See [Issue categories](#issue-categories). |
| `recommendations` | Up to 10 lines taken from Claude's analysis. Empty with `narrative=false`. |
| `analysis` | Claude's write-up. With `narrative=false`, or if the Claude call fails, a plain summary of the issues instead (`No issues found in shop.` when there are none). |

If Claude is unavailable, this endpoint still answers `200` with the findings.
A namespace that doesn't exist isn't an error: it has no resources and no
issues.

---

## ArgoCD

These need ArgoCD [configured](configuration.md#argocd).

### `GET /argocd/applications`

```json
{
  "applications": [
    {
      "metadata": { "name": "web", "namespace": "argocd", "labels": { "team": "shop" } },
      "spec": {
        "source": { "repoURL": "https://gitlab.com/acme/deploy.git", "path": "apps/web", "targetRevision": "main" },
        "destination": { "server": "https://kubernetes.default.svc", "namespace": "shop" }
      },
      "status": {
        "sync": { "status": "Synced", "revision": "4f1c2d9" },
        "health": { "status": "Healthy" },
        "resources": [
          {
            "group": "apps", "version": "v1", "kind": "Deployment", "namespace": "shop", "name": "web",
            "status": "Synced", "health": { "status": "Healthy", "message": "" }
          }
        ]
      },
      "name": ""
    }
  ]
}
```

Each Application is a subset of ArgoCD's own object: the fields shown above.
Read the name from `metadata.name`; the top-level `name` field is always empty.
An Application with several sources (`spec.sources`) shows an empty
`spec.source`.

If ArgoCD returns no Applications while the [authorization probe](#the-argocd-authorization-probe)
says it refused the token, this endpoint answers `503` instead of an empty list,
because the empty list would only reflect the refusal:

```json
{
  "details": "the ArgoCD token authenticates but lacks applications:get; check argocd-rbac-cm",
  "error": "ArgoCD denied applications:get for this server's token"
}
```

ArgoCD rejecting the token outright (`401`) gets the same `503`, with
`details` `ArgoCD rejected the token (HTTP 401); check ARGOCD_TOKEN and that its account is enabled`,
even before the first probe has run. A non-empty list is always returned as-is.
Other failures are `500`.

### `GET /argocd/applications/{name}`

One Application, in the same shape. A `401` from ArgoCD returns the same `503`
as above. Any other ArgoCD error, including a `403` or `404` for an
Application that doesn't exist or that the token can't see, is a `500` with
ArgoCD's status in `details`.

---

## GitLab

These need GitLab [configured](configuration.md#gitlab).

### `GET /gitlab/projects`

Up to 100 projects the token's user is a member of, most recently updated
first:

```json
{
  "projects": [
    {
      "id": 4821,
      "name": "deploy",
      "path": "deploy",
      "path_with_namespace": "acme/deploy",
      "web_url": "https://gitlab.com/acme/deploy",
      "default_branch": "main",
      "visibility": "private"
    }
  ]
}
```

### `GET /gitlab/projects/{projectId}/pipelines`

The project's 20 most recent pipelines, newest first. `projectId` is the
numeric project ID.

```json
{
  "pipelines": [
    {
      "id": 99812,
      "status": "failed",
      "ref": "main",
      "sha": "4f1c2d9e7b...",
      "web_url": "https://gitlab.com/acme/deploy/-/pipelines/99812",
      "created_at": "2026-10-20T12:58:03.114Z",
      "updated_at": "2026-10-20T13:04:41.870Z"
    }
  ]
}
```

---

## Claude-backed endpoints

These gather context, send it to Claude with your question, and return Claude's
answer. [How it works](model-context-protocol.md) describes what goes into the
context.

### Request fields

All of them take a JSON body built from these fields:

| Field | Type | Used by |
|---|---|---|
| `resource` | string | The object's kind, such as `Deployment`. Spell it as Kubernetes does, so the event lookup matches. |
| `name` | string | The object's name. |
| `namespace` | string | The object's namespace. Leave it out for cluster-scoped objects. |
| `query` | string | Your question. Optional, but Claude's answer is only as focused as the question. |
| `projectId` | string | A GitLab project: the numeric ID as a string (`"4821"`) or its path (`"acme/deploy"`). |
| `mergeRequestIid` | integer | A merge request's number within its project (the `42` in `!42`). |
| `context` | string | Optional. When set on a resource question, the server skips its own data collection and sends this text to Claude as the context. |
| `action` | string | `/mcp` only. |

### Response

```json
{
  "success": true,
  "message": "Successfully processed queryResource request in 11.204718321s",
  "analysis": "## Summary\n\nThe deployment `web` has 0 of 3 replicas available...",
  "context": { "kind": "", "name": "", "namespace": "", "apiVersion": "" }
}
```

`analysis` is Claude's answer, usually in Markdown. `context` is always present
and always empty in v1.3.0; ignore it. Some endpoints add a field, noted below.

### `POST /mcp/resource`

Ask Claude about one object. `resource` and `name` are required; without them
you get `400` `Resource and name are required`.

```bash
curl -s -X POST http://localhost:8080/api/v1/mcp/resource \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "resource": "Deployment",
    "name": "web",
    "namespace": "shop",
    "query": "Why are no replicas available?"
  }'
```

The server reads the object and its events, and tries to find the ArgoCD
Application that manages it, along with that Application's sync history and
GitLab project, last pipeline and recent commits. For a Deployment it also
pulls out the replica counts and each container's image and resource settings.
A lookup that fails doesn't fail the request: Claude is told what couldn't be
collected. So a mistyped name still returns `200`, with Claude saying it found
nothing.

**A whole namespace.** With `"resource": "namespace"`, `name` is the namespace.
The server runs the full [namespace analysis](#get-namespacesnamespaceanalysis),
then asks your question with a summary of the namespace's resources,
relationships, health and recent events. The response adds a
`namespaceAnalysis` field with the analysis result. This makes two Claude
calls, so it's the slowest request.

### `POST /mcp/troubleshoot`

Runs rule-based checks on one object. `resource` and `name` are required.

Without a `query`, the result comes back directly and Claude isn't called:

```json
{
  "resourceContext": {
    "kind": "Pod",
    "name": "web-7d9c6b5f4-x2k8p",
    "namespace": "shop",
    "apiVersion": "v1",
    "events": [
      {
        "reason": "BackOff",
        "message": "Back-off restarting failed container web in pod web-7d9c6b5f4-x2k8p_shop(…)",
        "type": "Warning",
        "count": 42,
        "firstTime": "2026-10-20T13:02:10Z",
        "lastTime": "2026-10-20T13:41:55Z",
        "object": { "kind": "Pod", "name": "web-7d9c6b5f4-x2k8p", "namespace": "shop" }
      }
    ],
    "errors": [
      "Failed to find ArgoCD applications: failed to list applications: failed to add authentication: no valid ArgoCD credentials available"
    ]
  },
  "issues": [
    {
      "title": "Container web CrashLoopBackOff",
      "category": "CrashLoopBackOff",
      "severity": "Error",
      "source": "Kubernetes",
      "description": "Container is waiting: CrashLoopBackOff - back-off 5m0s restarting failed container=web pod=web-7d9c6b5f4-x2k8p_shop(…)"
    },
    {
      "title": "Container web Frequent Restarts",
      "category": "FrequentRestarts",
      "severity": "Warning",
      "source": "Kubernetes",
      "description": "Container has restarted 12 times"
    }
  ],
  "recommendations": [
    "Check container logs for errors.",
    "Verify environment variables and configuration."
  ]
}
```

That example is trimmed; a crash-looping Pod also reports its failing
readiness conditions. `resourceContext` can also carry `argoApplication`,
`argoSyncStatus`, `argoHealthStatus`, `argoSyncHistory`, `gitlabProject`,
`lastPipeline`, `lastDeployment` and `recentCommits` when the server finds them.
`errors` lists what it couldn't collect; with ArgoCD or GitLab not configured,
those lookups always appear there. `recommendations` are fixed advice for each
issue category, in no particular order.

With a `query`, the server also asks Claude for specific `kubectl` commands to
investigate and fix the issues, and returns the
[standard response](#response) with the result added as `troubleshootResult`.

The checks are listed under [Issue categories](#issue-categories).

### `POST /mcp/mergeRequest`

Ask Claude about a GitLab merge request's effect on the cluster. `projectId` and
`mergeRequestIid` are required; without them you get `400`
`Project ID and merge request IID are required`.

```bash
curl -s -X POST http://localhost:8080/api/v1/mcp/mergeRequest \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "projectId": "acme/deploy",
    "mergeRequestIid": 42,
    "query": "What will this change do to the running workloads?"
  }'
```

The server reads the merge request's changes. If no changed file looks like a
Helm chart (`Chart.yaml`, `values.yaml`, `templates/*.yaml`) or a Kubernetes
manifest, Claude gets no cluster context and answers from your question alone.
Otherwise the server looks for ArgoCD Applications whose source is this
project and whose path contains a changed file, and adds the objects they
manage. This needs ArgoCD: if listing Applications fails, the request fails
with `500`.

### `POST /mcp`

The generic form. Set `action` to choose what to do:

| `action` | Same as |
|---|---|
| `queryResource` | [`/mcp/resource`](#post-mcpresource), except `resource` and `name` aren't checked and a namespace isn't handled specially. |
| `queryMergeRequest` | [`/mcp/mergeRequest`](#post-mcpmergerequest), without the field checks. |

Any other value returns `500` with `details` `unsupported action: <action>`.
Prefer the specific endpoints.

### `POST /mcp/commit`

Registered, but not implemented in v1.3.0. With `projectId` and `commitSha` set
it returns `500` with `details` `unsupported action: queryCommit`; without them,
`400`.

---

## Issue categories

`issues` in the namespace analysis and the troubleshoot result share one shape:

| Field | Values |
|---|---|
| `title` | A short label. |
| `category` | One of the categories below. |
| `severity` | `Warning` or `Error`. |
| `source` | `Kubernetes`, `ArgoCD` or `GitLab`. |
| `description` | The detail, often the event or status message. |

From **Warning events** (both endpoints), matched on the event's reason and
message:

| Category | Matches |
|---|---|
| `ImagePullError` | Reason contains `Failed` and message contains `ImagePull`. |
| `HealthCheckFailure` | Reason contains `Unhealthy` (a failing probe). |
| `ResourceIssue` | Message mentions `memory` or `cpu`. |
| `CrashLoopBackOff` | Reason contains `BackOff`. |
| `OtherWarning` | Any other Warning event. |

From **CronJob status** (namespace analysis only): `CronJobFailing`.

From the **object's status** (troubleshoot only):

| Category | Checked on | Raised when |
|---|---|---|
| `PodNotRunning` | Pod | Phase is `Pending` or `Failed`. |
| `SchedulingIssue`, `InitializationIssue`, `ContainerReadinessIssue`, `PodNotReady` | Pod | The `PodScheduled`, `Initialized`, `ContainersReady` or `Ready` condition isn't `True`. |
| `CrashLoopBackOff`, `ImagePullError`, `PodInitializing`, `ContainerWaiting` | Pod | A container or init container is waiting, by its reason. |
| `ContainerTerminated` | Pod | A container exited with a non-zero code. |
| `FrequentRestarts` | Pod | A container has restarted more than 3 times. |
| `VolumeIssue` | Pod | A mounted PersistentVolumeClaim is missing or not `Bound`. |
| `DeploymentNotAvailable`, `DeploymentNotReady`, `DeploymentNotProgressing` | Deployment | Fewer available or ready replicas than desired, or the `Available`/`Progressing` condition isn't `True`. |
| `UnknownIssue` | Pod, Deployment | Nothing else matched but the object isn't healthy. |
| `SyncIssue`, `HealthIssue`, `SyncFailure` | the managing ArgoCD Application | Not `Synced`, not `Healthy`, or a recent failed sync. |
| `PipelineIssue`, `DeploymentIssue` | the GitLab project | The last pipeline or deployment didn't succeed. |
