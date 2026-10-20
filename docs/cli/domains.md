# Domains

Every app gets a platform address (`<app>.blankcut.app`) the moment it deploys.
To serve it on your own name you can **buy** a domain, **connect** one you
already own, or **transfer** one in from another registrar. Everything here
works the same in the Meerkat console (**Domains** in the sidebar) and from the
terminal with `blankcut domains`.

What it costs:

- **Registration, transfer and renewal are charged at cost** — exactly what our
  registrar (Amazon Route 53) charges, with no markup. A `.com` is $16.00 a
  year; `blankcut domains search <name>` shows the price for any name.
- Every domain on your account, however it got there, is **$2.99 a month**,
  which covers DNS hosting and the certificate we issue and renew for it.
- Buying or starting a transfer **charges your card on file straight away**.
  If the registration or transfer then fails, the charge is refunded in full.
  Registrations themselves are non-refundable, so check the name before you buy.

Only an **owner** of your organization can buy or transfer in a domain or change
its renewal, because those charge the card or change who controls the name.
Moving a domain *out* to another registrar is done in the Meerkat console by a
signed-in owner. Any member can connect a domain, point it at an app and edit
its DNS.

---

## Buy a domain

```bash
blankcut domains search vinehoa          # availability, price, alternatives
blankcut domains contact set \
  --first-name Jay --last-name Doe --email jay@example.com --phone "+1.3525551234" \
  --address "1 Main St" --city Ocala --state FL --postal-code 34470 --country US
blankcut domains buy vinehoa.com --app vine-frontend
```

The registrant contact is the legal owner of the domain; it is saved once per
organization and reused. Privacy protection is always on, so these details are
hidden from public WHOIS. `--organization` makes the contact a company.

`buy` looks up the price and asks you to confirm before your card is charged.
The domain renews yearly unless you pass `--no-auto-renew`. With `--app`, the
`www.` name is served too and redirects to the bare domain; `--no-www` turns
that off.

Registration usually completes in 5 to 15 minutes. Then:

1. **Verify the owner's email.** ICANN requires the registry to confirm the
   registrant's email address. Look for an email from the registrar and click
   the link **within 15 days**, or the registry suspends the domain.
   `blankcut domains verify-email <domain>` resends it.
2. **If you chose an app**, the domain is connected to it automatically: we
   issue the certificate, route the domain to the app and point its DNS, and
   email you when it's live.

---

## Connect a domain you already own

Keep your domain where it is and point it at an app:

```bash
blankcut domains attach shop.example.com --app my-app
blankcut domains status shop.example.com    # the DNS records to add
```

Add the records `status` lists at your DNS provider: a **validation** record
(proves you own the domain so the certificate can be issued) and a **routing**
record (sends visitors to your app). Hosts are shown in full; if your provider
appends your domain automatically, enter only the part before it.

