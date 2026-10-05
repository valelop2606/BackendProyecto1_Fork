# Registro de bugs — Backend Gestión Académica

Documento del examen grupal donde se registra cada bug encontrado en el backend (NestJS + MongoDB). Cada bug incluye pasos para reproducirlo, resultado esperado y actual, evidencia, causa raíz, corrección aplicada y verificación.

## Entorno de pruebas

| Elemento | Valor |
|---|---|
| Sistema operativo | Windows 11 Home 10.0.26200 |
| Node.js | v24.15.0 |
| Docker | 29.8.1 |
| MongoDB | imagen `mongo:7`, replica set `rs0` de un solo nodo |
| Commit base | `edd8a7d` (rama `main`) |
| Frontend asociado | `frontendCertiParcial1/proyectoFrontend1` (Next.js, `http://localhost:3001`) |

## Índice de bugs

| ID | Título | Severidad | Prioridad | Estado |
|---|---|---|---|---|
| [BUG-001](#bug-001--el-backend-no-levanta-siguiendo-los-pasos-del-readme) | El backend no levanta siguiendo los pasos del README | Crítica (bloqueante) | Alta | Corregido |
| [BUG-002](#bug-002--el-login-rechaza-la-contraseña-documentada) | El login rechaza la contraseña documentada (`@MinLength(12)`) | Crítica | Alta | Corregido |
| [BUG-003](#bug-003--la-api-no-responde-en-api-sino-en-apiv1) | La API no responde en `/api` sino en `/api/v1` (frontend roto) | Crítica | Alta | Corregido |
| [BUG-004](#bug-004--swagger-no-está-en-apidocs) | Swagger no está en `/api/docs` | Baja | Baja | Corregido |
| [BUG-005](#bug-005--evaluaciones-publicadas-en-evaluationslalala) | Evaluaciones publicadas en `/evaluationslalala` | Alta | Alta | Corregido |
| [BUG-006](#bug-006--usersme-y-groupsmine-responden-400-id-invalido) | `/users/me` y `/groups/mine` responden 400 "ID invalido" | Media | Media | Corregido |
| [BUG-007](#bug-007--las-restricciones-por-rol-no-se-aplican) | Las restricciones por rol no se aplican | Crítica | Alta | Corregido |
| [BUG-008](#bug-008--matricular-responde-400-aunque-la-matrícula-se-crea) | Matricular responde 400 aunque la matrícula se crea | Crítica | Alta | Corregido |
| [BUG-009](#bug-009--cancelar-una-matrícula-no-libera-el-cupo) | Cancelar una matrícula no libera el cupo | Alta | Alta | Corregido |
| [BUG-010](#bug-010--un-docente-puede-gestionar-grupos-ajenos) | Un docente puede gestionar grupos ajenos | Alta | Alta | Corregido |
| [BUG-011](#bug-011--una-nota-final-de-300-queda-reprobada) | Una nota final de 3.00 queda reprobada | Alta | Alta | Corregido |
| [BUG-012](#bug-012--el-cambio-de-contraseña-no-se-guarda) | El cambio de contraseña no se guarda | Alta | Alta | Corregido |
| [BUG-013](#bug-013--marcar-una-notificación-como-leída-no-cambia-read) | Marcar una notificación como leída no cambia `read` | Media | Media | Corregido |
| [BUG-014](#bug-014--no-se-aceptan-notas-mayores-a-45) | No se aceptan notas mayores a 4.5 | Alta | Alta | Corregido |
| [BUG-015](#bug-015--el-periodo-en-curso-no-se-reconoce-como-abierto) | El periodo en curso no se reconoce como abierto | Crítica | Alta | Corregido |
| [BUG-016](#bug-016--matrícula-duplicada-y-falta-el-índice-único) | Matrícula duplicada y falta el índice único | Alta | Alta | Corregido |
| [BUG-017](#bug-017--npm-run-dbimport-aborta-por-un-código-de-programa-duplicado) | `npm run db:import` aborta por código de programa duplicado | Alta | Alta | Corregido |
| [BUG-018](#bug-018--notas-inválidas-en-la-semilla) | Notas inválidas en la semilla (5.7 y `"4,2"`) | Media | Media | Corregido |
| [BUG-019](#bug-019--referencias-cruzadas-inconsistentes) | Referencias cruzadas inconsistentes | Media | Media | Corregido |
| [BUG-020](#bug-020--plan-de-evaluación-que-suma-110-) | Plan de evaluación que suma 110 % | Media | Media | Corregido |
| [BUG-021](#bug-021--referencias-huérfanas-programa-del-estudiante-y-decano) | Referencias huérfanas (programa, decano) | Media | Media | Corregido |
| [BUG-022](#bug-022--valores-fuera-de-enum-o-sin-normalizar) | Valores fuera de enum o sin normalizar | Media | Media | Corregido |
| [BUG-023](#bug-023--dos-grupos-usan-el-mismo-salón-a-la-misma-hora) | Dos grupos en el mismo salón a la misma hora | Media | Media | Corregido |
| [BUG-024](#bug-024--franja-horaria-que-termina-antes-de-empezar) | Franja horaria que termina antes de empezar | Baja | Baja | Corregido |
| [BUG-025](#bug-025--mat101-es-prerrequisito-de-sí-misma) | MAT101 es prerrequisito de sí misma | Alta | Alta | Corregido |
| [BUG-026](#bug-026--contador-enrolled-por-encima-del-cupo-en-la-semilla) | Contador `enrolled` por encima del cupo en la semilla | Alta | Alta | Corregido |
| [BUG-027](#bug-027--matrícula-activa-en-periodo-cerrado-y-con-nota-final) | Matrícula activa en periodo cerrado y con nota final | Baja | Baja | Corregido |
| [BUG-028](#bug-028--las-cuentas-de-prueba-del-readme-no-sirven) | Las cuentas de prueba del README no sirven | Media | Media | Corregido |
| [BUG-029](#bug-029--crear-un-usuario-responde-400-aunque-tiene-éxito) | Crear un usuario responde 400 aunque tiene éxito | Media | Media | Pendiente |

### Criterios de severidad

- **Crítica (bloqueante):** impide usar o levantar el sistema.
- **Alta:** una funcionalidad principal falla y no hay alternativa.
- **Media:** una funcionalidad falla, pero hay alternativa o el impacto es parcial.
- **Baja:** cosmético, de documentación o con impacto mínimo.

---

## BUG-001 — El backend no levanta siguiendo los pasos del README

| Campo | Valor |
|---|---|
| **ID** | BUG-001 |
| **Fecha** | 2026-10-05 |
| **Componente** | Arranque de la aplicación (configuración, módulo `reports`, `main.ts`) |
| **Severidad** | Crítica (bloqueante) |
| **Prioridad** | Alta |
| **Tipo** | Configuración / inyección de dependencias |
| **Estado** | Corregido |

### Descripción

Si se siguen los pasos de "Cómo correrlo" del `README.md`, la API no queda disponible en `http://localhost:3000`. Hay **tres defectos independientes**. Cada uno impide por sí solo que el backend arranque o que quede en el puerto documentado. Se resolvieron en orden; al corregir uno aparecía el siguiente.

| Sub-ID | Defecto | Archivo |
|---|---|---|
| BUG-001-A | El `MONGODB_URI` de ejemplo apunta al puerto `27018`, pero MongoDB se expone en `27017` | `.env.example:2` |
| BUG-001-B | `ReportsService` no está registrado como provider en `ReportsModule` | `src/reports/reports.module.ts:14` y `:32` |
| BUG-001-C | La API lee `APP_PORT` (que no existe) y por defecto usa `3001`, que es el puerto del frontend | `src/main.ts:28` |

### Precondiciones

- Docker Desktop corriendo.
- Dependencias instaladas (`npm install`).
- Para BUG-001-C: frontend (`proyectoFrontend1`) corriendo en el puerto `3001`, como indica el README.

### Pasos para reproducir

1. `cp .env.example .env`
2. Asignar un valor de al menos 16 caracteres a `JWT_SECRET` en `.env`. Lo exige `src/config/env.validation.ts`; el ejemplo lo trae vacío a propósito.
3. `npm run db:up`
4. `npm run start`

### Resultado esperado

Según el `README.md`, la API arranca y responde en `http://localhost:3000/api`:

```
Nest application successfully started
```

### Resultado actual

La aplicación no arranca. El error depende de cuál de los defectos se encuentre primero.

---

### BUG-001-A — Puerto de MongoDB incorrecto en `.env.example`

**Resultado actual:** Mongoose no logra conectarse y reintenta sin parar. La aplicación nunca termina de iniciar.

**Evidencia:**

```
ERROR [MongooseModule] Unable to connect to the database. Retrying (1)...
MongooseServerSelectionError: connect ECONNREFUSED ::1:27018, connect ECONNREFUSED 127.0.0.1:27018
```

**Causa raíz:** `docker-compose.yml` publica MongoDB en el puerto `27017` (`"27017:27017"` y `--port 27017`), pero `.env.example` define la conexión hacia `27018`:

```env
# .env.example (línea 2) — ANTES
MONGODB_URI=mongodb://localhost:27018/universidad?replicaSet=rs0&directConnection=true
```

Como el README indica copiar `.env.example` a `.env`, todos los que sigan las instrucciones heredan la URI incorrecta.

**Corrección:**

```diff
- MONGODB_URI=mongodb://localhost:27018/universidad?replicaSet=rs0&directConnection=true
+ MONGODB_URI=mongodb://localhost:27017/universidad?replicaSet=rs0&directConnection=true
```

---

### BUG-001-B — `ReportsService` no registrado en `ReportsModule`

**Resultado actual:** con la base ya conectada, Nest aborta el arranque al resolver dependencias.

**Evidencia:**

```
ERROR [ExceptionHandler] UnknownDependenciesException [Error]: Nest can't resolve dependencies
of the ReportsController (?). Please make sure that the argument ReportsService at index [0]
is available in the ReportsModule module.
```

**Causa raíz:** `ReportsController` recibe `ReportsService` por constructor. Pero en `src/reports/reports.module.ts` están **comentados** tanto el `import` como la declaración en `providers`, así que el contenedor de inyección de Nest no puede crear el controlador:

```ts
// src/reports/reports.module.ts — ANTES
// import { ReportsService } from './reports.service';          // línea 14
...
  controllers: [ReportsController],
  // providers: [ReportsService],                               // línea 32
```

**Corrección:**

```diff
- // import { ReportsService } from './reports.service';
+ import { ReportsService } from './reports.service';
  ...
    controllers: [ReportsController],
-   // providers: [ReportsService],
+   providers: [ReportsService],
```

---

### BUG-001-C — La API usa una variable de puerto equivocada y choca con el frontend

**Resultado actual:** la aplicación inicializa todos sus módulos, pero falla al abrir el puerto porque el `3001` ya lo ocupa el frontend Next.js.

**Evidencia:**

```
LOG   [NestApplication] Nest application successfully started
ERROR [NestApplication] Error: listen EADDRINUSE: address already in use :::3001
```

Sin el frontend corriendo, la API sí levanta, pero en `http://localhost:3001` y no en el `3000` que documenta el README. Además ocupa el puerto que el frontend necesita.

**Causa raíz:** `src/main.ts` lee la variable `APP_PORT`, que no existe en `.env.example` ni en `src/config/env.validation.ts`. Por eso siempre cae al valor por defecto `3001`. La variable que sí está definida y validada (`PORT=3000`) se ignora:

```ts
// src/main.ts (línea 28) — ANTES
const port = Number(process.env.APP_PORT ?? 3001);
```

| Fuente | Puerto de la API |
|---|---|
| `README.md` | `3000` |
| `.env.example` (`PORT`) | `3000` |
| `env.validation.ts` (`PORT`, valor por defecto) | `3000` |
| `src/main.ts` (`APP_PORT ?? 3001`) | `3001` ❌ |

**Corrección:**

```diff
- const port = Number(process.env.APP_PORT ?? 3001);
+ const port = Number(process.env.PORT ?? 3000);
```

---

### Verificación después de la corrección

Se regeneró `.env` desde el `.env.example` corregido y se arrancó con `npm run start`, sin variables forzadas:

```
LOG [RoutesResolver] ReportsController {/api/v1/reports}
LOG [NestApplication] Nest application successfully started
```

```
$ netstat -ano | findstr :3000
TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING

$ curl http://localhost:3000/api/v1/health
{"status":"ok","database":"up","timestamp":"2026-10-05T16:47:00.261Z"}

$ curl -o /dev/null -w "%{http_code}" http://localhost:3000/api/doc
200
```

El backend arranca, se conecta a MongoDB y escucha en el puerto `3000`, sin conflicto con el frontend en `3001`.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `.env.example` | Puerto de MongoDB `27018` → `27017` |
| `src/reports/reports.module.ts` | Se descomentan el `import` y el `providers` de `ReportsService` |
| `src/main.ts` | `APP_PORT ?? 3001` → `PORT ?? 3000` |

### Fuera del alcance de BUG-001

Esta corrección solo dejó el backend levantado. Los otros problemas vistos durante el arranque están documentados más abajo: prefijo `/api/v1` (BUG-003), Swagger (BUG-004), `DERE` duplicado (BUG-017) y login de 12 caracteres (BUG-002).

---

## Cómo se encontraron y verificaron BUG-002 a BUG-029

- **Herramientas:**
  - Auditoría de código y base con la skill `mongoexpert`, usando el MCP de MongoDB solo en lectura.
  - Pruebas funcionales manuales de la API con la skill `qa-bdd`: una petición a la vez, comparada a mano contra el contrato (README, Swagger, esquemas y frontend).
- **Informes detallados** (en `.claude/skills/`):
  - `mongoexpert/audits/AUD-001_2026-10-05.md`: auditoría.
  - `qa-bdd/reports/QA-PHASE1_2026-10-05.md`: diagnóstico QA, con 24 casos en `qa-bdd/test-cases/` y 22 bugs en `qa-bdd/bug-reports/`.
  - `mongoexpert/reports/UNIFIED-001_2026-10-05.md`: diagnóstico unificado.
  - `mongoexpert/reports/FIX-001_2026-10-05.md`: correcciones y su verificación.
- **Entorno:** el mismo de BUG-001. Desde BUG-003, la URL base es `http://localhost:3000/api`; antes de la corrección era `/api/v1`.
- **Datos:** los bugs de datos (BUG-015 a BUG-028) se corrigieron en `database/*.json`. Para tenerlos en una base local hay que ejecutar `npm run db:import` y reiniciar la API.

Formato de cada bug: **Reproducir → Esperado → Actual → Causa → Corrección → Verificación.** Los IDs entre paréntesis (por ejemplo, QA BUG-001 o MX-01) remiten a los informes de las skills.

---

## BUG-002 — El login rechaza la contraseña documentada

**Severidad:** Crítica · **Componente:** autenticación · **Ref.:** QA BUG-001

- **Reproducir:** `POST /api/v1/auth/login` con `{"email":"admin@universidad.edu","password":"Secret123!"}`.
- **Esperado:** 200/201 con `accessToken`. Según el README, todas las cuentas de prueba usan `Secret123!`.
- **Actual:** `400 ["password must be longer than or equal to 12 characters"]`. Ningún usuario puede iniciar sesión.
- **Causa:** `src/auth/dto/login.dto.ts:12` tiene `@MinLength(12)`; la política de clave (`ChangePasswordDto`) es de 8 y la semilla usa 10 caracteres.
- **Corrección:** `@MinLength(12)` → `@MinLength(8)`.
- **Verificación:** el login del admin y de `laura.lopez89@universidad.edu` con `Secret123!` → **200**.

## BUG-003 — La API no responde en `/api` sino en `/api/v1`

**Severidad:** Crítica · **Componente:** `main.ts` / integración con el frontend · **Ref.:** QA BUG-002

- **Reproducir:** `POST http://localhost:3000/api/auth/login`.
- **Esperado:** que la ruta exista. El README publica la API en `http://localhost:3000/api`, y el frontend (`proyectoFrontend1/src/lib/server.ts`) llama a `${BACKEND_URL}/api/<ruta>`.
- **Actual:** `404 Cannot POST /api/auth/login`. El frontend recibe 404 en todas sus llamadas.
- **Causa:** `src/main.ts:10` `app.setGlobalPrefix('api/v1')`.
- **Corrección:** `setGlobalPrefix('api')`.
- **Verificación:** `POST /api/auth/login` → 200; en el arranque, Nest mapea `/api/...`.

## BUG-004 — Swagger no está en `/api/docs`

**Severidad:** Baja · **Ref.:** QA BUG-003

- **Reproducir:** `GET http://localhost:3000/api/docs`.
- **Esperado:** Swagger UI (README: *Documentación Swagger http://localhost:3000/api/docs*).
- **Actual:** 404 (estaba en `/api/doc`).
- **Causa:** `src/main.ts:26` `SwaggerModule.setup('api/doc', …)`.
- **Corrección:** `'api/docs'`.
- **Verificación:** `GET /api/docs` → **200**.

## BUG-005 — Evaluaciones publicadas en `/evaluationslalala`

**Severidad:** Alta · **Ref.:** QA BUG-004

- **Reproducir:** `GET /api/v1/evaluations` sin token.
- **Esperado:** 401 (ruta existente y protegida). El frontend consume `/evaluations`, `/evaluations/:id` y `/evaluations?group=`.
- **Actual:** 404; en cambio `GET /api/v1/evaluationslalala` → 401.
- **Causa:** `src/evaluations/evaluations.controller.ts:14` `@Controller('evaluationslalala')`.
- **Corrección:** `@Controller('evaluations')`.
- **Verificación:** `GET /api/evaluations` (admin) → **200**.

## BUG-006 — `/users/me` y `/groups/mine` responden 400 "ID invalido"

**Severidad:** Media · **Ref.:** QA BUG-005

- **Reproducir:** `GET /api/v1/users/me` con cualquier token; `GET /api/v1/groups/mine` con token de docente.
- **Esperado:** 200 con el perfil propio / los grupos del docente (rutas declaradas y documentadas).
- **Actual:** `400 "ID invalido"`.
- **Causa:** en `users.controller.ts` y `groups.controller.ts`, `@Get(':id')` estaba declarado **antes** que `@Get('me')` / `@Get('mine')`. Nest toma 'me'/'mine' como ID y `ParseObjectIdPipe` los rechaza. El propio código tenía el comentario *"Debe ir antes de ':id'"*.
- **Corrección:** mover `me`/`mine` antes de `:id` en ambos controladores.
- **Verificación:** `GET /api/users/me` → **200**; `GET /api/groups/mine` (docente) → **200**.

## BUG-007 — Las restricciones por rol no se aplican

**Severidad:** Crítica (acceso no autorizado) · **Ref.:** QA BUG-006, MX-03

- **Reproducir:** con token de estudiante, `GET /api/v1/users?limit=2`, `GET /api/v1/reports/dashboard` y `GET /api/v1/enrollments`.
- **Esperado:** `403 "No tienes permisos para esta accion"` (rutas `@Roles(Role.Admin)`).
- **Actual:** 200: el estudiante ve nombres y correos de todos los usuarios, el dashboard y todas las matrículas.
- **Causa:** `src/auth/auth.module.ts` solo registraba `JwtAuthGuard` como `APP_GUARD`; `RolesGuard` no estaba registrado en ningún lado, así que **todos** los `@Roles(...)` se ignoraban.
- **Corrección:**
  - Registrar `{ provide: APP_GUARD, useClass: RolesGuard }` después de `JwtAuthGuard`.
  - Arreglar en el mismo cambio `GET /enrollments/mine`, que estaba marcado `@Roles(Role.Docente)` aunque es una ruta del estudiante. Pasa a `Role.Estudiante`; si no, el estudiante habría quedado sin acceso.
- **Verificación:** estudiante `GET /api/users` → **403**; docente `GET /api/teachers` → **403**; estudiante `GET /api/enrollments/mine` → **200**.

## BUG-008 — Matricular responde 400 aunque la matrícula se crea

**Severidad:** Crítica · **Ref.:** QA BUG-010, MX-01

- **Reproducir:** estudiante activo `E20200008` → `POST /api/enrollments` con `{"groupId":"6abf0b8bfead57fb41c12c59"}` (periodo abierto).
- **Esperado:** 201 con la matrícula `activa`.
- **Actual:** `400 "No se pudo confirmar la matricula"`, pero en la base quedaron la matrícula activa, el cupo ocupado (`enrolled` +1) y la notificación "Matricula confirmada". Un reintento devuelve `409 "ya esta matriculado"`.
- **Causa:** `src/enrollments/enrollments.service.ts:79`: la comprobación posterior a la transacción estaba invertida (`if (created.status === Active) throw …`).
- **Corrección:** `===` → `!==`.
- **Verificación:** `POST /api/enrollments` → **201**; el grupo pasa a `enrolled` 1.

## BUG-009 — Cancelar una matrícula no libera el cupo

**Severidad:** Alta · **Ref.:** QA BUG-011, MX-02

- **Reproducir:** cancelar la matrícula anterior (`POST /api/enrollments/:id/cancel`), revisar `GET /api/groups/6abf0b8bfead57fb41c12c59` y volver a matricular.
- **Esperado:** al cancelar, `enrolled` vuelve a 0; al re-matricular, queda en 1. Regla del esquema: *cupos disponibles = capacity − enrolled*.
- **Actual:** al cancelar, `enrolled` seguía en 1; al re-matricular subía a 2, con una sola matrícula activa.
- **Causa:** `cancel()` solo cambiaba el estado a `cancelada`; nunca decrementaba `groups.enrolled`.
- **Corrección:** dentro de la misma transacción, `groupModel.updateOne({_id: enrollment.group, enrolled: {$gt: 0}}, {$inc: {enrolled: -1}}, {session})`.
- **Verificación:** matricular → `enrolled` 1; cancelar → **`enrolled` 0** (`availableSeats` 22).

## BUG-010 — Un docente puede gestionar grupos ajenos

**Severidad:** Alta · **Ref.:** QA BUG-013, MX-04

- **Reproducir:** docente `DOC-100` (no titular del grupo `…2c3b`) → `PUT /api/grades` con `{"enrollment":"6abf0b8bfead57fb41c12e2d","evaluation":"6abf0b8bfead57fb41c12e25","value":3.0}`.
- **Esperado:** `403 "El grupo no esta a tu cargo"`. El código lo documenta: *un docente solo los que tiene a su cargo*.
- **Actual:** 200: calificó y además pudo finalizar la matrícula.
- **Causa:** `src/groups/groups.service.ts:98` (`assertCanManage`) restringía a `Role.Estudiante` en vez de `Role.Docente`. Afecta a notas, evaluaciones, planillas, nómina y finalización.
- **Corrección:** `Role.Estudiante` → `Role.Docente`.
- **Verificación:** el mismo `PUT` → **403** *El grupo no esta a tu cargo*.

## BUG-011 — Una nota final de 3.00 queda reprobada

**Severidad:** Alta · **Ref.:** QA BUG-014, MX-05

- **Reproducir:** matrícula `…2e2d` con notas 3.1 (25 %), 2.6 (25 %), 3.0 (20 %) y 3.25 (30 %), que dan un ponderado de 3.00 → `POST /api/grades/finalize/6abf0b8bfead57fb41c12e2d`.
- **Esperado:** `aprobada`. `PASSING_GRADE = 3.0` está documentado como *"Nota minima para aprobar"*.
- **Actual:** `{"finalGrade":3,"status":"reprobada"}`.
- **Causa:** `src/grades/grades.service.ts:132` usaba `finalGrade > PASSING_GRADE`.
- **Corrección:** `>=`.
- **Verificación:** la misma finalización → **`{"finalGrade":3,"status":"aprobada"}`**.

## BUG-012 — El cambio de contraseña no se guarda

**Severidad:** Alta (seguridad) · **Ref.:** QA BUG-015, MX-06

- **Reproducir:** `PATCH /api/auth/change-password` con `{"currentPassword":"Secret123!","newPassword":"NuevaClave123"}` y revisar el usuario en MongoDB.
- **Esperado:** la clave nueva queda guardada y se registra `passwordChangedAt`, lo que invalida los tokens anteriores.
- **Actual:** responde 200 con un token, pero el usuario no cambia en la base (sin `passwordChangedAt`, `updatedAt` igual). La clave vieja sigue funcionando.
- **Causa:** `src/users/users.service.ts` (`changePassword`) modificaba el documento y hacía `return user` **sin `save()`**.
- **Corrección:** `return user.save();`.
- **Verificación:** MongoDB → `passwordChangedAt: 2026-10-05T17:53:44Z`.

## BUG-013 — Marcar una notificación como leída no cambia `read`

**Severidad:** Media · **Ref.:** QA BUG-016, MX-07

- **Reproducir:** `PATCH /api/notifications/:id/read` sobre una notificación no leída propia.
- **Esperado:** `read: true` y que deje de aparecer en `?read=false`.
- **Actual:** solo se asignaba `readAt`; `read` seguía en `false` y el contador de no leídas no bajaba.
- **Causa:** `src/notifications/notifications.service.ts` (`markRead`) no ponía `read = true` (`markAllRead` sí lo hacía).
- **Corrección:** `notification.read = true;` junto a `readAt`.
- **Verificación:** respuesta con **`"read":true`**.

## BUG-014 — No se aceptan notas mayores a 4.5

**Severidad:** Alta · **Ref.:** QA BUG-012, MX-08

- **Reproducir:** `PUT /api/grades` con `value: 4.8` (y con `5`).
- **Esperado:** 200. Swagger y el esquema definen la escala *0.0 a 5.0*.
- **Actual:** `400 "value must not be greater than 4.5"`.
- **Causa:** `src/grades/dto/grade.dto.ts:18` `@Max(4.5)`.
- **Corrección:** `@Max(5)`.
- **Verificación:** 4.8 → **200**; 5 → **200**.

## BUG-015 — El periodo en curso no se reconoce como abierto

**Severidad:** Crítica · **Ref.:** QA BUG-007, MX-11

- **Reproducir:** `GET /api/periods/current`, `GET /api/students/me/schedule` y `POST /api/enrollments`.
- **Esperado:** el periodo 2026-2 abierto.
- **Actual:** `404 "No hay un periodo abierto"`; la matrícula responde `400 "Solo se puede matricular en un periodo abierto"`; los reportes fallan.
- **Causa:** `database/periods.json` tenía el periodo 2026-2 con `status: "Abierto"` (mayúscula), fuera del enum `planificado|abierto|cerrado`. El importador inserta sin validar.
- **Corrección:** `"Abierto"` → `"abierto"` en la semilla.
- **Verificación:** `GET /api/periods/current` → **200** con el periodo 2026-2.

## BUG-016 — Matrícula duplicada y falta el índice único

**Severidad:** Alta · **Ref.:** QA BUG-022, MX-10

- **Reproducir:** `GET /api/enrollments?student=6abf0b8bfead57fb41c12b9c&group=6abf0b8bfead57fb41c12c3e`; revisar los índices de `enrollments`.
- **Esperado:** como máximo una matrícula por estudiante y grupo; el esquema declara un índice único `{student, group}`.
- **Actual:** `total: 2`, ambas activas, y el índice `student_1_group_1` **no existía**: Mongoose no pudo crearlo por el duplicado y siguió sin avisar.
- **Causa:** duplicado en `database/enrollments.json` (`…2dfb`, que además tenía la materia equivocada, y `6ac057b2…f3c2`).
- **Corrección:** eliminar `…2dfb` y sus 2 notas (`…2dfc`, `…2dfd`) de la semilla, recargar y reiniciar la API.
- **Verificación:** `$indexStats` muestra **`student_1_group_1` (unique)**.

## BUG-017 — `npm run db:import` aborta por un código de programa duplicado

**Severidad:** Alta · **Ref.:** MX-20

- **Reproducir:** `npm run db:import`.
- **Esperado:** que importe las 13 colecciones (paso del README).
- **Actual:** `E11000 duplicate key … programs index: code_1 dup key: { code: "DERE" }`. Se detiene y no importa `programs`, `students`, `subjects`, `teachers` ni `users`.
- **Causa:** `database/programs.json` tenía dos programas `DERE` ("Derecho" y "Derecho (jornada nocturna)").
- **Corrección:** el nocturno pasa a `DEREN` (decisión del grupo).
- **Verificación:** `npm run db:import` → **13 colecciones importadas, sin errores**.

## BUG-018 — Notas inválidas en la semilla

**Severidad:** Media · **Ref.:** QA BUG-017, MX-12

- **Reproducir:** completar las notas de la matrícula `…2e1a` y `POST /api/grades/finalize/6abf0b8bfead57fb41c12e1a`.
- **Esperado:** nota final numérica entre 0 y 5. El esquema define `value` como Number de 0 a 5.
- **Actual:** `400 "Cast to Number failed for value \"NaN\""`, un mensaje interno de Mongoose. En la semilla había una nota guardada como **texto** `"4,2"` y dos notas `5.7`.
- **Corrección:** `"4,2"` → `4.2`; `5.7` → `3.7` (la otra 5.7 se eliminó con BUG-016).
- **Verificación:** MongoDB: 0 notas no numéricas y 0 fuera de rango (318 notas).

## BUG-019 — Referencias cruzadas inconsistentes

**Severidad:** Media · **Ref.:** MX-13

- **Reproducir:** MongoDB, comparar `subject`/`period` de cada matrícula con los de su grupo, y el grupo de cada nota con el de su evaluación.
- **Esperado:** iguales. El esquema dice que se *copian del grupo al matricular*, y `GradesService` prohíbe notas de otro grupo.
- **Actual:** la matrícula `…2dfb` tenía otra materia, `…2e1a` otro periodo, y la nota `…2dfd` era de una evaluación de otro grupo.
- **Corrección:** `…2dfb` y `…2dfd` se eliminaron (BUG-016); `…2e1a.period` se alineó con su grupo.
- **Verificación:** MongoDB: 0 diferencias de materia o periodo, 0 notas de otro grupo.

## BUG-020 — Plan de evaluación que suma 110 %

**Severidad:** Media · **Ref.:** QA BUG-018, MX-14

- **Reproducir:** `POST /api/groups/6abf0b8bfead57fb41c12c3a/finalize`.
- **Esperado:** el plan suma 100 % (*"Los porcentajes del grupo deben sumar 100"*).
- **Actual:** `400 "no suman 100 (suman 110)"`. El grupo de MAT101 no se puede cerrar, y la API no deja cambiar pesos con notas registradas.
- **Causa:** en la semilla, el Taller de ese grupo pesaba 30 en vez de 20.
- **Corrección:** Taller 30 → 20, el mismo plan 25/25/20/30 que los otros 24 grupos.
- **Verificación:** MongoDB: los **25 grupos suman 100**.

## BUG-021 — Referencias huérfanas (programa del estudiante y decano)

**Severidad:** Media · **Ref.:** QA BUG-008, MX-15

- **Reproducir:** como la estudiante `juliana.herrera147@universidad.edu`: `GET /api/students/me/history` y `GET /api/students/me/progress`.
- **Esperado:** el historial o el progreso, nunca un 500.
- **Actual:** `500 Error interno del servidor`. Su perfil apuntaba a un programa que no existe. Además, la facultad FAC-COM tenía un decano inexistente.
- **Corrección:** se le asignó el programa Comunicación Social (CSOC, el de sus materias) y se quitó el decano inexistente; el esquema permite dejarlo vacío.
- **Verificación:** MongoDB: 0 estudiantes sin programa y 0 decanos inexistentes.

## BUG-022 — Valores fuera de enum o sin normalizar

**Severidad:** Media · **Ref.:** QA BUG-019/BUG-021, MX-16

- **Reproducir:** `GET /api/faculties?campus=Bogotá` (devuelve 4 de 5) y consultar los datos en MongoDB.
- **Esperado:** valores dentro del enum y normalizados (`trim`, `lowercase`).
- **Actual:**
  - Usuario con `role: "Docente"` y correo `Laura.Lopez89@…`.
  - Notificación `type: "aviso_urgente"`.
  - Franja `day: "Miércoles"`.
  - Facultad con `campus: "Bogotá "` (espacio final).
- **Corrección:** `docente`, correo en minúsculas, `aviso`, `miercoles` y `Bogotá`.
- **Verificación:** MongoDB: solo roles, tipos y días del enum; 0 correos con mayúsculas; 0 sedes con espacios.

## BUG-023 — Dos grupos usan el mismo salón a la misma hora

**Severidad:** Media · **Ref.:** MX-17

- **Reproducir:** MongoDB, periodo 2026-2: los grupos `…2c3a` y `…2c99` usan el salón B-104 el miércoles de 09:00 a 11:00.
- **Esperado:** sin choques; `assertNoConflicts` dice *"ni dos grupos usar el mismo salón a la vez"*.
- **Actual:** choque oculto, porque uno de los dos días estaba escrito `"Miércoles"`. Además, B-104 está **inactivo** y su capacidad (22) es menor que el cupo de los dos grupos.
- **Corrección:** `…2c3a` pasa a A-103 (capacidad 57) y `…2c99` a A-202 (capacidad 36); ambos estaban libres.
- **Verificación:** MongoDB: **0 choques de salón**.

## BUG-024 — Franja horaria que termina antes de empezar

**Severidad:** Baja · **Ref.:** MX-18

- **Actual:** el grupo `…2c64` tenía la franja jueves 09:00–07:00, que viola `assertValidSchedule` (*debe terminar después de iniciar*).
- **Corrección:** jueves 07:00–09:00, igual que su franja del martes; el salón estaba libre.
- **Verificación:** MongoDB: 0 franjas invertidas.

## BUG-025 — MAT101 es prerrequisito de sí misma

**Severidad:** Alta · **Ref.:** QA BUG-020, MX-19

- **Reproducir:** `GET /api/subjects/6abf0b8bfead57fb41c12970`.
- **Esperado:** sin autorreferencia (regla `assertNoCycle`).
- **Actual:** `prerequisites: [MAT101]`. Nadie podía matricular Cálculo 1, porque había que aprobarla antes de cursarla.
- **Corrección:** se quitó la autorreferencia en `database/subjects.json`.
- **Verificación:** MongoDB: 0 autorreferencias.

## BUG-026 — Contador `enrolled` por encima del cupo en la semilla

**Severidad:** Alta · **Ref.:** QA BUG-009, MX-02

- **Reproducir:** `GET /api/reports/group-occupancy`.
- **Esperado:** ocupación ≤ 100 % y `enrolled` igual a las matrículas vigentes.
- **Actual:** MAT101 grupo 1 al 109.4 % (35/32) y ODON105 grupo 1 al 107.7 % (42/39), con solo 9 matrículas reales cada uno.
- **Corrección:** se recalculó `enrolled` = matrículas con estado distinto de `cancelada` (misma regla que el cierre de periodo): 35 → 9 y 42 → 9.
- **Verificación:** MongoDB: **0 grupos desfasados y 0 sobre capacidad**.

## BUG-027 — Matrícula activa en periodo cerrado y con nota final

**Severidad:** Baja · **Ref.:** MX-21, MX-22

- **Actual:** la matrícula `…2d25` (periodo 2025-1, cerrado) estaba `activa` con `finalGrade` 3.38. Al cerrar un periodo, las matrículas activas deben finalizarse o cancelarse.
- **Corrección:** tiene todas sus notas y su nota final es 3.38 ≥ 3.0 → `aprobada`.
- **Verificación:** MongoDB: 0 matrículas activas en periodos cerrados y 0 activas con nota final.

## BUG-028 — Las cuentas de prueba del README no sirven

**Severidad:** Media · **Ref.:** QA BUG-021

- **Reproducir:** iniciar sesión con las cuentas de la tabla *Usuarios de prueba* del README.
- **Esperado:** cuentas activas con su rol y perfil.
- **Actual:**
  - La docente Laura López estaba **inactiva**, con rol `"Docente"` y correo con mayúsculas (el login no la encontraba).
  - La estudiante Juliana Herrera tenía el perfil **inactivo** y sin programa.
- **Corrección:** las dos cuentas quedan activas y con datos normalizados (ver BUG-021 y BUG-022).
- **Verificación:** login de `laura.lopez89@universidad.edu` con `Secret123!` → **200**.

## BUG-029 — Crear un usuario responde 400 aunque tiene éxito

**Severidad:** Media · **Estado:** Pendiente (se encontró durante las correcciones; todavía no se corrige)

- **Reproducir:** `POST /api/users` como admin, con datos válidos.
- **Esperado:** 201 Created.
- **Actual (por código):** `src/users/users.controller.ts:28` tiene `@HttpCode(400)` en `create`, así que un alta exitosa responde 400.
- **Corrección propuesta:** quitar `@HttpCode(400)`, para que Nest responda 201 por defecto en un POST.

---

## Pendientes y observaciones sin criterio definido

- La búsqueda `GET /api/users?q=` distingue mayúsculas (`SALAZAR` no encuentra nada), mientras que `/api/students?q=` no las distingue. La documentación solo dice *"Busca en nombre y correo"*, así que hace falta que el grupo o el docente definan el comportamiento esperado.
- El login espera 5 s fijos en cada intento (`slowDownAttempts`). Es intencional según el comentario del código; no hay un criterio de tiempo.
