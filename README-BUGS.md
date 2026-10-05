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

Esta corrección solo deja el backend levantado. Hay otros problemas que se vieron durante el arranque; no se tocaron y se documentarán como bugs propios:

- El prefijo global es `/api/v1`, pero el frontend y el README usan `/api`. Hoy el frontend recibe 404 en todas sus llamadas.
- Swagger está en `/api/doc`, pero el README indica `/api/docs`.
- `npm run db:import` se interrumpe por un código de programa duplicado (`DERE`) en `database/programs.json`, y deja sin importar `programs`, `students`, `subjects`, `teachers` y `users`.
- El login exige contraseñas de al menos 12 caracteres, pero `ADMIN_PASSWORD=Secret123!` tiene 10, así que el admin inicial no puede iniciar sesión.
