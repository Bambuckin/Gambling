# Runtime Input Templates

Files in this folder are launch placeholders for LAN deployment.

## Files

- `hosts.template.json` - single place for IP/hostname map (server, DB, terminal, clients).
- `.env.web.template` - web-server environment template.
- `.env.worker.template` - terminal-worker environment template.

## Usage

1. Fill `hosts.template.json` with real IPs and hostnames.
2. Copy `.env.web.template` to web-machine `.env` and replace placeholders.
3. Copy `.env.worker.template` to terminal-machine `.env` and replace placeholders.
4. Run preflight before start:

```powershell
corepack pnpm runtime:preflight:web
corepack pnpm runtime:preflight:worker
```

If preflight fails, keep fixing placeholders and rerun.
