# Convex-first tracker

## Completed
- [x] Task board moved to Convex reactive reads/writes.
- [x] Team agents domain persisted in Convex (`teamMembers`) with migration seed from legacy hardcoded list.
- [x] Team page rewired to Convex for both team roster and task-derived capacity metrics.
- [x] Team spawn API now resolves member role from Convex (legacy fallback retained).

## Next slices
- [ ] Agent assignments domain: explicit assignment entities + reactive joins.
- [ ] Calendar views: remove any local/manual source-of-truth drift.
- [ ] Cron views: Convex-backed schedules as single source of truth.
- [ ] Add admin UI to edit/create team members in Convex.
