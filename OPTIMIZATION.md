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

## Should (light alongside, deep polish later)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 1 | Cache management | Todo | — | Start light; deepen after modules stabilize |
| 6 | Debounce search/filters | Done | PatientsPage | 350ms debounce |
| 7 | Image/file optimization | In Progress | DocumentController | 5MB type whitelist; compress later |
| 11 | Code splitting | Done | Vite build chunks | Login/Dashboard/Module/Patient lazy chunks |
| 12 | Default pagination page size | Done | patients API/UI | default 20, max 50 |

## Later (not required now)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Auth/permission efficiency | Later | Optimize when role checks get heavy |
| 10 | Background jobs / queues | Later | PDF, email, heavy exports |

## Summary

- Must remaining: 0
- Should remaining: 2
- Later: 2
- Last updated: 2026-11-11 (security polish: audit + timeout)
