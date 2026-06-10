# Deploying corpus to Vercel

The corpus is a zero-dependency Node service. On Vercel it runs as one
serverless function (`api/index.js`) that forwards every request into the
existing server; `vercel.json` routes all paths to it and bundles the baked
`src/content.json`. No build step beyond `node build.js` (the bundle is
committed), no env vars required at runtime.

## One-time: store the token in the macOS Keychain

The deploy reads its token from the Keychain — never hardcode it.

```sh
# create a token at https://vercel.com/account/tokens, then:
security add-generic-password -a "$USER" -s vercel-deploy-token -w '<TOKEN>'
```

## Deploy

```sh
./deploy.sh            # preview deploy
./deploy.sh --prod     # production deploy
```

`deploy.sh` pulls the token from the Keychain (`vercel-deploy-token`) and runs
`vercel` with `--token`, so nothing secret touches the shell history or the repo.

## Verify (end-to-end)

After deploy, the script prints the URL. An agent reads it exactly as locally:

```sh
curl -s https://<deployment>/llms.txt          # discovery manifest
curl -s https://<deployment>/corpus/kingdom-overview.md   # one document
curl -s "https://<deployment>/search?q=signed+word"       # ranked search
curl -s https://<deployment>/ | jq .service                # descriptor
```

## Exposure note

A Vercel deployment is **public on the internet** by default. The corpus is
designed as a published, read-only artifact (no secrets; loopback-only in dev).
Confirm the content is meant to be world-readable before the first `--prod`.
