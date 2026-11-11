# Optimization Tracker — Jadeed Rifah Rehab ERP

Status: `Todo` | `In Progress` | `Done` | `Later`  
Update this file whenever optimization work is applied or skipped.

## Must (do alongside development)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 2 | Lazy loading (frontend) | Todo | — | Route/module-level code load on demand |
| 3 | Skeleton / shimmer loading | Todo | — | Lists, detail pages, dashboards |
| 4 | Database indexing | Todo | — | FKs, search, filter, status columns |
| 5 | Slim API responses | Todo | — | Only required fields; no over-fetch |
| 8 | Avoid N+1 queries (Laravel eager load) | Todo | — | Relations loaded intentionally |

## Should (light alongside, deep polish later)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 1 | Cache management | Todo | — | Start light; deepen after modules stabilize |
| 6 | Debounce search/filters | Todo | — | Avoid API call per keystroke |
| 7 | Image/file optimization | Todo | — | Compress + upload size limits (local storage) |
| 11 | Code splitting | Todo | — | Large React bundles by module |
| 12 | Default pagination page size | Todo | — | e.g. 10/20/50 on all list APIs/UI |

## Later (not required now)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Auth/permission efficiency | Later | Optimize when role checks get heavy |
| 10 | Background jobs / queues | Later | PDF, email, heavy exports |

## Summary

- Must remaining: 5
- Should remaining: 5
- Later: 2
- Last updated: 2026-11-11 (initial)
