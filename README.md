# blankcut-docs

**Meerkat docs**: public documentation for Meerkat by Blank Cut (the hosting
platform), the `blankcut` CLI that drives it, and Blank Cut's other public tools,
served at **[docs.blankcut.com](https://docs.blankcut.com)**.

Built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) and
deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
`main`.

## Structure

```
docs/
  index.md          # hub landing page
  cli/              # Meerkat CLI (`blankcut`) docs
  <tool>/           # one folder per additional tool (add a section in mkdocs.yml)
```

Each product/tool gets its own folder under `docs/` and a section in the `nav:`
block of `mkdocs.yml`.

## What belongs here

**Public, user-facing usage docs only.** Do **not** add platform internals:
architecture/topology, full API references, infrastructure identifiers (account
IDs, ARNs, bucket names), auth internals, or anything that would help an attacker.
Those live in the private repos. When in doubt, leave it out and ask.

Never include secret **values** in any page.

## Local development

```bash
pip install -r requirements.txt
mkdocs serve        # live preview at http://127.0.0.1:8000
mkdocs build --strict
```
