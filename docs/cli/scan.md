# Image scanning

Every image Meerkat builds is scanned for known vulnerabilities **before it's
pushed**, and the images that are running are re-scanned on a schedule against
the latest vulnerability data. Only findings **with a published fix** are
reported, so every one is something you can act on.

You see the results in two places: your build log, and `blankcut scan`.

---

## In the build log

The build job prints a summary and one line per finding, and writes the same
list to the run summary on the GitHub Actions page:

```text
Image scan: recorded - 0 critical, 3 high, 7 medium
HIGH <package> <installed> -> <fixed> (<CVE>)
```

| Verdict | Meaning |
|---|---|
| `recorded` | The image was scanned and pushed. The findings are listed for you to fix. |
| `blocked` | The image was built but **not pushed**, so that commit can't deploy. What's running is an older image. The run fails with *image scan blocked the push*. |
| `error` | The image wasn't checked. Treat that as unknown rather than clean, and re-run the build. |

---

## `blankcut scan`

```bash
blankcut scan               # in a repo Meerkat knows
blankcut scan --app my-app
```

It reports two views:

- **Last build:** the scan of the most recent build, including one the scan
  blocked from being pushed.
- **Running now:** the scheduled re-scan of the images actually serving traffic.
  A finding here that isn't in the last build is a vulnerability published since
  the image was built; a rebuild picks up its fix (for an OS package, only if
  your `Dockerfile` refreshes them on every build, as in the tip below).

Findings are grouped by the package upgrade that fixes them, and each package
names **one version to upgrade to**: the lowest fix on the release line you're
already on that clears every finding in that package. They're split into **OS
packages** and **app dependencies**, because you fix them differently.

The report starts with the app's **policy**:

- **block:** a build is built but not pushed when it **adds** an unwaived
  CRITICAL/HIGH finding, or when a finding that was already in the running app
  is **past its fix-by date**. A finding the running app already had doesn't
  stop the next build before its date.
- **record:** findings are reported and nothing is blocked. Fixing them by
  their dates means nothing changes for you if blocking is switched on later.

### Fix-by dates

Each open CRITICAL/HIGH finding gets a **fix-by date three days after the
platform first sees it**, whether a build found it or the daily re-scan of the
running app did, for example when a vulnerability is published against a
package you already ship. `blankcut scan` prints it next to each package, as
`fix by Oct 31`, or `OVERDUE since Oct 29` once it has passed.

By the date, upgrade the package, or [request a waiver](#when-a-finding-cant-be-fixed-yet)
if it can't be fixed yet. A waived finding has no fix-by date; its waiver's
expiry is the date that matters.

Output is JSON when stdout isn't a terminal (or with `--json`), with every
finding's `id`, `pkg`, `installed` and `fixed` version, `severity`, the `target`
it was found in, and its `class`. Open findings also carry `firstSeen` and
`deadline`.

---

## Fixing findings

Work most-severe first.

1. **OS packages** (`"class": "os-pkgs"`). Move the `Dockerfile`'s `FROM` to a
   newer patch of the same base image, or upgrade the package in the
   `Dockerfile` (`apk upgrade --no-cache <pkg>`,
   `apt-get install --only-upgrade <pkg>`). One base-image move usually clears
   most of them.
2. **App dependencies** (`"class": "lang-pkgs"`). Move the package to the
   `fixed` version in the lockfile named by `target`, then run your tests. In
   order of preference:
    - **Refresh the lockfile** when the fix is inside the range you already
      declare: `npm update <pkg>`, `poetry update <pkg>`.
    - **Raise the declared range** when it caps you below the fix. A caret on a
      `0.0.x` version is the usual trap: `^0.0.6` means `>=0.0.6 <0.0.7`, so a
      fix in `0.0.18` is out of reach until you widen it.
    - **Add an override** (`overrides` in `package.json`, or your package
      manager's equivalent) only for a transitive dependency whose parent pins
      it below the fix and has no newer release. Check the parent still works,
      since an override forces a version it never declared.
3. **Push.** The next build is scanned again, and `blankcut scan` shows the new
   result.

!!! tip "Patch the base image in the Dockerfile"
    Most of what a scanner finds in a fresh app image is stale OS packages in
    the base image and the package manager's own dependencies, none of which you
    wrote. The `Dockerfile` that `blankcut init` scaffolds (v0.16.0 and later)
    runs `apk upgrade` in its final stage and removes `npm` once it's no longer
    needed. If your build reports OS-package findings you didn't introduce,
    compare your `Dockerfile` with a fresh `blankcut init` in a scratch
    directory.

    Since v0.23.5 the scaffolded `Dockerfile` also has this line just before
    its `apk upgrade`:

    ```dockerfile
    ADD https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/aarch64/APKINDEX.tar.gz /tmp/apkindex.tar.gz
    ```

    The build cache reuses a step whose text hasn't changed. Without that line,
    `apk upgrade` runs on your first build and every later build reuses its
    result, so fixes Alpine publishes afterwards never reach your image. With
    it, the step runs again whenever Alpine publishes. If an Alpine finding
    with a published `fixed` version survives a rebuild, add the line before
    your own `apk upgrade`.

    Since v0.23.7 a scaffolded static site installs its file server, `serve`,
    with `compression` 1.8.2. `serve` itself pins 1.8.1, which has a HIGH
    finding, and a global `npm install -g serve@14` can't change that pin. If
    your scan lists `compression 1.8.1` and your `Dockerfile` has
    `npm install -g serve@14`, replace that install with these lines:

    ```dockerfile
    RUN mkdir -p /opt/serve \
     && printf '%s\n' '{"private": true, "dependencies": {"serve": "^14.2.6"}, "overrides": {"compression": "^1.8.2"}}' > /opt/serve/package.json \
     && npm install --prefix /opt/serve --omit=dev --no-audit --no-fund --loglevel=error \
     && ln -s /opt/serve/node_modules/.bin/serve /usr/local/bin/serve
    ```

---

## When a finding can't be fixed yet

Sometimes no release of the package fixes it, or the fixed release breaks your
app. Don't work around the scan: ask the Blank Cut team to waive **that one
finding**, and say why.

```bash
blankcut scan waive --vuln CVE-2026-78669 --pkg stdlib \
  --reason "No release of the upstream tool is built on a fixed Go version yet."
blankcut scan waivers     # this app's waivers and where each stands
```

- `--vuln` and `--pkg` must name the finding exactly as `blankcut scan --json`
  reports it (`id` and `pkg`), and the finding must be in the app's current
  scan. Otherwise the request is refused.
- `--reason` is what the reviewer decides on (at least 20 characters). Name the
  release you need and why it isn't available, or what broke when you upgraded.
  *"The build is blocked"* isn't a reason; upgrading the package is the fix.
- A request changes nothing until the team approves it, and they're notified
  when you file it. Approvals usually expire, so the finding comes back for
  another look.

`blankcut scan waivers` lists the app's waivers: pending, approved, expired,
rejected and revoked.

To ask the Blank Cut team for help fixing findings, open the app's **Security**
panel in [Meerkat](https://meerkat.blankcut.com).
