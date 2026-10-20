# Scheduled jobs

Recurring work (a nightly digest, a periodic refresh, a price check) runs as a
**scheduled call to an endpoint your app already serves**. You write the
endpoint; Meerkat calls it on the schedule you set.

```bash
blankcut schedule add price-check --app my-app \
  --cron "0 */6 * * *" --path /api/cron/price-check
blankcut schedule list --app my-app
blankcut schedule rm price-check --app my-app
```

The call goes over the cluster's internal network, so the endpoint **doesn't
have to be public**.

---

## Before you add one: authenticate the endpoint

Every scheduled call carries the app's own `BLANKCUT_CRON_SECRET`:

```http
Authorization: Bearer <BLANKCUT_CRON_SECRET>
```

Set that secret up like any other ([Secrets](secrets.md#add-a-new-environment-variable)):
declare `BLANKCUT_CRON_SECRET=` in `.env.example`, merge it, then
`blankcut secrets set --app <APP> BLANKCUT_CRON_SECRET <value>`. Have your
handler reject any request that doesn't carry it; otherwise anything that can
reach the endpoint can trigger the work.

```ts
// app/api/cron/price-check/route.ts
export async function POST(req: Request) {
  const secret = process.env.BLANKCUT_CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  await refreshPrices();
  return Response.json({ ok: true });
}
```

`schedule add` refuses to create a job for an app that has no
`BLANKCUT_CRON_SECRET`, instead of deploying one that fails on every run.

---

## `schedule add`

```bash
blankcut schedule add <name> --app <APP> --cron "<expression>" --path <endpoint>
```

| Flag | Effect |
|---|---|
| `--cron` | When to run, as a five-field cron expression, for example `"0 */6 * * *"`. Required. |
| `--path` | The app endpoint to call, for example `/api/cron/price-check`. Required. |
| `--method` | The HTTP method. Defaults to `POST`. |
| `--timeout` | Seconds to allow the call before giving up. Defaults to `120`. |

---

## Limits

- **No more often than every 5 minutes.** An expression that fires more often is
  refused, as is cron syntax Meerkat can't evaluate (`@hourly`, named weekdays, a
  seconds field).
- **Each app has a maximum number of jobs.** `blankcut schedule list` prints the
  limit next to what's in use. Ask the Blank Cut team if you need more.
- **A change takes a minute or two.** Meerkat checks the change and then deploys
  it, so a new job first runs shortly after you add it, and a removed one may
  run once more. If a check doesn't pass, the change waits for a Blank Cut
  engineer, and `schedule list` shows it as pending review.

`schedule list` reports what's **deployed**. A job you've just added appears as
pending until its change has gone through.

---

## What it isn't

This isn't a general job runner. It can't run a script, a different image or a
one-off task, and it can only call your app. Work that doesn't fit that shape
belongs in the app itself: a queue, a worker process, or a request handler.
