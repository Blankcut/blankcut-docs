# Quick start

This guide runs the server on your own machine, against the cluster your
kubeconfig already points at, and walks through the first few calls. It takes
about five minutes. ArgoCD and GitLab are left out; you can add them later in
[Configuration](configuration.md).

You need:

- macOS or Linux. There is no Windows binary; on Windows use the
  [Docker image](installation.md#docker) instead.
- A working kubeconfig: `kubectl get namespaces` should succeed.
- A Claude API key.
- `curl`, and `jq` to pretty-print responses (optional).

---

## 1. Download the binary

Release binaries are published for Linux and macOS on `amd64` and `arm64`.
This picks the right one and checks it against the published checksums:

```bash
VERSION=v1.3.0
OS=$(uname -s | tr '[:upper:]' '[:lower:]')          # linux or darwin
ARCH=$(uname -m)
[ "$ARCH" = x86_64 ] && ARCH=amd64
[ "$ARCH" = aarch64 ] && ARCH=arm64
BIN="mcp-server-$OS-$ARCH"

curl -fLO "https://github.com/Blankcut/kubernetes-mcp-server/releases/download/$VERSION/$BIN"
curl -fLO "https://github.com/Blankcut/kubernetes-mcp-server/releases/download/$VERSION/checksums.txt"
grep " $BIN\$" checksums.txt | shasum -a 256 -c -      # should print "OK"
chmod +x "$BIN"
```

---

## 2. Write a config file

Save this as `config.yaml` next to the binary:

```yaml
server:
  address: ":8080"
  readTimeout: 30
  writeTimeout: 300        # seconds; Claude-backed requests can take minutes
  auth:
    apiKey: "${API_KEY}"   # clients must send this key

kubernetes:
  inCluster: false         # use your kubeconfig ($KUBECONFIG or ~/.kube/config)

claude:
  apiKey: "${CLAUDE_API_KEY}"
  baseURL: "https://api.anthropic.com"
  modelID: "claude-sonnet-5"
  maxTokens: 8192
```

`${API_KEY}` and `${CLAUDE_API_KEY}` are filled in from the environment when the
server reads the file, so the keys never sit in the file itself.

---

## 3. Start the server

```bash
export API_KEY=$(openssl rand -hex 32)     # the key your API calls will send
export CLAUDE_API_KEY=sk-ant-...           # your Claude API key

./"$BIN" --config config.yaml
```

The server logs one JSON object per line. It's ready when you see
`"msg":"Starting HTTP server"`. A few `WARN` lines are normal on a setup like
this one: no secrets directory, Vault not configured, and no ArgoCD or GitLab
credentials.

Leave it running and open a second terminal. Export `API_KEY` there too, with
the same value.

---

## 4. Check health

The health endpoints don't need the API key:

```bash
curl -s http://localhost:8080/api/v1/health | jq
```

```json
{
  "status": "ok",
  "services": {
    "argocd": "unavailable",
    "claude": "assumed available",
    "gitlab": "unavailable",
    "kubernetes": "available"
  },
  "components": {
    "argocd": {
      "status": "unknown",
      "reachable": false,
      "authorized": null
    }
  }
}
```

`kubernetes: available` is the one that matters here. ArgoCD and GitLab show
`unavailable` because they aren't configured. The server never calls Claude for
a health check, so `claude` always reads `assumed available`.

---

## 5. Read from the cluster

Every other endpoint needs the key, in an `X-API-Key` header or as
`Authorization: Bearer <key>`:

```bash
curl -s -H "X-API-Key: $API_KEY" http://localhost:8080/api/v1/namespaces | jq
```

```json
{
  "namespaces": ["default", "kube-node-lease", "kube-public", "kube-system"]
}
```

---

## 6. Analyze a namespace

Start with the fast, findings-only version. `?narrative=false` skips Claude and
returns in seconds:

```bash
curl -s -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/namespaces/default/analysis?narrative=false" | jq
```

The response lists resource counts, health per kind, and `issues`: Warning
events, and CronJobs whose last run failed. Drop `?narrative=false` and the same
request also asks Claude for a written analysis, which takes longer (often tens
of seconds).

---

## 7. Ask Claude about a resource

Pick a Deployment that exists in your cluster:

```bash
curl -s -X POST http://localhost:8080/api/v1/mcp/resource \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "Deployment",
    "name": "my-app",
    "namespace": "default",
    "query": "Is this deployment healthy? If not, what should I check first?"
  }' | jq -r .analysis
```

Use the kind as Kubernetes spells it (`Deployment`, `Pod`). A lowercase kind
still finds the object, but the event lookup then matches nothing, so Claude
sees no events.

---

## Next steps

- Put the server in your cluster with the [Helm chart](installation.md#helm-chart).
- Add ArgoCD and GitLab in [Configuration](configuration.md).
- Learn what each endpoint returns in the [API reference](api-overview.md).
- Use the [troubleshooting guide](troubleshooting-resources.md) to dig into a failing workload.
