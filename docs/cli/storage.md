# File storage

Give an app somewhere to keep files: images, video, uploads, anything too big or
too binary for a database row. Storage is opt-in on every tier and billed per
gigabyte stored, so an app that never asks for it gets nothing and pays nothing.

```bash
blankcut storage add --app my-app      # provision it
blankcut context storage --app my-app  # wait for "ready"
blankcut promote --app my-app          # deploy, so the running app receives it
```

| Command | Effect |
|---|---|
| `blankcut storage add --app <APP>` | Provision storage, or repair a half-finished provision. Safe to re-run. |
| `blankcut storage status --app <APP>` | Show usage against the app's limit. Usage is measured on a schedule, so a file uploaded in the last few minutes may not be counted yet. |
| `blankcut storage rm --app <APP> --yes` | Delete every file the app has stored, permanently. |
| `blankcut context storage --app <APP>` | Show where the files live and what the code must do to reach them. |

---

## Two waits, in order

`storage add` returns before the app can use storage:

1. **Setting up the app's access takes a minute or two.** `blankcut context
   storage` says `provisioning` until it's done and `ready` after.
2. **Then deploy.** The running app receives the storage settings only on its
   next `blankcut promote`. Deploy before `context storage` says `ready`, and
   the app comes up without storage.

If it stays `provisioning`, run `blankcut storage add --app <APP>` again. It
re-checks every piece rather than allocating a second lot, so it's safe whenever
the state looks wrong.

---

## How your code reaches it

It's ordinary Amazon S3, reached with **the app's own identity**. You don't need
a new client library or a Meerkat-specific API. What you must not do is give the
client credentials.

!!! danger "No access keys, and adding some breaks it"
    The deployed app carries an identity that can reach its own files and
    nothing else, and every major AWS SDK finds it automatically. But the SDKs
    check explicit and environment credentials **first**: an
    `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` left in the app's settings or
    secrets wins, the app's identity is never used, and every call fails.
    Create the client with no credential arguments, and remove any AWS keys the
    app used to carry.

After the next deploy, the app receives:

| Variable | Meaning |
|---|---|
| `STORAGE_BUCKET` | The bucket to address. |
| `STORAGE_PREFIX` | Your app's key prefix, **with a trailing slash** (for example `myapp/`). |
| `STORAGE_PUBLIC_BASE_URL` | The public address for public files, when one is configured. Treat it as optional. |

Read the bucket and prefix from the environment instead of hardcoding them; both
change if the app is renamed or moved. `AWS_REGION` is deliberately not among
them, so keep your own default in config.

**Every key must start with `STORAGE_PREFIX`.** The app's access covers that
prefix and nothing else, so a key outside it is refused. Two areas sit under it:

- **`public/`**: served from a stable public URL, for anything meant to be seen.
- **`private/`**: reachable only through a time-limited link your app generates.

=== "Python"

    ```python
    import os, boto3

    # No credentials. Region from your own config.
    s3 = boto3.client("s3", region_name=settings.aws_region)

    bucket = os.environ["STORAGE_BUCKET"]
    prefix = os.environ["STORAGE_PREFIX"]          # "myapp/"

    key = f"{prefix}private/uploads/{filename}"    # not f"uploads/{filename}"
    s3.put_object(Bucket=bucket, Key=key, Body=data)
    ```

=== "TypeScript"

    ```ts
    import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

    // No credentials. Region from your own config.
    const s3 = new S3Client({ region: config.awsRegion });

    const bucket = process.env.STORAGE_BUCKET!;
    const prefix = process.env.STORAGE_PREFIX!;    // "myapp/"

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}public/avatars/${userId}.png`, // not `avatars/${userId}.png`
      Body: data,
    }));
    ```

The same two rules hold in every language: no explicit credentials, and always
prefix the key. Only the client construction differs.

---

## Deleting storage

`blankcut storage rm --app <APP> --yes` deletes the app's files, removes its
access, and stops its public URLs resolving. Other apps are unaffected. It
requires `--yes` because none of it can be recovered.
