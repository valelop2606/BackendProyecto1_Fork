# Backend Error #07 — `RolesGuard` nunca se registra global y todos los `@Roles()` son decoración inoperante — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/auth/auth.module.ts:29 — providers con APP_GUARD`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/auth/auth.module.ts:29 — arreglo providers` donde solo se registra `{ provide: APP_GUARD, useClass: JwtAuthGuard }`, y `BackendProyecto1_Fork/src/auth/guards/roles.guard.ts:9 — clase RolesGuard` que nunca se provee. Esta pieza es el cerrojo de autorización de toda la API, porque el guardia global es quien convierte la anotación `@Roles()` en una verificación real en cada petición.

**[Síntoma Detectado]:** Hoy cualquier usuario autenticado puede llamar rutas reservadas al administrador, porque la anotación `@Roles(Role.Admin)` se evalúa en el vacío. El sistema hoy se comporta así: un estudiante con token válido pide `POST /api/v1/programs` o `GET /api/v1/users`, el guardia de autenticación lo deja pasar por tener token, y nadie revisa su rol. Es incorrecto porque la autorización debe negar por defecto y solo permitir al rol exigido, y el propio comentario del módulo promete que todas las rutas requieren JWT salvo `@Public()`, pero olvida la segunda mitad del cerrojo.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque es una falla de control de acceso en el escenario de escalamiento horizontal de privilegios, donde un estudiante crea programas o lista usuarios. Todo el modelo de roles queda en papel. Se viola el control de acceso roto del estándar OWASP categoría A01 y el principio de denegación por defecto con privilegio mínimo, además de la guía de NestJS que exige registrar cada guardia global con `APP_GUARD`.

**Evidencia Postman:** Evidencia estática por lectura de proveedores más réplica `curl` con token de rol bajo a ruta de administrador, ya que Newman sin token real solo muestra `401` por falta de autenticación. Con token de estudiante, la ruta de administrador devuelve `201/200` en lugar del `403` esperado, lo que demuestra la ausencia del guardia.

```text
grep APP_GUARD src/auth/auth.module.ts -> solo JwtAuthGuard, sin RolesGuard
curl -i -X POST http://localhost:3000/api/v1/programs -H "Authorization: Bearer <estudiante>"
  -H "Content-Type: application/json" -d '{"code":"ISIS","name":"X","totalCredits":160}'
  -> 201 (anómalo; esperado 403 No tienes permisos)
curl -i http://localhost:3000/api/v1/users -H "Authorization: Bearer <estudiante>"
  -> 200 (anómalo; esperado 403)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en encadenar ambos cerrojos en el orden correcto a nivel global, sin tocar cada controlador. El cambio se hace en el módulo de autenticación. Primero se importa `RolesGuard` y se agrega un segundo proveedor `APP_GUARD` con esa clase, después del de `JwtAuthGuard`. Después se verifica que `RolesGuard` lea `@Roles()` del manejador y de la clase, y que devuelva verdadero cuando no hay roles exigidos. Desde ese momento cada petición pasa primero por identidad y luego por autorización, y las rutas sin anotación siguen abiertas a cualquier autenticado. La robustez viene de que el orden global garantiza que `request.user` ya exista cuando se evalúa el rol.

**[Patrón Aplicado]:** Cadena de guardias globales con `APP_GUARD` y separación de identidad y autorización. Este patrón encaja aquí porque el defecto era la ausencia del segundo eslabón, y al registrarlo se convierte la anotación dispersa en una verificación central sin repetir lógica en cada controlador.

```ts
// BackendProyecto1_Fork/src/auth/auth.module.ts — listo para pegar
import { RolesGuard } from './guards/roles.guard';

providers: [
  AuthService,
  JwtStrategy,
  // Todas las rutas requieren JWT salvo las marcadas con @Public()
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  // Sin este segundo guardia, @Roles() no se evalúa en ninguna ruta
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

Tras el cambio, un estudiante recibe `403` en rutas de administrador y el administrador sigue en `200/201`. Es robusto porque centraliza la autorización y permite probar el cerrojo una vez para toda la superficie.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Solo el guardia de identidad estaba registrado, de modo que la anotación de roles era documentación sin efecto. La consecuencia encadenada era que decenas de controladores parecían protegidos en el código pero estaban abiertos en la ejecución, con una falsa sensación de seguridad.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: proveedores con un solo `APP_GUARD`.
2. `curl -i http://localhost:3000/api/v1/users -H "Authorization: Bearer <estudiante>"` — devuelve `200` con la lista, que es lo anómalo.
3. Esperado tras el fix: `403 {"message":"No tienes permisos para esta accion"}` y `201` solo con token de administrador.

**[Cómo lo arregló]:** El segundo proveedor actúa como eslabón posterior en la cadena de Nest, que ejecuta los guardias globales en orden de registro. Al llegar la petición, el primer guardia fija `request.user` desde el token verificado, y el segundo compara `user.role` con los roles exigidos por el manejador. La anotación deja de ser comentario y se vuelve condición evaluada, con lo que el acceso indebido se neutraliza antes de tocar el servicio.

**[Argumento para el profesor]:** "Profesor, encontramos que el guardia de roles nunca se registró como global, por lo que todos los `@Roles()` del proyecto eran inoperantes y cualquier autenticado podía usar rutas de administrador. El impacto es crítico porque anula el modelo de autorización y viola el control de acceso del estándar OWASP con denegación por defecto. Aplicamos cadena de guardias globales, agregando `RolesGuard` como segundo `APP_GUARD` tras el de identidad, con lo que cada petición verifica identidad y luego rol en orden. Lo evidenciamos con lectura de proveedores y con `curl` de estudiante a ruta de administrador, mostrando `200` anómalo frente al `403` esperado. Esto garantiza roles exigibles, pruebas centrales del cerrojo y una superficie sin privilegios implícitos."
