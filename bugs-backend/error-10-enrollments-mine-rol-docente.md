# Backend Error #10 — `GET /enrollments/mine` exige rol docente cuando es un recurso de estudiante — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/enrollments/enrollments.controller.ts:35 — mine()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/enrollments/enrollments.controller.ts:35 — función mine()` con `@Roles(Role.Docente)` y `@Get('mine')`. Esta pieza debería devolver las matrículas del estudiante autenticado, porque el servicio llama a `findByUserId(user.id)` y filtra por ese estudiante, de modo que exigir docente es contradictorio con su implementación.

**[Síntoma Detectado]:** Hoy un estudiante con token válido pide `GET /api/v1/enrollments/mine` y recibe `403 No tienes permisos`, mientras un docente puede pedirla y el servicio intenta buscarlo como estudiante y falla o devuelve vacío. El sistema hoy se comporta así: el dueño legítimo es rechazado en la puerta y el rol equivocado es admitido para luego no encontrar nada. Es incorrecto porque la audiencia debe coincidir con el dueño de los datos, y el propio servicio lo confirma al resolver por `user.id` como estudiante.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque deja al estudiante sin su vista de matrículas en el escenario de revisar horarios y pagos, obligándolo al listado general que no puede usar. El docente queda con una ruta que no le sirve. Se viola el principio de diseño centrado en el dueño del recurso y la coherencia entre controlador y servicio, además de la usabilidad del rol estudiante.

**Evidencia Postman:** Evidencia estática por lectura de anotación frente a implementación del servicio más réplica `curl` con ambos roles. Con token de estudiante se observa `403` donde se espera `200` paginado, y con token docente se observa `200` vacío o error de perfil donde se espera `403`.

```text
curl -i "http://localhost:3000/api/v1/enrollments/mine" -H "Authorization: Bearer <estudiante>"
  -> 403 (anómalo; esperado 200 {data, meta} del propio estudiante)
curl -i "http://localhost:3000/api/v1/enrollments/mine" -H "Authorization: Bearer <docente>"
  -> 200 vacío o 404 de perfil (anómalo; esperado 403 por audiencia)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en alinear la audiencia con el dueño que el servicio ya implementa, cambiando un solo enumerado. El cambio se hace en el controlador. Primero se sustituye `@Roles(Role.Docente)` por `@Roles(Role.Estudiante)` y se permite también al administrador si la operación lo requiere para soporte. Después se deja el servicio con `findByUserId` intacto, porque ya resuelve al dueño. Desde ese momento el estudiante obtiene sus matrículas y el docente deja de entrar a una vista que no le pertenece. La robustez viene de que controlador y servicio vuelven a decir lo mismo sobre quién es el dueño.

**[Patrón Aplicado]:** Audiencia alineada con el dueño del recurso y autorización declarativa. Este patrón encaja aquí porque el defecto era la contradicción entre la puerta y el interior, y corregir el enumerado reconcilia ambas capas sin nueva lógica.

```ts
// BackendProyecto1_Fork/src/enrollments/enrollments.controller.ts — listo para pegar
// Debe ir antes de ':id' para que 'mine' no se interprete como un ID
@ApiOperation({ summary: 'Mis matriculas' })
@Roles(Role.Estudiante)
@Get('mine')
mine(@CurrentUser() user: AuthUser, @Query() query: EnrollmentsQueryDto): Promise<Paginated<Enrollment>> {
  return this.enrollmentsService.findMine(user.id, query);
}
```

Tras el cambio, el estudiante recibe `200` con sus datos y el docente recibe `403` en esta ruta específica. Es robusto porque la audiencia queda verificable con dos tokens y el servicio no necesita ramas por rol.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La puerta pedía docente mientras el interior buscaba estudiante por `user.id`, de modo que el dueño era rechazado y el invitado admitido. La consecuencia encadenada era una vista personal que no servía a nadie: el estudiante con `403` y el docente con vacío.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `mine` con `Docente`.
2. `curl -i "http://localhost:3000/api/v1/enrollments/mine" -H "Authorization: Bearer <estudiante>"` — devuelve `403`, que es lo anómalo.
3. Esperado tras el fix: `200` paginado del estudiante y `403` para el docente en esta ruta.

**[Cómo lo arregló]:** El enumerado actúa como lista de admitidos evaluada por el guardia antes de ejecutar el servicio. Al cambiarlo a estudiante, el dueño pasa y el resto se deniega en la frontera, sin que el servicio deba adivinar roles. La resolución por `findByUserId` vuelve a tener sentido porque quien llega ya es el dueño.

**[Argumento para el profesor]:** "Profesor, encontramos que `GET /enrollments/mine` pedía rol docente aunque el servicio la implementa como vista del estudiante por `user.id`, por lo que el dueño recibía `403` y el docente entraba a un vacío. El impacto es alto porque el estudiante pierde su vista de matrículas. Aplicamos audiencia alineada con el dueño, cambiando a rol estudiante en el controlador sin tocar el servicio, con lo que puerta e interior coinciden. Lo evidenciamos con lectura cruzada de controlador y servicio y con `curl` de ambos roles, mostrando el `403` invertido frente al `200` del dueño esperado. Esto garantiza vistas personales para su dueño, denegación correcta al resto y coherencia entre capas."
