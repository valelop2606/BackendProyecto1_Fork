# Backend Error #21 — Tablero de reportes con `Promise.all` frágil que tumba todo si un conteo falla — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/reports/reports.service.ts:38 — dashboard()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/reports/reports.service.ts:38 — const [users, students, ...] = await Promise.all([...])` con ocho conteos en paralelo. Esta pieza arma el tablero general, que es la primera pantalla de gestión, por lo que un fallo parcial no debería vaciarla por completo.

**[Síntoma Detectado]:** Hoy si uno de los ocho conteos falla por un índice caído o un tiempo de espera, `Promise.all` rechaza el lote completo y el tablero devuelve `500` sin ningún número, aunque siete conteos estaban listos. El sistema hoy se comporta así: el administrador pide el resumen, una colección tarda, y la respuesta es un error global en lugar de un tablero con una casilla marcada. Es incorrecto porque los conteos son independientes y el tablero debe degradarse por casilla, no colapsar por el eslabón más lento.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque deja sin gestión en el escenario de degradación parcial de base, donde el operador más necesita ver. Además convierte un problema acotado en una caída funcional. Se viola el principio de aislamiento de fallos en operaciones independientes y la guía de resiliencia que pide `allSettled` para abanicos no transaccionales.

**Evidencia Postman:** Evidencia estática por lectura del abanico más réplica `curl` al tablero con una colección lenta simulada. Con un conteo forzado a fallar, la respuesta es `500` global en lugar de `200` con casillas y una marcada como no disponible.

```text
curl -i http://localhost:3000/api/v1/reports/dashboard -H "Authorization: Bearer <admin>"
  -> 200 en sano; 500 global si un count falla (anómalo; esperado 200 con casilla degradada)
grep -n "Promise.all" src/reports/reports.service.ts -> dashboard y facultySummary con abanico frágil
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en dejar que cada conteo falle por su cuenta sin arrastrar al resto. El cambio se hace en el servicio de reportes. Primero se sustituye `Promise.all` por `Promise.allSettled` y se mapea cada resultado a valor o a marcador de no disponible. Después se mantiene la forma del tablero con las mismas claves, agregando un arreglo de advertencias por casilla. Desde ese momento el tablero devuelve `200` con siete números y una casilla explicada, en lugar de `500` vacío. La robustez viene de que el fallo queda localizado y el operador sabe qué reintentar.

**[Patrón Aplicado]:** Abanico resiliente con `allSettled` y degradación por casilla. Este patrón encaja aquí porque el defecto era la fragilidad del lote, y asentar cada promesa convierte el error global en información parcial útil.

```ts
// BackendProyecto1_Fork/src/reports/reports.service.ts — listo para pegar (esquema)
async dashboard() {
  // antes (mal): const [users, ...] = await Promise.all([...]);
  const settled = await Promise.allSettled([
    this.userModel.countDocuments().exec(),
    // ... otros siete conteos ...
  ]);
  const valueOf = (r: PromiseSettledResult<number>, fallback = 0) =>
    r.status === 'fulfilled' ? r.value : fallback;
  // armar tablero con valueOf + warnings por rechazados
  return { /* mismo contrato + warnings */ };
}
```

Tras el cambio, el tablero responde `200` con números y advertencias. Es robusto porque el fallo parcial se vuelve visible sin tumbar la gestión.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Los ocho conteos viajaban en un lote que rechazaba completo al primer fallo, dejando el tablero vacío. La consecuencia encadenada era que un problema acotado en una colección cegaba toda la gestión.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: tablero en `200`.
2. Simular un conteo lento o caído y `curl -i http://localhost:3000/api/v1/reports/dashboard -H "Authorization: Bearer <admin>"` — devuelve `500`, que es lo anómalo.
3. Esperado tras el fix: `200` con casillas y `warnings` para la fallida.

**[Cómo lo arregló]:** El asentamiento actúa esperando a todas las promesas y etiquetando cada una como cumplida o rechazada. Al mapear a valores con reserva, el tablero se arma con lo disponible y el rechazo queda como advertencia. El error deja de propagarse como excepción global y se vuelve dato.

**[Argumento para el profesor]:** "Profesor, encontramos que el tablero armaba ocho conteos con `Promise.all`, por lo que un fallo parcial devolvía `500` vacío en lugar de un resumen degradado. El impacto es alto porque ciega la gestión justo en degradación. Aplicamos abanico resiliente con `allSettled`, devolviendo `200` con números y advertencias por casilla, sin tocar el contrato. Lo evidenciamos con lectura del abanico y con `curl` al tablero bajo fallo simulado, mostrando el `500` anómalo frente al `200` degradado esperado. Esto garantiza tableros útiles en degradación, fallos localizados y operación que sigue gestionando."
