# TvTime repair patch plan

The audit findings are split into reviewable patches so security and data-risk
changes land before functional or visual work.

| Patch | Scope | Status |
|---|---|---|
| 01 | Remove embedded database credential; enforce a separate read-only audit role; add incident runbook | Implemented in this delivery |
| 02 | Remove personal/local artifacts; strengthen ignore/cleanup rules; add repository hygiene CI | Implemented in this delivery |
| 03 | Fail-closed production authentication and safe login redirect | Implemented in this delivery |
| 04 | JWT-derived request identity, admin mutation hardening, and authorization tests | Implemented in this delivery |
| 05 | Schema baseline, forward migrations, and deployment guards | Implemented in this delivery |
| 06 | Large backup/export plus staged, validated import | Implemented in this delivery |
| 07 | TV metadata cache/state correctness and atomic episode mutations | Implemented in this delivery |
| 08 | Lists and Discover contract/semantics fixes | Planned |
| 09 | Data lifecycle, preferences, navigation, RTL, and accessibility | Planned |
| 10 | Performance budgets, CI consolidation, documentation, and dead-code cleanup | Planned |

Patches 01 and 02 clean the current working tree, but an operator still must
rotate the exposed credential and purge sensitive objects from the remote Git
history as described in `SECURITY.md`.
