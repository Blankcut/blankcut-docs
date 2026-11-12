# Connect Claude and other AI apps

Blank Cut has a connector for AI apps. Add it once and you can ask Claude, from the
web, the desktop app or your phone, things like *"is my site up?"*, *"why did last
night's deploy fail?"* or *"which secrets does `my-app` have set?"*, with no CLI to
install. The same connector works in Claude Code and in any other AI app that
supports remote MCP servers with sign-in, such as Cursor and Codex.

The connector's address is:

```text
https://agent.blankcut.com/mcp
```

It complements the CLI rather than replacing it. Work inside a repository
(`init`, `validate`, `sync`) and setting secret values still happen in a terminal
or in the console.

---

## Add it

=== "Claude (web, desktop, mobile)"

    1. On claude.ai or in the desktop app, open **Customize → Connectors**,
       choose **Add**, then **Add custom connector**.
    2. Name it `Blank Cut`, paste `https://agent.blankcut.com/mcp` as the URL
       and choose **Continue**. Keep the sign-in settings Claude marks
       **Detected**, then choose **Add**.
    3. Choose **Connect**. A Blank Cut sign-in page opens; sign in, pick the
       organization, and approve.

    Once added, the connector works in the mobile apps too. Custom connectors
    work on every Claude plan; the Free plan allows one.

    On a Team or Enterprise plan, an Owner adds it once for the whole
    organization, under **Organization settings → Connectors → Add → Custom →
    Web**. Each member then finds it under **Customize → Connectors** and
    chooses **Connect** to sign in with their own Blank Cut account.

=== "Claude Code"

    ```bash
    claude mcp add --transport http blankcut https://agent.blankcut.com/mcp
    ```

    Then start Claude Code, type `/mcp`, pick `blankcut` and sign in. The browser
    opens the same Blank Cut sign-in page.

=== "Other AI apps"

    Any app that supports remote MCP servers over HTTP with OAuth sign-in can
    connect: give it `https://agent.blankcut.com/mcp` as the server URL and sign in
    when it asks.

If you don't have a Blank Cut account yet, the sign-in page lets you create one
and brings you back to the approval. Finish in the browser the sign-in page
opened in: if you sign in with an emailed link, open the link in that same
browser, or the approval page will ask you to start again.

---

## What you allow

The approval page asks two things:

- **Which organization.** The connection acts for that one organization only, as
  you. It can see the organization's apps and nothing else.
- **Whether it may deploy.** Every connection can read: app status, diagnoses,
  the environment, secret *names*, scheduled jobs and vulnerability findings.
  Tick **Also let it deploy apps and connect new repositories** to let it start deploys and
  connect new repositories as well. Leave it unticked for a read-only
  connection; you can reconnect later to change it.

A connection belongs to the person who approved it. If you leave the
organization, it stops working.

---

## What it can do

| Tool | What it does | Needs deploy |
|---|---|---|
| `list_apps` | The organization's apps, their repositories and tiers | |
| `get_app_status` | Latest build, rollout, running pods and warnings, scheduled jobs, latest scan | |
| `diagnose_app` | Why an app is unhealthy, in plain language | |
| `get_app_context` | The environment the app runs in: variables (names), data services, limits, URLs | |
| `list_secret_names` | Which secrets are set (names only) and where to set values | |
| `list_schedules` | The app's scheduled jobs | |
| `get_scan_findings` | Vulnerability findings and the versions that fix them | |
| `get_job_status` | Follow a deploy or onboarding the connector started | |
| `deploy_app` | Deploy the app's current `main` | Yes |
| `onboard_repo` | Connect a GitHub repository and open its setup pull request | Yes |

Claude asks you before it deploys or onboards anything. You don't need a deploy
for ordinary code changes: a new commit on `main` builds and rolls out on its own.

---

## What it won't do

- **Secret values.** The connector never reads or accepts a secret's value, so a
  value never ends up in a chat. Set values on the app's page in the
  [console](https://meerkat.blankcut.com), or with `blankcut secrets push` from
  the repository. See [Secrets](secrets.md).
- **Anything irreversible.** No teardown, no deleting storage, no exporting a
  database or code, no buying domains. Those stay in the CLI and the console.
- **Sign-up steps.** Creating an account, adding a card and installing the Blank
  Cut GitHub App happen in the browser. When one is missing, the connector says
  so and links to the console.

---

## Disconnect

Remove the connector in your AI app's settings, or end the connection from the
Blank Cut console, under **CLI setup → Connected AI apps**. Either way, it stops
working at once.
