# Optimization Tracker — Jadeed Rifah Rehab ERP

Status: `Todo` | `In Progress` | `Done` | `Later`  
Update this file whenever optimization work is applied or skipped.

## Must (do alongside development)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 2 | Lazy loading (frontend) | Done | `frontend/src/App.jsx` | Route-level lazy + Suspense |
| 3 | Skeleton / shimmer loading | Done | Dashboard + patients pages | List/detail loading states |
| 4 | Database indexing | Done | patients + clinical + ops + audit_logs | audit action/module/created_at indexes |
| 5 | Slim API responses | Done | PatientController + ReportController | overview aggregates only needed KPIs |
| 8 | Avoid N+1 queries (Laravel eager load) | Done | Patient + DoctorRound index | doctor/patient/admission eager load |
| 13 | Inner scroll for growing lists | In Progress | Visitors + Staff + Patients + Inventory + Pharmacy + dashboard + Management cards | `.entity-card-grid` scroll + pagination (12/page) |
| 14 | Search on expandable lists | In Progress | Visitors + Staff + Patients + Inventory + Pharmacy + Management | Debounced search + role/status filter tabs |

## Should (light alongside, deep polish later)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 1 | Cache management | Todo | — | Start light; deepen after modules stabilize |
| 6 | Debounce search/filters | Done | PatientsPage | 350ms debounce; apply on all new searchable lists |
| 7 | Image/file optimization | In Progress | Inventory bill images | Type/size limited; deeper compression later |
| 11 | Code splitting | Done | Vite build chunks | Login/Dashboard/Module/Patient lazy chunks |
| 12 | Default pagination page size | Done | patients API/UI | default 20, max 50 |

## Later (not required now)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Auth/permission efficiency | Later | Optimize when role checks get heavy |
| 10 | Background jobs / queues | Later | PDF, email, heavy exports |

## Summary

- Must remaining: 0 Todo (2 In Progress: scroll + search rollout)
- Should remaining: 1 Todo + 1 In Progress (image/file)
- Later: 3
- Last updated: 2026-11-12 (pharmacy/inventory split + staff filters + bill upload)
