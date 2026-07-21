# Security response and repository hygiene

This repository must never contain production credentials, personal exports,
local databases, screenshots, agent/tool output, or audit logs.

## Immediate credential response

Code changes cannot revoke a credential that has already been published. An
operator with access to Neon and the deployment platform must complete these
steps before relying on the repository again:

1. Create new, separate database roles for the application, migrations, and
   read-only audits. Give each role only the permissions it needs.
2. Replace the production deployment secret with the new application
   connection string, deploy, and run a read-only smoke test.
3. Revoke the exposed credential and verify that it can no longer connect.
4. Review database access logs and data changes from the first exposed commit
   through the revocation time.
5. Store operational secrets only in the deployment secret manager or ignored
   local environment files. Never paste them into source, issues, logs, or CLI
   arguments.

## Purging sensitive Git history

Make a protected backup and coordinate a maintenance window before rewriting
history. The safe audit script should be copied aside, because the historical
path containing the credential must be removed and then re-added from the safe
working tree.

Example path-removal plan using `git filter-repo`:

```bash
cp scripts/db-audit.py /tmp/tvtime-db-audit.py.safe

git filter-repo --force --invert-paths \
  --path scripts/db-audit.py \
  --path scripts/export-test.json \
  --path scripts/db-audit-results.log \
  --path scripts/live-audit-results.log \
  --path scripts/remove-hardcoded-tmdb-key.py \
  --path tool-results \
  --path upload \
  --path db/custom.db

mkdir -p scripts
cp /tmp/tvtime-db-audit.py.safe scripts/db-audit.py
git add scripts/db-audit.py
git commit -m "security: restore read-only database audit"
```

After review, force-push every rewritten branch and tag, expire cached artifacts
where the hosting provider allows it, and require collaborators to re-clone.
Run the repository hygiene check and the hosting provider's secret scanner on
all branches and pull requests.

## Local and CI checks

Run this before pushing:

```bash
npm run verify:repo-hygiene
```

The check reports file paths and violation types only. It does not print any
matched secret value.
