# Backend Error #09 — Listar y ver programas sin `@Roles()` abiertos a cualquier autenticado — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/programs/programs.controller.ts:25 — findAll()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/programs/programs.controller.ts:25 — función findAll()` con `@Get()` sin `@Roles()`, y la misma situación en `findOne()` de la línea siguiente. Esta pieza es el catálogo de programas, que en el diseño por roles debería consumirse según audiencia, de modo que su apertura total rompe la coherencia con estudiantes y docentes acotados en sus propios listados.

**[Síntoma Detectado]:** Hoy cualquier token válido lista y ve programas con filtros de facultad y estado, sin que se exija rol. El sistema hoy se comporta así: el cliente pide `GET /api/v1/programs?page=1&limit=20` con un token cualquiera y recibe `200` paginado, mientras crear y editar sí piden administrador. Es incorrecto por incoherencia, porque la lectura queda más abierta que la escritura sin una decisión documentada, y permite recolección masiva del catálogo por cuentas de bajo privilegio.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque habilita enumeración completa en el escenario de una cuenta comprometida de bajo rol que cosecha el catálogo para ingeniería social. No filtra secretos, pero sí estructura institucional. Se viola el principio de privilegio mínimo y la guía de diseño que pide audiencias explícitas por operación de lectura sensible.

**Evidencia Postman:** Evidencia estática por lectura de anotaciones más réplica `curl` con token de estudiante al listado. La colección simple trae `programs/Listar`, que hoy con el prefijo vivo devuelve `200` para cualquier rol en lugar de filtrar por audiencia.

```text
curl -i "http://localhost:3000/api/v1/programs?page=1&limit=20" -H "Authorization: Bearer <estudiante>"
  -> 200 {data, meta} (anómalo si la política exige audiencia; esperado 403 fuera de audiencia)
Newman programs no incluido en la colección simple; réplica curl directa al prefijo vivo.
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en declarar la audiencia de lectura sin cambiar filtros ni paginación. El cambio se hace en el controlador con dos anotaciones. Primero se agrega `@Roles(Role.Admin, Role.Docente, Role.Estudiante)` a `findAll` y `findOne` si la lectura es para matriculados, o una audiencia más estrecha si el negocio lo exige. Después se deja el servicio con sus filtros de `q`, `faculty` y `active` intactos. Desde ese momento el guardia filtra antes de consultar y los roles legítimos siguen en `200`. La robustez viene de que la política queda junto a cada operación y se verifica con tres tokens.

**[Patrón Aplicado]:** Autorización declarativa por operación de lectura con guardia global. Este patrón encaja aquí porque el defecto era la omisión de la audiencia en lecturas, y declararla restaura la coherencia entre lectura y escritura sin tocar la consulta.

```ts
// BackendProyecto1_Fork/src/programs/programs.controller.ts — listo para pegar
@ApiOperation({ summary: 'Listar programas (filtros: q, faculty, active)' })
@Roles(Role.Admin, Role.Docente, Role.Estudiante)
@Get()
findAll(@Query() query: ProgramsQueryDto): Promise<Paginated<Program>> {
  return this.programsService.findAll(query);
}

@ApiOperation({ summary: 'Ver un programa por ID' })
@Roles(Role.Admin, Role.Docente, Role.Estudiante)
@Get(':id')
findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Program> {
  return this.programsService.findOne(id);
}
```

Tras el cambio, la lectura queda acotada a su audiencia y la escritura sigue en administrador. Es robusto porque cada operación declara a quién sirve y el guardia lo exige.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Las lecturas no declaraban audiencia mientras las escrituras sí, dejando el catálogo abierto por omisión. La consecuencia encadenada era que la protección de escritura daba falsa confianza mientras la lectura masiva seguía libre.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `findAll` y `findOne` sin `@Roles`.
2. `curl -i "http://localhost:3000/api/v1/programs?page=1&limit=20" -H "Authorization: Bearer <estudiante>"` — devuelve `200` paginado, que es lo a acotar.
3. Esperado tras el fix: `200` solo para la audiencia declarada y `403` fuera de ella.

**[Cómo lo arregló]:** La anotación actúa como condición previa evaluada por el guardia global antes de ejecutar la consulta. Al declarar la audiencia, el reflector la exige y la base solo se toca para roles legítimos. La paginación y los filtros no cambian, porque la frontera ya decidió quién puede preguntar.

**[Argumento para el profesor]:** "Profesor, encontramos que listar y ver programas no exigían rol mientras crear y editar sí, dejando el catálogo abierto a cualquier autenticado para enumeración. El impacto es alto por incoherencia y recolección masiva. Aplicamos autorización declarativa por operación, con audiencia explícita en ambas lecturas apoyada en el guardia global, sin tocar filtros ni paginación. Lo evidenciamos con lectura de anotaciones y con `curl` de estudiante al listado, mostrando `200` abierto frente al acceso acotado esperado. Esto garantiza catálogo solo para su audiencia, coherencia lectura-escritura y política visible por operación."
