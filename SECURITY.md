# Security Tracker — Jadeed Rifah Rehab ERP

Status: `Todo` | `In Progress` | `Done` | `Later`  
Code/app security only (server hardening is separate).  
Update this file whenever a security item is implemented, partially applied, or deferred.

## Must (do alongside development)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 1 | Auth on every protected API | Todo | — | No anonymous access to protected routes |
| 2 | RBAC / permission check per action | Todo | — | View/Add/Edit/Approve/etc. |
| 3 | Backend input validation | Todo | — | Never trust frontend-only checks |
| 4 | SQL injection prevention (ORM/prepared) | Todo | — | No raw unsafe queries |
| 5 | XSS prevention | Todo | — | Escape/sanitize user-driven HTML |
| 6 | Password hashing | Todo | — | Never store plain text passwords |
| 7 | Secrets only in `.env` | Todo | — | No keys/tokens in frontend/code |
| 8 | Mass assignment protection | Todo | — | Explicit fillable/request fields |
| 9 | Upload security (type/size whitelist) | Todo | — | Block executables |
| 10 | HTTPS + secure cookies/tokens | Todo | — | Production secure transport |
| 11 | Session timeout + login rate limit | Todo | — | Brute-force resistance |
| 12 | Careful token/sensitive storage on client | Todo | — | No medical notes in open localStorage |
| 13 | Safe production errors | Todo | — | Hide stack traces/DB details |
| 14 | No hard-delete of sensitive records | Todo | — | Archive/void + reason |
| 15 | Audit log for important actions | Todo | — | Who/when/what |

## Should

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 16 | CSRF / API token hardening | Todo | — | As applicable to stack |
| 17 | Clinical vs finance data isolation | Todo | — | Role-based module isolation |
| 18 | Export permission + export log | Todo | — | Sensitive downloads tracked |
| 19 | Dependency vulnerability checks | Todo | — | Periodic package review |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| 20 | MFA for Owner/Admin | Later | After core auth stable |
| 21 | Field-level encryption at rest (selected) | Later | Highest-sensitivity fields if needed |
| 22 | Suspicious login / anomaly alerts | Later | After monitoring basics exist |

## Summary

- Must remaining: 15
- Should remaining: 4
- Later: 3
- Last updated: 2026-11-11 (initial)
