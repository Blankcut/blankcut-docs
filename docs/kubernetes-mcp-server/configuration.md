# Configuration

The server reads one YAML file at startup. Environment variables can fill in or
override parts of it, and two command-line flags choose the file and the log
level. This page lists every setting the server reads.

---

## How the config is loaded

1. **Read the file** given by `--config` (default `config.yaml` in the working
   directory; the Docker image and Helm chart use `/app/config.yaml`).
2. **Expand variables.** Every `${NAME}` or `$NAME` in the file is replaced with
   that environment variable's value, or with nothing if it isn't set. Use this
   to keep secrets out of the file:

    ```yaml
    claude:
      apiKey: "${CLAUDE_API_KEY}"
    ```

    Expansion covers the whole file, so a literal `$` in a value, such as a
    password, is read as the start of a variable name and mangled. Pass such
    values through one of the [override variables](#environment-variables)
    instead. Those are used as-is.

3. **Apply overrides.** A handful of [environment variables](#environment-variables)
   replace specific keys when they're set and non-empty.
4. **Validate.** If a check fails, the server logs
   `"msg":"Invalid configuration"` with the reason and exits. The checks are
   listed under [The server won't start](troubleshooting-resources.md#the-server-wont-start).

The file is read once. To apply a change, restart the server. `SIGINT` and
`SIGTERM` shut it down cleanly; there is no reload signal.

There are no built-in defaults: a key you leave out is empty, `0` or `false`.
The tables below say what that means for each key.

---

## Full example

```yaml
server:
  address: ":8080"
  readTimeout: 30
  writeTimeout: 300
  auth:
    apiKey: "${API_KEY}"

kubernetes:
  inCluster: false
  kubeconfig: ""            # "" = ~/.kube/config
  defaultContext: ""        # "" = the kubeconfig's current context

argocd:
  url: "https://argocd.example.com"
  authToken: "${ARGOCD_AUTH_TOKEN}"
  insecure: false

gitlab:
  url: "https://gitlab.com"
  authToken: "${GITLAB_AUTH_TOKEN}"
  apiVersion: "v4"

claude:
  apiKey: "${CLAUDE_API_KEY}"
  baseURL: "https://api.anthropic.com"
  modelID: "claude-sonnet-5"
  maxTokens: 8192
  # temperature: leave unset for claude-sonnet-5
```

Leave out the `argocd` or `gitlab` block (or its `url`) to run without that
integration.

---

## `server`

| Key | Required | What it does |
|---|---|---|
| `address` | yes | Address to listen on, as `host:port`. `":8080"` listens on every interface; `"127.0.0.1:8080"` only on localhost. |
| `readTimeout` | no | Seconds allowed to read a request. `0` or unset: no limit. |
| `writeTimeout` | no | Seconds allowed from receiving a request to finishing the response, which includes all the work the request does. `0` or unset: no limit. Each Claude call can take up to 120 seconds, and asking about a whole namespace makes two, so set this to `300` or leave it unset. When it's too short, the client gets a closed connection and no response. |
| `auth.apiKey` | in practice | The key clients must send in `X-API-Key` or `Authorization: Bearer`. The server starts without one, but then every endpoint except health answers `401`, so an unset `${API_KEY}` shows up as a key that's never accepted. Overridden by `API_KEY`. |

---

## `kubernetes`

| Key | Required | What it does |
|---|---|---|
| `inCluster` | no | `true`: use the Pod's service account. Use it when the server runs in the cluster it inspects. Can't be combined with a kubeconfig path, and that includes `KUBECONFIG` being set. |
| `kubeconfig` | no | Path to one kubeconfig file. Empty: `~/.kube/config`. Overridden by `KUBECONFIG`, which must also be a single path; a colon-separated list isn't merged. Ignored when `inCluster` is `true`. |
| `defaultContext` | no | Context to use from the kubeconfig. Empty: the file's current context. |
| `defaultNamespace` | no | Accepted, but no endpoint uses it in v1.3.0. Pass the namespace on each request. |

If the server can't build a Kubernetes client (a missing kubeconfig, an unknown
context, no service account), it exits. If it builds one but can't reach the
API server, it starts anyway and reports `kubernetes: unavailable`.

---

## `argocd`

ArgoCD is optional. With no `url`, the ArgoCD endpoints fail and health reports
ArgoCD as `unavailable`.

| Key | Required | What it does |
|---|---|---|
| `url` | no | ArgoCD's base URL, such as `https://argocd.example.com`. The server adds `/api/v1/...` itself. Overridden by `ARGOCD_SERVER`. |
| `authToken` | one of token or username/password | An ArgoCD API token (`argocd account generate-token`). Overridden by `ARGOCD_AUTH_TOKEN`. |
| `username`, `password` | one of token or username/password | A local ArgoCD account. The server opens a session and opens a new one when ArgoCD rejects the old one. Overridden by `ARGOCD_USERNAME` and `ARGOCD_PASSWORD`. |
| `insecure` | no | `true` skips TLS certificate verification. For test instances only. |

When both a token and a username/password are configured, the token is used.

The account needs read access to Applications, for example ArgoCD's built-in
`role:readonly`. The server checks this itself: at startup and every 60
seconds it asks ArgoCD whether the token may `get` applications in every
project, and reports the answer in the [health endpoints](api-overview.md#health).

---

## `gitlab`

GitLab is optional. With no `url`, the GitLab endpoints fail and health reports
GitLab as `unavailable`.

| Key | Required | What it does |
|---|---|---|
| `url` | no | GitLab's base URL: `https://gitlab.com` or your own instance. Overridden by `GITLAB_URL`. |
| `authToken` | when `url` is set | A personal, group or project access token, sent as `PRIVATE-TOKEN`. The `read_api` scope is enough. Overridden by `GITLAB_AUTH_TOKEN`. |
| `apiVersion` | set it to `v4` | The API version in request paths. If you leave it empty, health still reports GitLab as `available`, but every project, pipeline and merge request call fails. |

The project to look at comes from each request, or from the repository URL of
the ArgoCD Application that manages a resource. There is no default project
setting; a `projectPath` key, which older examples show, is ignored.

---

## `claude`

| Key | Required | What it does |
|---|---|---|
| `apiKey` | yes, unless [federation](#workload-identity-federation) is fully configured | Your Claude API key, sent as `x-api-key`. Overridden by `CLAUDE_API_KEY`. |
| `baseURL` | yes | `https://api.anthropic.com`, without a trailing slash. The server adds `/v1/messages`. |
| `modelID` | yes | The Claude model to use. See [Choosing a model](#choosing-a-model). |
| `maxTokens` | yes | Most tokens one answer may use, from `1` to `8192`. |
| `temperature` | no | `0.0` to `1.0`. `0` or unset means the field isn't sent and the model uses its default. Some models reject any explicit value. |
| `federation` | no | [Workload Identity Federation](#workload-identity-federation) settings. |

### Choosing a model

The server passes `modelID` to the Claude Messages API unchanged, so any model
ID the API accepts works. These are the ones the project's examples use:

| Model ID | Notes |
|---|---|
| `claude-sonnet-5` | Recommended. Leave `temperature` unset: Claude Sonnet 5 rejects any explicit value with a `400`. It thinks before answering by default, and that thinking counts against `maxTokens`, so keep `maxTokens` at `8192`. Set too low, the answer can come back short or empty. |
| `claude-sonnet-4-6` | The Helm chart's default. Accepts `temperature`. |
| `claude-opus-4-6` | A larger model: slower, and more expensive per token. Accepts `temperature`. |
| `claude-haiku-4-5` | Fastest and cheapest. Accepts `temperature`. |

On models that accept it, a low temperature such as `0.3` keeps answers focused.

---

## Workload Identity Federation

Federation lets the server authenticate to Claude without a long-lived API key.
The server reads a short-lived OIDC token issued by an identity provider you
already run (in Kubernetes, a projected service-account token), exchanges it
for a Claude access token, and uses that instead. There's no API key to store
or rotate. It's optional; without a `federation` block the server uses
`apiKey`.

First set up an issuer, a service account and a federation rule in the Claude
Console (**Settings → Workload identity**). Then configure the server:

```yaml
claude:
  baseURL: "https://api.anthropic.com"
  modelID: "claude-sonnet-5"
  maxTokens: 8192
  federation:
    identityTokenFile: "/var/run/secrets/anthropic.com/token"
    federationRuleID: "fdrl_..."
    organizationID: "00000000-0000-0000-0000-000000000000"
    serviceAccountID: "svac_..."
```

| Key | Environment variable | Required | What it is |
|---|---|---|---|
| `identityTokenFile` | `ANTHROPIC_IDENTITY_TOKEN_FILE` | yes | Path of the file holding the OIDC token. Read again for every exchange. |
| `federationRuleID` | `ANTHROPIC_FEDERATION_RULE_ID` | yes | The federation rule's ID. |
| `organizationID` | `ANTHROPIC_ORGANIZATION_ID` | yes | Your Claude organization's ID. |
| `serviceAccountID` | `ANTHROPIC_SERVICE_ACCOUNT_ID` | no | The service account's ID. Sent when set. |
| `workspaceID` | `ANTHROPIC_WORKSPACE_ID` | only for multi-workspace rules | The workspace to act in, when the rule covers more than one. |

The environment variables use the same names as the official Anthropic SDKs,
so a workload already set up for federation needs no extra wiring. The SDKs'
`ANTHROPIC_IDENTITY_TOKEN` (the token itself rather than a file) isn't read
here; use a file.

How it behaves:

- **Federation turns on when the three required fields are set.** With only
  some of them, the server ignores federation and uses `apiKey`; if `apiKey` is
  also empty, it refuses to start.
- **When federation is on, it wins.** The server uses it even if `apiKey` is
  also set, and never sends both.
- **Exchange.** The server posts the token to `<baseURL>/v1/oauth/token`, keeps
  the access token it gets back, and fetches a new one two minutes before that
  one expires.
- **Failure.** If the exchange fails, requests that need Claude fail with a
  message that includes `token exchange failed with status ...`. A `401` there
  usually means the rule doesn't match the token's subject or audience, or the
  token was already used.

### In Kubernetes

Project a service-account token with the Claude API as its audience, and point
`identityTokenFile` at it:

```yaml
# In the Pod spec
containers:
  - name: kubernetes-mcp-server
    volumeMounts:
      - name: anthropic-token
        mountPath: /var/run/secrets/anthropic.com
        readOnly: true
volumes:
  - name: anthropic-token
    projected:
      sources:
        - serviceAccountToken:
            path: token
            audience: https://api.anthropic.com
            expirationSeconds: 600
```

Two things to get right:

- **The audience must be `https://api.anthropic.com`.** On EKS, don't reuse the
  IRSA token in `AWS_WEB_IDENTITY_TOKEN_FILE`: its audience is
  `sts.amazonaws.com`, and the exchange rejects it. Project a second token.
- **Keep `expirationSeconds` short.** Identity tokens are single-use, and
  Kubernetes only replaces the file at about 80% of its lifetime. If the file
  lives longer than the Claude access token, the next renewal presents a token
  that was already spent and fails. `600` is the shortest Kubernetes allows.

The Helm chart has no settings for this yet; see
[Installation](installation.md#chart-values).

---

## Environment variables

Override variables replace a key from the file when they're set and non-empty.

| Variable | Replaces |
|---|---|
| `API_KEY` | `server.auth.apiKey` |
| `KUBECONFIG` | `kubernetes.kubeconfig` (a single path) |
| `CLAUDE_API_KEY` | `claude.apiKey` |
| `ANTHROPIC_IDENTITY_TOKEN_FILE` | `claude.federation.identityTokenFile` |
| `ANTHROPIC_FEDERATION_RULE_ID` | `claude.federation.federationRuleID` |
| `ANTHROPIC_ORGANIZATION_ID` | `claude.federation.organizationID` |
| `ANTHROPIC_SERVICE_ACCOUNT_ID` | `claude.federation.serviceAccountID` |
| `ANTHROPIC_WORKSPACE_ID` | `claude.federation.workspaceID` |
| `ARGOCD_SERVER` | `argocd.url` |
| `ARGOCD_AUTH_TOKEN` | `argocd.authToken` |
| `ARGOCD_USERNAME`, `ARGOCD_PASSWORD` | `argocd.username`, `argocd.password` |
| `GITLAB_URL` | `gitlab.url` |
| `GITLAB_AUTH_TOKEN` | `gitlab.authToken` |

These are also read:

| Variable | Effect |
|---|---|
| `ARGOCD_TOKEN` | Used as the ArgoCD token when `ARGOCD_AUTH_TOKEN` isn't set. On its own it doesn't satisfy the startup check, so reference it in the file as well (`authToken: "${ARGOCD_TOKEN}"`), as the Helm chart does. |
| `GITLAB_TOKEN` | The same, for GitLab. |
| `SECRETS_DIR` | Directory of [credential files](#credential-files). Default `./secrets`. |
| `VAULT_ADDR`, `VAULT_TOKEN` | Vault isn't supported. **Unset both.** When both are set, v1.3.0 replaces the ArgoCD and GitLab credentials with placeholder values, and every call to those systems fails with `401`. |
| `LOG_LEVEL` | Has no effect: the `--log-level` flag always sets the level. |

---

## Credential files

If the directory named by `SECRETS_DIR` (default `./secrets`, relative to the
working directory) exists, the server looks there for ArgoCD and GitLab
credentials before it looks at environment variables or the config file:

```text
secrets/
├── argocd/
│   ├── token          # or username + password
│   ├── username
│   └── password
└── gitlab/
    └── token
```

Each file holds one value, used exactly as written, so write it without a
trailing newline (`printf '%s' "$TOKEN" > secrets/gitlab/token`). The files
don't satisfy the startup check on their own: with an ArgoCD or GitLab `url`
set, the config must still contain a token or username/password. The Claude
key isn't read from this directory.

The full order the server uses, first match wins:

- **ArgoCD:** credential files → `ARGOCD_AUTH_TOKEN`, then `ARGOCD_TOKEN` →
  `argocd.authToken` → `ARGOCD_USERNAME` with `ARGOCD_PASSWORD` →
  `argocd.username` with `argocd.password`.
- **GitLab:** credential files → `GITLAB_AUTH_TOKEN`, then `GITLAB_TOKEN` →
  `gitlab.authToken`.
- **Claude:** `federation` when its required fields are set → `CLAUDE_API_KEY` →
  `claude.apiKey`.

A `WARN` line saying the secrets directory isn't available is normal when you
don't use one.

---

## Command-line flags

| Flag | Default | What it does |
|---|---|---|
| `--config` | `config.yaml` | Path to the config file. |
| `--log-level` | `info` | `debug`, `info`, `warn` or `error`. Any other value means `info`. |

---

## Logging

The server writes one JSON object per line to standard output, with `time`,
`level`, `logger`, `caller` and `msg`, plus any fields for that event. Every
HTTP request is logged at `info` with its method, path, status and duration.
`ERROR` entries include a stack trace.

`debug` adds every outgoing call to Kubernetes, ArgoCD, GitLab and Claude,
including retries. Use it while you diagnose a problem, not all the time.

---

## Timeouts and retries

| Call | Timeout | Retries |
|---|---|---|
| Claude API | 120 seconds per call | None. |
| ArgoCD, GitLab | 30 seconds per attempt | Up to 3 attempts, 1 then 2 seconds apart, only for failures that can clear by themselves: a connection error or a `5xx` (on read requests), or a `429`. A `401`, `403` or `404` is returned straight away. With an ArgoCD username/password, a `401` opens a new session and tries once more. |
| Kubernetes | client-go defaults | client-go's own behaviour. |

The server's own `writeTimeout` caps the whole request on top of these.
