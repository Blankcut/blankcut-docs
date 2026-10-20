# How it works

The server's job is to collect the right facts about your cluster, put them in a
form Claude can read, and ask Claude your question. This page describes what it
collects, what Claude receives, and where the limits are.

---

## The name

The project takes its name from the Model Context Protocol, the idea of giving a
model structured context about a system. It doesn't implement the protocol
itself: there's no JSON-RPC transport and no tool discovery, so an MCP client
such as Claude Desktop or Claude Code can't connect to it. It's a REST API. To
use it from an AI assistant, give the assistant a way to make HTTP requests to
it, such as a script or `curl`.

---

## The pieces

| Piece | What it does |
|---|---|
| **HTTP API** | Routes requests, checks the API key, and returns JSON. |
| **Kubernetes client** | Reads the cluster through the Kubernetes API, using your kubeconfig or the Pod's service account. It discovers resource types at request time, so custom resources work too. It only reads. |
| **ArgoCD client** | Reads Applications through ArgoCD's REST API. In the background, it checks every 60 seconds that its token may read Applications. |
| **GitLab client** | Reads projects, pipelines, deployments, commits and merge requests through GitLab's REST API. |
| **Correlator** | Tries to link a Kubernetes object to the ArgoCD Application that manages it, and that Application's repository URL to a GitLab project. |
| **Rule-based checks** | Turn Warning events, failing CronJobs, and Pod and Deployment status into a list of issues. These don't involve Claude. |
| **Context builder** | Turns everything collected into a Markdown document for Claude, and trims it if it's too long. |
| **Claude client** | Makes one call to the Claude Messages API per answer, authenticated with an API key or Workload Identity Federation. |

---

## What happens on a question

Take `POST /api/v1/mcp/resource` about a Deployment:

1. **Collect.** The server reads the Deployment's full object and its events. It
   looks for the ArgoCD Application that manages it and, if it finds one, that
   Application's sync status and recent syncs. From the Application's
   repository URL it looks up the GitLab project, then the project's latest
   pipeline, its latest deployment to the Application's environment, and up to
   5 commits from the last 24 hours. Any lookup that fails is recorded and
   skipped rather than failing the request.
2. **Build the context.** The results become a Markdown document with a section
   for each source: the object's JSON; for a Deployment, its replica counts and
   each container's image and resource settings; the ArgoCD Application and its
   sync history; the GitLab project, pipeline, deployment and commits; the
   events; and finally an "Errors in Data Collection" section listing what
   couldn't be collected.
3. **Trim.** If the document is longer than 100,000 characters, the server keeps
   the first 60% and the last 40% and marks the cut with
   `[...Content truncated...]`.
4. **Ask Claude.** The server sends one request: a fixed system prompt, then
   the context followed by your `query`. `max_tokens` is your `maxTokens`, and
   `temperature` is sent only when you've set one.
5. **Answer.** Claude's text comes back as `analysis`.

The system prompt tells Claude it's a Kubernetes GitOps assistant, to rely only
on what's in the context and say when something isn't there, to look for links
between problems in different systems (a failed pipeline behind an out-of-sync
Application, for example), and to suggest fixes and correctly formatted
`kubectl`, `argocd` or GitLab commands.

### Other endpoints

| Endpoint | What goes into the context |
|---|---|
| [Namespace analysis](api-overview.md#get-namespacesnamespaceanalysis) | Resource counts per kind; health per kind, naming the unhealthy objects; relationships grouped by type; up to 10 Warning and 5 other recent events; and, for each failing CronJob, its schedule, last run, last success and the last 40 lines of the failed run's log. Claude is asked for an overall assessment, problems, bottlenecks, security concerns and recommendations. |
| [Troubleshoot](api-overview.md#post-mcptroubleshoot) with a query | The issues the rule-based checks found and their stock recommendations, and a request for specific `kubectl` commands. Not the full object. |
| [Resource question about a namespace](api-overview.md#post-mcpresource) | Resource counts, relationships, health counts and up to 10 recent events. |
| [Merge request](api-overview.md#post-mcpmergerequest) | One section per Kubernetes object managed by an ArgoCD Application the merge request touches, built as in step 2. |

---

## Deterministic and Claude-written parts

Some answers don't depend on Claude at all:

- The `issues` in a namespace analysis and a troubleshoot result come from fixed
  rules. The same cluster state gives the same issues.
- `?narrative=false` on the namespace analysis returns only those, without
  calling Claude, typically within seconds.
- If Claude can't be reached, the namespace analysis still answers, with a plain
  summary of the issues in place of the write-up.

Claude's `analysis` is generated text. Treat it like advice from a colleague who
has read the same facts: useful, but check it before acting, especially a
suggested command.

---

## Limits

- **Claude sees only the context.** It has no tools and no access to your
  cluster, and each request is independent: there's no conversation memory
  between calls.
- **Pod logs aren't included,** except the tail of a failed CronJob run. If the
  cause is in a container's log, put the relevant lines in your question.
- **Events are short-lived.** Kubernetes keeps them for an hour by default, so
  what the server can see about a past incident fades quickly.
- **Size.** The context is capped at 100,000 characters, and a very large object
  or a busy namespace can be cut in the middle.
- **Everything collected is sent to the Claude API**, including the full JSON of
  the object you ask about. Don't ask about Secrets.
