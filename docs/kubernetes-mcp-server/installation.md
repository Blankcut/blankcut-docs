# Installation

There are four ways to run the server. All of them run the same program and read
the same [config file](configuration.md).

| Method | Use it when |
|---|---|
| [Helm chart](#helm-chart) | You want the server inside the cluster it inspects, shared by a team or by other services. |
| [Docker image](#docker) | You run containers locally or on a host outside the cluster. |
| [Release binary](#release-binary) | You want the fewest moving parts on a Linux or macOS machine. The [Quick start](quick-start.md) uses this. |
| [Build from source](#build-from-source) | You're changing the code. |

Wherever it runs, the server needs network access to the Kubernetes API, to the
Claude API (`https://api.anthropic.com` by default), and to ArgoCD and GitLab if
you configure them. It listens on plain HTTP.

---

## Helm chart

The chart lives in the repository at `helm/kubernetes-mcp-server`. It isn't
published to a Helm repository, so install it from a checkout of the release
tag:

```bash
git clone https://github.com/Blankcut/kubernetes-mcp-server.git
cd kubernetes-mcp-server
git checkout v1.3.0
```

### 1. Write a values file

Save this as `my-values.yaml` and adjust the ArgoCD and GitLab URLs:

```yaml
image:
  tag: "1.3.0"            # pin the release; see "Chart defaults to change" below

config:
  server:
    writeTimeout: 300     # seconds; Claude-backed requests can take minutes
  argocd:
    url: "https://argocd.example.com"   # "" turns ArgoCD off
  gitlab:
    url: ""                             # e.g. "https://gitlab.com"; "" turns GitLab off
  claude:
    modelID: "claude-sonnet-5"
    temperature: 0        # 0 means "don't send it"; Claude Sonnet 5 rejects any explicit value

rbac:
  rules:
    - apiGroups: [""]
      resources: ["pods", "services", "endpoints", "namespaces", "events", "configmaps", "persistentvolumeclaims"]
      verbs: ["get", "list", "watch"]
    - apiGroups: [""]
      resources: ["pods/log"]          # lets namespace analysis read a failed CronJob run's log
      verbs: ["get"]
    - apiGroups: ["apps"]
      resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
      verbs: ["get", "list", "watch"]
    - apiGroups: ["batch"]
      resources: ["jobs", "cronjobs"]
      verbs: ["get", "list", "watch"]
    - apiGroups: ["networking.k8s.io"]
      resources: ["ingresses", "networkpolicies"]
      verbs: ["get", "list", "watch"]
    - apiGroups: ["argoproj.io"]
      resources: ["applications", "appprojects"]
      verbs: ["get", "list", "watch"]
```

The `rbac.rules` list replaces the chart's default list. Compared with the
default it adds `pods/log` and `persistentvolumeclaims`, and leaves out
`secrets`. Without `pods/log`, a failing CronJob is still reported but its log
is replaced by a "could not read the run's log" note. Without
`persistentvolumeclaims`, troubleshooting a Pod that mounts a volume reports
"PVC Not Found" for a claim that exists. Secrets are left out on purpose: the
API returns whatever the service account can read.

### 2. Supply the secrets

The chart creates a Secret from four values: `secrets.apiKey` (the key clients
send), `secrets.claudeApiKey`, `secrets.argocdToken` and `secrets.gitlabToken`.
Pass them at install time:

```bash
helm install kubernetes-mcp-server ./helm/kubernetes-mcp-server \
  --namespace mcp-system --create-namespace \
  -f my-values.yaml \
  --set secrets.apiKey="$API_KEY" \
  --set secrets.claudeApiKey="$CLAUDE_API_KEY" \
  --set secrets.argocdToken="$ARGOCD_TOKEN"
```

To manage the Secret yourself instead, create it first and add
`--set secrets.create=false`. It must be named after the release (here
`kubernetes-mcp-server`) and must contain all four keys, even the ones you
don't use; the Pod won't start with a key missing.

```bash
kubectl -n mcp-system create secret generic kubernetes-mcp-server \
  --from-literal=api-key="$API_KEY" \
  --from-literal=claude-api-key="$CLAUDE_API_KEY" \
  --from-literal=argocd-token="$ARGOCD_TOKEN" \
  --from-literal=gitlab-token=""
```

With the chart, ArgoCD authenticates with a token only. If `config.argocd.url`
is set and the token is empty, the server refuses to start.

### 3. Check it's running

```bash
kubectl -n mcp-system rollout status deployment/kubernetes-mcp-server
kubectl -n mcp-system port-forward svc/kubernetes-mcp-server 8080:8080
```

In another terminal:

```bash
curl -s http://localhost:8080/api/v1/health | jq
```

If the Pod restarts instead, read its log:
`kubectl -n mcp-system logs deployment/kubernetes-mcp-server`. A configuration
problem is the last line, as `"msg":"Invalid configuration"` with the reason.
See [Troubleshooting](troubleshooting-resources.md#the-server-wont-start).

### Chart defaults to change

| Default | Why to change it |
|---|---|
| `image.tag: ""` | An empty tag falls back to the chart's `appVersion`, which is `1.0.3`, an older image without the CronJob checks, the ArgoCD authorization probe or Workload Identity Federation. Set `image.tag: "1.3.0"`. |
| `config.gitlab.url: "https://gitlab.com"` | With a GitLab URL and no `secrets.gitlabToken`, the server refuses to start. Set a token, or set the URL to `""`. |
| `config.claude.temperature: 0.3` | Fine for the chart's default model, `claude-sonnet-4-6`. If you switch to `claude-sonnet-5`, set it to `0` so it isn't sent. |
| `config.server.writeTimeout: 60` | A namespace analysis or a Claude question can take longer than 60 seconds. When it does, the connection closes with no response. `300` covers every endpoint. |
| `rbac.rules` | Grants read on Secrets cluster-wide and lacks `pods/log`. See the values file above. |

### Chart values

| Value | Default | What it does |
|---|---|---|
| `image.repository` | `blankcut/kubernetes-mcp-server` | Image to run. |
| `image.tag` | `""` (chart `appVersion`, `1.0.3`) | Image tag. |
| `image.pullPolicy` | `IfNotPresent` | Pull policy. |
| `replicaCount` | `1` | Replicas when autoscaling is off. Replicas share nothing, so you can run several. |
| `config.server.*` | `address: ":8080"`, `readTimeout: 30`, `writeTimeout: 60` | Rendered into the config file. |
| `config.kubernetes.*` | `inCluster: true` | Rendered into the config file. Keep `inCluster: true` in a Pod. |
| `config.argocd.url`, `config.argocd.insecure` | `""`, `false` | Rendered into the config file. The token comes from the Secret. |
| `config.gitlab.url`, `config.gitlab.apiVersion` | `https://gitlab.com`, `v4` | Rendered into the config file. The token comes from the Secret. |
| `config.claude.baseURL`, `modelID`, `maxTokens`, `temperature` | `https://api.anthropic.com`, `claude-sonnet-4-6`, `8192`, `0.3` | Rendered into the config file. The API key comes from the Secret. |
| `secrets.create` | `true` | Create the Secret from the four `secrets.*` values. |
| `secrets.apiKey`, `claudeApiKey`, `argocdToken`, `gitlabToken` | `""` | Secret values, exposed to the server as `API_KEY`, `CLAUDE_API_KEY`, `ARGOCD_TOKEN` and `GITLAB_TOKEN`. |
| `rbac.create` | `true` | Create the role and binding. |
| `rbac.clusterRole` | `true` | `true`: a ClusterRole, so the server reads every namespace. `false`: a Role in the release namespace only, and listing namespaces then fails. |
| `rbac.rules` | read on core, apps, batch, networking and ArgoCD resources, including Secrets | The role's rules. Setting it replaces the whole list. |
| `serviceAccount.create`, `name`, `annotations` | `true`, `""`, `{}` | The service account the Pod runs as. |
| `service.type`, `service.port` | `ClusterIP`, `8080` | The Service in front of the Pod. |
| `ingress.enabled`, `className`, `hosts`, `tls`, `annotations` | `false` | Optional Ingress. The server speaks plain HTTP, so terminate TLS here. |
| `autoscaling.enabled`, `minReplicas`, `maxReplicas`, `targetCPUUtilizationPercentage`, `targetMemoryUtilizationPercentage` | `false`, `1`, `10`, `80`, `80` | Optional HorizontalPodAutoscaler. |
| `resources` | requests `250m`/`256Mi`, limits `500m`/`512Mi` | Container resources. |
| `livenessProbe`, `readinessProbe` | `/api/v1/health/live`, `/api/v1/health/ready` | Probes. See [health endpoints](api-overview.md#health). |
| `podSecurityContext`, `securityContext` | non-root (UID 1000), read-only root filesystem, all capabilities dropped | Pod and container security settings. `/tmp` is a writable `emptyDir`. |
| `nodeSelector`, `tolerations`, `affinity`, `podAnnotations`, `imagePullSecrets`, `nameOverride`, `fullnameOverride` | empty | Standard scheduling and naming values. |

The chart doesn't expose the `claude.federation` settings, a way to add
environment variables or volumes, or server flags such as `--log-level`. To use
[Workload Identity Federation](configuration.md#workload-identity-federation)
with it, you need to add the token volume and variables yourself, for example
with a Helm post-renderer.

### Without Helm in the cluster

If you deploy plain manifests, render the chart and apply the result:

```bash
helm template kubernetes-mcp-server ./helm/kubernetes-mcp-server \
  --namespace mcp-system -f my-values.yaml \
  --set secrets.create=false > kubernetes-mcp-server.yaml
kubectl apply -n mcp-system -f kubernetes-mcp-server.yaml
```

With `secrets.create=false`, the Secret stays out of the rendered file, so no
credential ends up in it. Create the Secret as shown in step 2.

---

## Docker

Images are on Docker Hub as `blankcut/kubernetes-mcp-server`, for `linux/amd64`
and `linux/arm64`. Each release is tagged with its full version (`1.3.0`), its
minor and major versions (`1.3`, `1`), `latest`, and `sha-<commit>`. Pin the
full version.

The image runs as a non-root user (UID 1001), listens on port 8080, and reads
its config from `/app/config.yaml`. It doesn't contain a config file, so mount
one. With the config from the [Quick start](quick-start.md#2-write-a-config-file):

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY -e CLAUDE_API_KEY \
  -e KUBECONFIG=/kube/config \
  -v "$HOME/.kube/config:/kube/config:ro" \
  -v "$PWD/config.yaml:/app/config.yaml:ro" \
  blankcut/kubernetes-mcp-server:1.3.0
```

`-e API_KEY -e CLAUDE_API_KEY` copy those variables from your shell, and the
`${API_KEY}`/`${CLAUDE_API_KEY}` references in the config pick them up.

Things that trip up a kubeconfig inside a container:

- **File permissions (Linux).** A kubeconfig with mode `600` isn't readable by
  UID 1001. Add `--user "$(id -u):$(id -g)"`.
- **Local clusters.** kind, minikube and Docker Desktop write an API address
  on `127.0.0.1`, which inside the container is the container itself. On Linux
  add `--network host`; otherwise run the [release binary](#release-binary).
- **Credential plugins.** The image includes the AWS CLI, so EKS kubeconfigs
  that run `aws eks get-token` work once you mount your AWS config
  (`-v "$HOME/.aws:/home/mcp/.aws:ro" -e AWS_PROFILE`). Other plugins, such as
  `gke-gcloud-auth-plugin` or `kubelogin`, aren't in the image.

To pass a flag, give the full command after the image name:

```bash
docker run ... blankcut/kubernetes-mcp-server:1.3.0 \
  ./mcp-server --config /app/config.yaml --log-level debug
```

The repository also has `kubernetes-claude-mcp/docker-compose.yml`, which
builds the image from source and mounts `~/.kube/config`, `./config.yaml` and
`~/.aws`. It doesn't pass any API keys into the container, so add them under
`environment:` or write them into `config.yaml`.

---

## Release binary

Each [GitHub release](https://github.com/Blankcut/kubernetes-mcp-server/releases)
has four binaries and a checksum file:

| Asset | Platform |
|---|---|
| `mcp-server-linux-amd64` | Linux, x86-64 |
| `mcp-server-linux-arm64` | Linux, ARM64 |
| `mcp-server-darwin-amd64` | macOS, Intel |
| `mcp-server-darwin-arm64` | macOS, Apple silicon |
| `checksums.txt` | SHA-256 of each binary |

The [Quick start](quick-start.md#1-download-the-binary) shows how to download
and verify the right one. Run it with:

```bash
./mcp-server-darwin-arm64 --config config.yaml
```

Running the binary directly uses your kubeconfig and any credential plugins
installed on the machine, which avoids the container issues above.

---

## Build from source

You need Go 1.26 or later.

```bash
git clone https://github.com/Blankcut/kubernetes-mcp-server.git
cd kubernetes-mcp-server/kubernetes-claude-mcp
go build -o mcp-server ./cmd/server
./mcp-server --config config.yaml
```

To build the image instead, run `docker build -t kubernetes-mcp-server .` in
the same directory.

---

## Security considerations

- **Use a strong API key.** Every endpoint except health requires it; with no
  key configured, those endpoints refuse every request. Use a long random value
  (`openssl rand -hex 32`). There's one key, shared by every client; to rotate
  it, change it and restart the server.
- **Terminate TLS in front of it.** The server only speaks HTTP. Keep it on a
  `ClusterIP` Service and reach it with `kubectl port-forward`, or put it behind
  an Ingress or load balancer that terminates TLS.
- **Call it from a backend, not a web page.** Responses carry
  `Access-Control-Allow-Origin: *`, but browsers can't call the API from
  another origin anyway (see [Authentication](api-overview.md#authentication)),
  and a key embedded in a page is a published key.
- **The API returns what the service account can read.** If the role can read
  Secrets, `GET /api/v1/resources/secret` returns their data. Grant only what
  you want served.
- **Claude sees what the server collects.** Claude-backed requests send the
  resource's full JSON, its events, ArgoCD and GitLab metadata, and failed
  CronJob log lines to the Claude API. Don't point them at Secrets, and keep
  this in mind for logs that might contain sensitive data.
- **Use read-only upstream credentials.** No endpoint writes to ArgoCD or
  GitLab, so a read-only ArgoCD account (for example `role:readonly`) and a
  GitLab token with the `read_api` scope are enough.
- **`argocd.insecure: true` skips TLS verification** for ArgoCD. Use it only
  for a test instance.
