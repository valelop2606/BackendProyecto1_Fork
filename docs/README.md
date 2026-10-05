# Pipeline backend 1+29 — Resumen

Rama `backend` del fork. Modo `backend-pipeline-30`: forense → fixer → defensa por error. Sin push. Colección `postman/proyecto1-simple.postman_collection.json` con `baseUrl=http://localhost:3000`.

Error #01 cerrado (prefijo `api/v1` vs `/api` + `api/doc` vs `/api/docs`, con `git diff main..backend -- src/main.ts` + `curl` + Newman `auth`). No se repite.

Evidencia global: `GET /api/v1/health` → `200`; `GET /api/health` → `404`; Newman `--folder auth,users` → `404` sistemático por prefijo; `POST /api/v1/auth/login` con `Secret123!` → `400 minLength 12`; `npm run db:import` → `E11000 enrollments`.

| # | Informe | Título | Sev |
|---|---|---|---|
| 01 | `error-01-prefijo-api-v1-vs-coleccion.md` | Prefijo `api/v1` vs `/api` + `api/doc` vs `/api/docs` | P0 |
| 02 | `error-02-users-create-httpcode-400.md` | `POST /users` con `400` en éxito | P1 |
| 03 | `error-03-users-me-sombreado-por-id.md` | `/users/me` tras `:id` | P0 |
| 04 | `error-04-groups-mine-sombreado-por-id.md` | `/groups/mine` tras `:id` | P1 |
| 05 | `error-05-evaluations-controller-typo.md` | `evaluationslalala` | P0 |
| 06 | `error-06-evaluations-create-httpcode-400.md` | `POST` evaluaciones con `400` | P1 |
| 07 | `error-07-roles-guard-no-global.md` | `RolesGuard` no global | P0 |
| 08 | `error-08-curriculum-sin-roles.md` | `curriculum` sin `@Roles` | P1 |
| 09 | `error-09-programs-listado-sin-roles.md` | `programs` lectura abierta | P1 |
| 10 | `error-10-enrollments-mine-rol-docente.md` | `mine` pide docente | P1 |
| 11 | `error-11-jwt-expiresin-string.md` | `expiresIn "3600"` | P1 |
| 12 | `error-12-login-minlength-12-bloquea-admin.md` | Login 12 vs admin 10 | P0 |
| 13 | `error-13-update-user-dto-namesssss.md` | `namesssss` | P1 |
| 14 | `error-14-email-sin-normalizar.md` | Email sin `lowercase` | P1 |
| 15 | `error-15-change-password-sin-save.md` | Sin `save()` | P0 |
| 16 | `error-16-login-slowdown-5s.md` | Sleep 5s global | P1 |
| 17 | `error-17-main-sin-helmet-cors-throttle.md` | Sin perímetro | P1 |
| 18 | `error-18-jwt-secret-vacio.md` | `JWT_SECRET` vacío | P0 |
| 19 | `error-19-db-import-sin-transaccion.md` | Siembra parcial | P0 |
| 20 | `error-20-nota-max-4-5-vs-5-0.md` | `Max(4.5)` vs `5.0` | P2 |
| 21 | `error-21-reports-promise-all-fragil.md` | `Promise.all` tablero | P1 |
| 22 | `error-22-enrollments-cancel-notifica-fuera-tx.md` | Notify fuera de tx | P1 |
| 23 | `error-23-academic-god-service.md` | God Service | P2 |
| 24 | `error-24-deletions-if-else-vs-strategy.md` | Sin Strategy | P2 |
| 25 | `error-25-academic-n1-secuencial.md` | Awaits seriales | P2 |
| 26 | `error-26-deletions-tag-typo.md` | `deletions21312` | P2 |
| 27 | `error-27-notifications-delete-sin-roles.md` | DELETE sin frontera | P1 |
| 28 | `error-28-grades-upsert-put-sin-id.md` | `PUT` sin id | P2 |
| 29 | `error-29-classroom-mincapacity-nan.md` | `Number()` → `NaN` | P2 |
| 30 | `error-30-log-pii-admin-email.md` | Log con PII | P2 |

Detectados **30/30**. Cada informe trae Detección (forense), Solución (fixer) y Defensa con replicación `curl` + Newman.

Nota: `.gitignore` ignora `docs/`, por eso estos archivos existen en disco pero no aparecen en `git status`.
