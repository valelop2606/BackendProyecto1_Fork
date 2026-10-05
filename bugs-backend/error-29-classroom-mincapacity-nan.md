# Backend Error #29 — Filtro `minCapacity` con `Number()` sin guardia deja `NaN` a la consulta — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/classrooms/dto/classroom.dto.ts:56 — ClassroomsQueryDto.minCapacity`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/classrooms/dto/classroom.dto.ts:56 — propiedad minCapacity` con `@Transform(({ value }) => Number(value))` seguido de `@IsInt()` y `@Min(1)`. Esta pieza filtra salones por capacidad mínima desde texto de query, por lo que una conversión sin guardia deja pasar `NaN` al servicio.

**[Síntoma Detectado]:** Hoy pedir `GET /api/v1/classrooms?minCapacity=abc` transforma a `NaN`, y según cómo el tubo ordene transformación y validación, el `NaN` puede llegar al filtro de Mongo como comparación numérica sin sentido. El sistema hoy se comporta así: el cliente envía texto no numérico, la transformación lo convierte sin validar, y la consulta devuelve vacío o error en lugar de `400` explicativo. Es incorrecto porque la frontera debe rechazar lo no numérico con mensaje, y el resto de DTO usa el ayudante `toBoolean` o `Type(() => Number)` con validación coherente.

**[Gravedad / Impacto]:** La gravedad es media-baja de nivel P2 porque no filtra datos ajenos, pero degrada el diagnóstico en el escenario de filtros manuales, donde el usuario no sabe qué corrigió mal. Además deja una inconsistencia entre DTO que confunde al mantenedor. Se viola el principio de validación en frontera con mensajes accionables y la regla de transformaciones totales que nunca producen `NaN` silencioso.

**Evidencia Postman:** Evidencia estática por lectura de la transformación más réplica `curl` al listado con valor no numérico. Con `minCapacity=abc`, la respuesta es vacío o `500` según el camino, en lugar de `400` con mensaje de entero mínimo.

```text
curl -i "http://localhost:3000/api/v1/classrooms?minCapacity=abc" -H "Authorization: Bearer <admin>"
  -> vacío o 500 (anómalo; esperado 400 minCapacity debe ser entero >=1)
grep -n "minCapacity" src/classrooms/dto/classroom.dto.ts -> Number() sin guardia
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en transformar solo lo convertible y rechazar el resto con mensaje. El cambio se hace en el DTO. Primero se sustituye `Number(value)` por una función que devuelve el número si es entero finito o deja el original para que `IsInt` lo rechace. Después se mantiene `@IsInt()` y `@Min(1)` como guardianes. Desde ese momento `abc` devuelve `400` explicativo y `40` filtra con normalidad. La robustez viene de que la transformación deja de producir `NaN` silencioso.

**[Patrón Aplicado]:** Transformación total con rechazo explícito en frontera. Este patrón encaja aquí porque el defecto era la conversión parcial, y hacerla total devuelve el error a quien puede corregirlo sin tocar el servicio.

```ts
// BackendProyecto1_Fork/src/classrooms/dto/classroom.dto.ts — listo para pegar
@ApiPropertyOptional({ description: 'Capacidad minima' })
@IsOptional()
@Transform(({ value }) => {
  // antes (mal): Number(value) que da NaN; después (bien): solo lo convertible
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
})
@IsInt()
@Min(1)
minCapacity?: number;
```

Tras el cambio, lo no numérico recibe `400` y lo numérico filtra. Es robusto porque la frontera nunca deja pasar `NaN` a la consulta.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La transformación convertía sin guardia, dejando `NaN` hacia la validación o la consulta. La consecuencia encadenada era diagnósticos pobres y una inconsistencia frente a los DTO que usan ayudantes compartidos.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: `Number()` directo.
2. `curl -i "http://localhost:3000/api/v1/classrooms?minCapacity=abc" -H "Authorization: Bearer <admin>"` — vacío o error, que es lo anómalo.
3. Esperado tras el fix: `400` con mensaje de entero mínimo y `200` filtrado con `40`.

**[Cómo lo arregló]:** La función actúa en el tubo antes de validar, devolviendo número solo cuando es entero finito. Al dejar el original en otro caso, `IsInt` lo rechaza con mensaje. La consulta solo recibe enteros, por lo que el filtro vuelve a ser predecible.

**[Argumento para el profesor]:** "Profesor, encontramos que el filtro de capacidad mínima convertía con `Number()` sin guardia, dejando `NaN` hacia la consulta en lugar de un `400` explicativo. El impacto es medio en diagnóstico, porque el usuario no sabe qué corregir. Aplicamos transformación total en el DTO, devolviendo número solo si es entero y dejando el resto al rechazo con mensaje, sin tocar el servicio. Lo evidenciamos con `curl` de `minCapacity=abc` mostrando vacío o error frente al `400` esperado. Esto garantiza filtros predecibles, errores accionables y una frontera sin silencios."