A bare domain (`example.com`) can't be a CNAME. If your provider supports
ALIAS, ANAME or CNAME flattening, point the bare domain at us that way;
otherwise forward it to `www`. Simpler still: [transfer it in](#transfer-a-domain-in)
and we handle all of it.

---

## Transfer a domain in

Moving a domain to Blank Cut puts its registration, DNS and certificate in one
place and lets us connect it to your apps without you touching DNS again. The
transfer adds a year to the registration and costs the same as a year's
renewal.

The console walks you through every step at **Domains → Transfer a domain**;
the same steps from the terminal are below.

### 1. Check it can move

```bash
blankcut domains transfer check example.com
```

This shows the current registrar, whether the domain is locked, and anything
that blocks a transfer. The usual blockers:

- **The 60-day rule.** No registrar can transfer a domain within 60 days of
  registering or transferring it, or (at most registrars) of a change to the
  owner's details.
- **The transfer lock** is on (step 3 turns it off).
- **DNSSEC** is on — turn it off at the current registrar first.

### 2. Move your DNS first

GoDaddy and Squarespace **stop serving DNS for a domain the moment it transfers
away** — your website and your email would go dark. So before the transfer,
copy your DNS to Blank Cut and switch the domain to our nameservers:

```bash
blankcut domains transfer dns example.com
# or include a zone file exported from your current provider:
blankcut domains transfer dns example.com --zone-file example.com.txt
```

We read your current records — website, email (MX, SPF, DKIM, DMARC) and the
usual subdomains — and copy them into a zone we host. A record with a name we
can't guess (for example a site-verification record) won't be found
automatically: compare the list with your current DNS settings, or export a
zone file (GoDaddy: **DNS → Export Zone File**) and include it. Running the
command again is harmless; it only adds or updates records.

Then set the four nameservers it prints at your current registrar:

- **GoDaddy:** Domain Portfolio → your domain → **DNS** → **Nameservers** →
  **Change Nameservers** → **I'll use my own nameservers** → enter all four →
  **Save**.
- **Squarespace** (including former Google Domains): Domains dashboard → your
  domain → **DNS** → **Domain Nameservers** → **Use Custom Nameservers** →
  confirm (this turns DNSSEC off) → enter all four → **Save**. Squarespace's
  own DNS settings stop applying, which is why we copied them first.

!!! warning "At Squarespace, start a day ahead"
    - **DNSSEC** (on by default for former Google Domains): turn it off a day
      before switching — **DNS → DNSSEC → switch off DNS Security Extensions →
      Confirm**. Squarespace's nameserver switch also turns it off, but at the
      same moment, and resolvers that check signatures keep the old setting for
      up to a day: the site, and the domain's email, can fail for those visitors
      meanwhile.
    - **A website built on Squarespace** disconnects from the domain as soon as
      the nameservers change (email keeps working: its records were copied).
      Do step 3 first — turn off Domain Lock and request the transfer code,
      which can take up to 24 hours to arrive — and switch the nameservers once
      you have the code. Then start the transfer with `--app`: because Blank Cut
      already hosts the domain's DNS, it goes live on that app as soon as the
      transfer starts, not when Squarespace releases it.

Nameserver changes usually take effect within an hour and can take up to 48.
`blankcut domains transfer check` shows when the switch has gone through.

### 3. Unlock the domain and get the authorization code

- **GoDaddy:** Domain Portfolio → your domain → **Domain Settings** → turn off
  **Domain Lock** (and turn off Domain Privacy and Domain Protection if they're
  on). Then **Transfer to Another Registrar** → **Click here to see
  Authorization Code**.
- **Squarespace:** Domains dashboard → your domain → scroll down → switch
  **Domain Lock** off → **Request transfer code**. The code arrives by email
  from no-reply@squarespace.com, titled "Auth code for <your domain>", within 24
  hours.

### 4. Start the transfer

```bash
blankcut domains transfer start example.com --app my-app
```

You're prompted for the authorization code, which isn't echoed or stored. To
supply it without typing, set `BLANKCUT_DOMAIN_AUTH_CODE` in your shell first;
`--auth-code` also works but leaves the code in your shell history. The price is
shown and confirmed before your card is charged. Keep the owner's details the
same as at the current registrar — changing the owner during a transfer can
make it fail.

### 5. What happens next

- Route 53 may email the owner's address to confirm it — click the link.
- **GoDaddy** releases the domain within 5 to 7 days, or straight away if you
  approve it: Domain Portfolio → **Transfers** → **Transfers Out** → select the
  domain → **Approve Transfer**.
- **Squarespace** emails a notice and gives you 5 days to reject the transfer;
  if you do nothing it proceeds on its own. Transfers can take up to 15 days.

Email and any site not hosted by the old registrar keep working throughout,
because DNS already moved in step 2. If you gave `--app` and DNS already points
at Blank Cut, the domain goes live on that app when the transfer starts. We
email you when the transfer completes.

If your website is built **on Squarespace** and should keep running there
instead, reconnect it in Squarespace after switching the nameservers
(**Domains → Use a Domain I Own → Connect domain → No, use DNS records**) and
add the records Squarespace lists with `blankcut domains records set` (or in the
console's DNS records for the domain).

---

## Point a domain at a different app, or none

```bash
blankcut domains attach example.com --app another-app   # re-point
blankcut domains detach example.com                     # serve nothing, keep the domain
```

---

## DNS records

For domains whose DNS Blank Cut hosts (bought or transferred here, or moved in
step 2 above):

```bash
blankcut domains records example.com
blankcut domains records set example.com --type MX --name @ --ttl 3600 --value "1 smtp.google.com"
blankcut domains records rm example.com --type TXT --name _old-verification
```

Records the platform maintains — certificate validation, the records that point
your domain at its app, and the zone's own nameservers — are read-only.

---

## Cancel or move a domain away

- **Stop renewing it:** `blankcut domains auto-renew example.com off`. The
  domain stays yours until its expiry date and then lapses. We email you 30 days
  before any renewal or expiry either way.
- **Transfer it to another registrar:** in Meerkat, signed in as an owner:
  **Domains → the domain → Registration → Transfer out**. It unlocks the domain
  and shows the transfer (auth) code once; every owner is emailed that it was
  issued. Give the code to your new registrar. The domain keeps working until
  the transfer completes, and DNS hosted here keeps answering until you change
  the nameservers. This isn't available from the CLI — a transfer code is all
  another registrar needs to take a domain, so it is never handed to a terminal,
  a script or a coding agent (`blankcut domains release` only points you here).
