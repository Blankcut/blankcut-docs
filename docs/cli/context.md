# Read your environment

Code written against an assumed environment usually looks right and then fails in
production. `blankcut context` reports what your app **actually** runs in, so you
(or your coding agent) write against the real target.

```bash
blankcut context --app my-app
```

Run it before writing or changing code that touches infrastructure. `--app` is
optional inside a repository Meerkat knows; the app is worked out from the git
remote.

- **Nothing is cached.** Every run fetches live state or fails, and each
  response ends with a *Freshness* block saying how old each part is. There's no
  refresh step to forget.
- **Output is JSON automatically when stdout isn't a terminal.** Piped into a
  tool or an agent you get machine-readable data; in a terminal you get a
  readable table. `--json` forces JSON either way. Both carry the same facts.

Without a subcommand you get everything at once, which is the useful default
before writing code. A subcommand narrows the request, and Meerkat gathers only
what you asked for:

| Command | Reports |
|---|---|
| `blankcut context env` | Namespace, tier, CPU and memory requests and limits, each workload and how far it scales, and the hostnames the app serves |
| `blankcut context secrets` | How many keys are stored, how many reach the running app, and which are stored but not yet delivered |
| `blankcut context data` | Database engine and version, connection limit, and the tables and columns that exist, including which may hold personal data |
| `blankcut context storage` | Where the app keeps its files and what its code must do to reach them |
| `blankcut context image` | The image the app runs from, and whether the deploy pins it by digest |
| `blankcut context runtime` | Recent requests, error rate, p95 latency and restarts |
| `blankcut context routes` | Every route in the app, what guards it, and which tables it touches |
| `blankcut context conventions` | The patterns this repository actually uses, with the count behind each |

---

## What the answers mean

Four things are worth reading carefully, because none of them are visible from
inside your repository.

**The resource envelope is enforced, not advisory.** The memory limit is a hard
ceiling: exceed it and the container is killed, not slowed down. Size what you
build to the limit `context env` reports, not to what your laptop has.

**Connection limits are shared by every replica of every workload.**
`context data` reports the database's `max connections`, and `context env` lists
each workload and how far it scales. Your connection pool is multiplied by the
total. An API at two replicas plus two workers at two replicas each is **six**
processes opening connections, so a pool of 20 in each exhausts a 60-connection
database on its own. This is the most common way an app that's fine in testing
falls over under load.

**"Stored" and "reaching the app" are different numbers.** A secret can exist in
Meerkat's store and still not be delivered to the running app, because the
deployment receives a specific list of keys. If `context secrets` lists a key
under *not yet reaching the app*, reading it at runtime gives you nothing,
whatever the store holds. [Secrets](secrets.md#add-a-new-environment-variable)
explains how a new key gets wired in.

**`context data` lists the tables that actually exist,** with their columns and
types. Write queries against that, not against what your ORM models imply: the
two drift, and the database is the one that decides.

---

## Match the repository instead of inventing a pattern

```bash
blankcut context conventions --app my-app
blankcut context routes --app my-app
```

`conventions` reports how this repository does things: how its routes are
guarded, how it reaches its database, whether environment variables are read
with a fallback. Each comes with a count, derived from the code at the current
commit, so it can't be out of date. Read the counts: *176 of 284* is the house
style and new code should follow it; *3 of 20* is one corner of the repo and
proves nothing. Adding a second way to do something that already has one is how
a codebase turns into two codebases.

`routes` lists every route, what guards it, and what it touches. Read it before
adding a route, so the new one is guarded like its neighbours. The terminal
shows a sample; `--json` gives the full list.

!!! note "`guard not determined` means exactly that"
    Routes are traced from the code without resolving types across files, so a
    guard applied indirectly can't always be followed to the route it protects.
    A route reported as `guard not determined` is one the tool couldn't follow.
    It is **not** a route shown to be unauthenticated, so don't treat it as a
    finding or bolt a second check onto it. Open the file if you need to know.

    Both commands also say how many files were read and how many couldn't be
    parsed, because *no unguarded routes found* and *found no routes* look the
    same otherwise.

---

## When a section is unavailable

Unavailable isn't the same as absent, and the reason tells them apart. *"No
managed database is attached to this app"* means there's no database. *"The
database schema for this app is not available yet"* means there is one that
can't be described right now. Don't conclude the app has no storage and write
around it.

---

## When something is broken

```bash
blankcut status --app my-app
blankcut diagnose --app my-app
```

`status` gives you the raw facts: the latest build, the deploy's sync and health
state, pod counts and recent warnings. `diagnose` reads those facts and names
the likely cause, so you get a reason instead of symptoms to interpret. It
reports nothing to diagnose when the app is healthy or hasn't been deployed.
