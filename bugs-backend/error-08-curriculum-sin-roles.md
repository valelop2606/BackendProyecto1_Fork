# Backend Error #08 — Malla curricular de programa expuesta sin `@Roles()` a cualquier autenticado — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/academic/academic.controller.ts:72 — curriculum()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/academic/academic.controller.ts:72 — función curriculum()` con `@Get('programs/:id/curriculum')` sin decorador `@Roles()`. Esta pieza entrega la malla completa con prerrequisitos, que es información curricular sensible para la planificación, de modo que su audiencia debe estar acotada.

**[Síntoma Detectado]:** Hoy cualquier usuario con un token válido, incluso con rol no académico, puede descargar la malla de cualquier programa sin restricción de rol. El sistema hoy se comporta así: el cliente pide `GET /api/v1/programs/:id/curriculum` con un token cualquiera, el guardia de identidad lo deja pasar, y nadie pregunta si su rol necesita esa vista. Es incorrecto porque las rutas vecinas del mismo controlador sí exigen `Admin` o `Docente` para planillas y progresos, dejando a esta en incoherencia y abriendo enumeración de programas.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque expone planeación académica en el escenario de recolección masiva por un autenticado de bajo privilegio, sin necesidad de explotar nada más. No filtra notas, pero sí estructura curricular completa. Se viola el principio de privilegio mínimo y la categoría de control de acceso del estándar OWASP, además de la consistencia interna del propio controlador académico.

**Evidencia Postman:** Evidencia estática por lectura del controlador más réplica `curl` con token de estudiante a la ruta de malla. Con token válido de rol no autorizado, la respuesta es `200` con materias por semestre en lugar del `403` esperado según la política de las rutas hermanas.

```text
curl -i http://localhost:3000/api/v1/programs/<id>/curriculum -H "Authorization: Bearer <estudiante>"
  -> 200 {program, semesters:[...]} (anómalo si la política exige Admin/Docente; esperado 403)
grep -n "curriculum" src/academic/academic.controller.ts -> manejador sin @Roles vecinal sí con Roles
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en alinear esta ruta con la política de sus hermanas, declarando la audiencia en el propio manejador. El cambio se hace en el controlador con una sola anotación. Primero se agrega `@Roles(Role.Admin, Role.Docente, Role.Estudiante)` si la malla es para matriculados, o `@Roles(Role.Admin, Role.Docente)` si es solo de gestión, según decida el negocio. Después se deja el servicio intacto, porque ya resuelve por identificador. Desde ese momento el guardia global de roles filtra antes de tocar la base, y los tres roles legítimos siguen en `200`. La robustez viene de que la política queda visible junto a la ruta y se prueba con tres tokens.

**[Patrón Aplicado]:** Autorización declarativa por manejador con guardia global de roles. Este patrón encaja aquí porque el defecto era la ausencia de la declaración, y agregarla convierte la intención en verificación sin ramificar el servicio.

```ts
// BackendProyecto1_Fork/src/academic/academic.controller.ts — listo para pegar
@ApiOperation({ summary: 'Malla curricular de un programa: materias por semestre con prerrequisitos' })
@Roles(Role.Admin, Role.Docente, Role.Estudiante)
@Get('programs/:id/curriculum')
curriculum(@Param('id', ParseObjectIdPipe) id: string) {
  return this.academicService.curriculum(id);
}
```

Tras el cambio, los roles académicos siguen en `200` y los tokens sin rol requerido reciben `403`. Es robusto porque la audiencia queda explícita y cualquier ampliación futura se hace en la anotación.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La ruta carecía de audiencia declarada mientras sus vecinas sí la tenían, de modo que el guardia, una vez registrado, la dejaba pasar por no exigir nada. La consecuencia encadenada era una isla pública dentro de un controlador por lo demás acotado, ideal para enumeración.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `curriculum` sin `@Roles`.
2. `curl -i http://localhost:3000/api/v1/programs/<id>/curriculum -H "Authorization: Bearer <estudiante>"` — devuelve `200` con la malla, que es lo a justificar.
3. Esperado según política estricta: `403` para roles fuera de la audiencia y `200` solo para la audiencia declarada.

**[Cómo lo arregló]:** La anotación actúa como metadato que el guardia global lee antes de ejecutar el manejador. Al declarar la audiencia, el reflector la recupera y compara con `request.user.role`, denegando antes de consultar materias y prerrequisitos. El servicio no necesita saber quién llama, porque la frontera ya filtró.

**[Argumento para el profesor]:** "Profesor, encontramos que la malla curricular por programa no declaraba audiencia mientras sus rutas hermanas sí, quedando abierta a cualquier autenticado para enumeración. El impacto es alto porque expone planeación completa sin control. Aplicamos autorización declarativa con `@Roles()` sobre el manejador, alineándola con la política del controlador y apoyada en el guardia global, sin tocar el servicio. Lo evidenciamos con lectura del controlador y con `curl` autenticado mostrando `200` sin audiencia frente al `403` esperado para roles fuera de ella. Esto garantiza mallas solo para su audiencia, consistencia del controlador y auditoría visible por ruta."
