# AI spend

See what an app's calls to AI models cost: the total, per model and per day.

```bash
blankcut spend on --app my-app     # turn monitoring on for the app
blankcut promote --app my-app      # deploy, so the running app can report
blankcut spend --app my-app        # the last 30 days
```

The figures are **estimates**: the token counts the app reported for each call,
priced at the providers' list prices. They are not a bill from Blank Cut, and a
rate you negotiated with a provider is not known.

| Command | Effect |
|---|---|
| `blankcut spend --app <APP>` | The figures for the last 30 days. `--days` takes 1 to 90. |
| `blankcut spend status --app <APP>` | Whether monitoring is on, and how many of your included apps are monitored. |
| `blankcut spend on --app <APP>` | Turn monitoring on. Safe to repeat. |
| `blankcut spend off --app <APP>` | Turn it off. |

Every form takes `--json` for scripts. The same figures and the same switch are
on the app's page in the console.

---

## Three things, in order

An app has figures once all three are true:

1. **Monitoring is on for it.** `blankcut spend on --app <APP>`, or **Turn on**
   on the app's page. It needs your own sign-in (`blankcut login`); a
   repository's CI key cannot change it.
2. **The app has been deployed since**, with `blankcut promote --app <APP>` or
   from the console. That is what gives the running app what it reports with.
   A new commit alone does not apply it.
3. **The app's code reports its model calls.** Turning monitoring on does not
   add that; see [What the code must do](#what-the-code-must-do).

Until then `blankcut spend` answers zero, and zero cannot tell "no calls" from
"not reporting yet". `blankcut spend status` tells you about the first of the
three.

---

## Three apps are included

Every organization can monitor three apps at no charge. Turning it on for a
fourth is refused, and nothing changes: turn it off for another app first.

Turning monitoring off stops the app's figures being shown and frees its place.
The app stops reporting at its next deploy. Calls already recorded are kept,
and are shown again if you turn monitoring back on.

---

## What is collected

For each call the app makes to a model:

- the provider and the model,
- the token counts (input, output, and tokens read from or written to a cache),
- when the call started and ended, and whether it failed,
- an optional label naming the feature that made the call.

**Never a prompt or an answer**, and nothing else from the content of a call:
no tool arguments or results, no documents, no user or customer identifiers.

---

## What the code must do

After the deploy, the app's environment holds two variables:

| Variable | Use |
|---|---|
| `PITOT_OTLP_ENDPOINT` | The full address to send reports to. Use it exactly as given. |
| `PITOT_INGEST_TOKEN` | Sent with every report as `Authorization: Bearer <value>`. |

!!! danger "Never declare these yourself"
    Don't add either variable to `.env.example`, and don't set either with
    `blankcut secrets`. The platform supplies them. When either is absent (on
    your laptop, in tests, or with monitoring off) the code must do nothing at
    all: no report, no warning, no error.

The app sends one report per model call, after the call has finished: an
OpenTelemetry trace export over HTTP, in JSON, with one span per call that
carries the standard `gen_ai.*` attributes (operation, provider, model, and the
token counts).

The full description, with the exact request, an example body and the
per-provider rules for counting tokens, is the guide `blankcut sync` writes into
your repository:

```
.agents/skills/blankcut/references/ai-spend.md
```

It is written for a coding agent, so the quickest way to add reporting is to ask
yours to "make this app report its AI model calls". The rules it follows:

- **Build the report from the provider's response metadata only**: the model
  name, the usage numbers, the error class. No string in it may come from the
  request or from the answer.
- **Never break or slow the app.** Send after the call and off the request
  path, with a five-second timeout, and drop a report that fails. At most one
  retry.
- **Wrap the model client once**, where it is built, so every call site reports
  and a new one cannot forget.
- **Keep the feature label to a small fixed set of names** written in the code,
  such as `search` or `summary`. Never an id or anything taken from a request.

---

## Reading the figures

```
AI spend for my-app, the last 30 days (2026-10-19 to 2026-11-18, UTC)

  Estimated cost  $1.75
  Calls           16 (1 failed, 2 could not be priced)
  Tokens          6,089 input, 2,800 output, 0 read from cache, 0 written to cache
```

Then a table per model and a table per day. Days are UTC days, and a day with
no calls is not listed.

- **Could not be priced** means a call on a model with no list price on file, or
  a failed call that reported no token counts. Those calls are counted, and add
  nothing to the estimated cost, which does not mean they were free.
- **Failed** calls are the ones the provider answered with an error. They are
  included in the call count.
- A new call appears within a minute or two.

---

## When something is off

| What you see | What it means |
|---|---|
| Zero calls | Monitoring is on, and either the app made no calls or it is not reporting yet. Check that it was deployed with `blankcut promote` after monitoring was turned on, and that the call went through the wrapped client. |
| "not turned on for this app" | Run `blankcut spend on --app <APP>`. |
| "included for 3 apps ... already monitored" | Turn monitoring off for another app first. |
| "not available right now" | The figures could not be read. That is not zero: try again in a few minutes. |
| "not available for your organization yet" | Monitoring has not been opened to your organization. |
