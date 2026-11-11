# Security Tracker — Jadeed Rifah Rehab ERP

Status: `Todo` | `In Progress` | `Done` | `Later`  
Code/app security only (server hardening is separate).  
Update this file whenever a security item is implemented, partially applied, or deferred.

## Must (do alongside development)

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 1 | Auth on every protected API | Done | `routes/api.php` | `/me` `/logout` require Sanctum |
| 2 | RBAC / permission check per action | In Progress | roles.modules + DoctorController | Module gates include doctors/rounds |
| 3 | Backend input validation | Done | AuthController login | Validate email/password |
| 4 | SQL injection prevention (ORM/prepared) | Done | Eloquent queries | No raw unsafe SQL |
| 5 | XSS prevention | Done | React UI (no raw HTML inject) | No `dangerouslySetInnerHTML` |
| 6 | Password hashing | Done | User model cast + seeder | bcrypt hashed |
| 7 | Secrets only in `.env` | Done | backend `.env` | DB/app secrets not in code |
| 8 | Mass assignment protection | Done | User/Role fillable | Explicit fields only |
| 9 | Upload security (type/size whitelist) | Done | DocumentController | pdf/jpg/png/doc/xls max 5MB; archive not hard-delete |
| 10 | HTTPS + secure cookies/tokens | Later | — | Production deploy |
| 11 | Session timeout + login rate limit | Done | AuthContext + facility settings | Idle timeout enforced client-side; login throttle:10,1 |
| 12 | Careful token/sensitive storage on client | Done | localStorage token only | No clinical notes stored |
| 13 | Safe production errors | Done | `bootstrap/app.php` | API hides stack when `APP_DEBUG=false` |
| 14 | No hard-delete of sensitive records | In Progress | documents + account void | Archive docs; void ledger (no hard delete) |
| 15 | Audit log for important actions | Done | `Audit` + Settings page | login/logout, patient, admission, payment, void, archive, user, discharge, settings |

## Should

| # | Item | Status | Where applied | Notes |
|---|------|--------|---------------|-------|
| 16 | CSRF / API token hardening | Done | Sanctum API tokens | Bearer token API |
| 17 | Clinical vs finance data isolation | In Progress | role module sets | Seeded role menus |
| 18 | Export permission + export log | Todo | — | Sensitive downloads tracked |
| 19 | Dependency vulnerability checks | Todo | — | Periodic package review |

## Later

| # | Item | Status | Notes |
|---|------|--------|-------|
| 20 | MFA for Owner/Admin | Later | After core auth stable |
| 21 | Field-level encryption at rest (selected) | Later | Highest-sensitivity fields if needed |
| 22 | Suspicious login / anomaly alerts | Later | After monitoring basics exist |

## Summary

- Must remaining: 0 Todo (2 In Progress: RBAC polish, hard-delete coverage)
- Should remaining: 2
- Later: 3
- Last updated: 2026-11-11 (timeout + audit + safe errors)
