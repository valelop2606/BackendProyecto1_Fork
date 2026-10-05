# Backend Error #24 — Borrado seguro con `if-else` encadenado en lugar de estrategia por agregado — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/deletions/deletions.service.ts:47 — removeGroup() y hermanas`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/deletions/deletions.service.ts:47 — doce métodos remove*()` con secuencias de `mustExist`, `assertUnused` y `deleteOne` repetidas por agregado. Esta pieza decide si un borrado es seguro consultando dependencias, por lo que repetir la coreografía en doce lugares la vuelve propensa a olvidar una dependencia.

**[Síntoma Detectado]:** Hoy agregar una nueva dependencia, por ejemplo que `groups` también bloquee por `notifications`, obliga a recordar qué método la revisa, y un olvido deja huérfanos. El sistema hoy se comporta así: cada `remove` copia el patrón con distintos conteos, el controlador delega sin política visible y la regla vive dispersa. Es incorrecto porque la política de borrado debe ser una estrategia por agregado registrada en un mapa, no doce coreografías gemelas.

**[Gravedad / Impacto]:** La gravedad es media de nivel P2 porque no tumba hoy, pero permite borrados con huérfanos en el escenario de evolución del modelo, donde se agrega una relación y se olvida un conteo. Además dificulta auditar qué bloquea a qué. Se viola el principio abierto-cerrado del diseño SOLID, que pide extender sin modificar la coreografía.

**Evidencia Postman:** Evidencia estática por lectura de la repetición más réplica `curl` de borrado bloqueado. Con dependencia existente, la respuesta es `409` con mensaje, pero agregar una dependencia exige editar el método, lo que demuestra la rigidez.

```text
curl -i -X DELETE http://localhost:3000/api/v1/groups/<id-con-matriculas> -H "Authorization: Bearer <admin>"
  -> 409 (correcto hoy, pero frágil al agregar dependencias)
grep -c "assertUnused" src/deletions/deletions.service.ts -> 12 coreografías gemelas (anómalo por repetición)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en convertir cada regla en una estrategia registrada, con un ejecutor común. El cambio se hace creando una interfaz `DeletionPolicy` con `checks()` y `delete()`, más un mapa por agregado. Primero se implementa una política por agregado que declara sus conteos bloqueantes. Después se deja un único método `remove(agregado, id)` que ejecuta existencia, bloqueos y borrado. Desde ese momento agregar una dependencia es agregar una entrada al mapa, sin tocar el ejecutor. La robustez viene de que la política queda declarativa y testeable por agregado.

**[Patrón Aplicado]:** Estrategia con factoría y mapa de políticas por agregado. Este patrón encaja aquí porque el defecto era la repetición condicional, y registrar estrategias convierte la extensión en adición sin modificación del flujo.

```ts
// BackendProyecto1_Fork/src/deletions/policies/deletion.policy.ts — listo para pegar (esquema)
export interface DeletionPolicy {
  name: string;
  mustExist(id: string): Promise<void>;
  blockers(id: string): Promise<Array<[Promise<number>, string]>>;
  remove(id: string): Promise<void>;
}
// + GroupPolicy, ProgramPolicy... registradas en un Map<string, DeletionPolicy>
// DeletionsService.remove(kind, id): mustExist -> assertUnused(blockers) -> remove
```

Tras el cambio, el borrado bloquea igual pero la regla vive en su política. Es robusto porque cada agregado declara lo que lo bloquea y el ejecutor no cambia.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Doce métodos repetían la misma coreografía con distintos conteos, dejando la política dispersa. La consecuencia encadenada era que cada nueva relación exigía cazar el método y rezar por no olvidar otro.

**[Cómo se replicaba]:**

1. `read src/deletions/deletions.service.ts` — doce `remove` gemelos, resultado observado: repetición.
2. `curl -i -X DELETE http://localhost:3000/api/v1/groups/<id-con-matriculas> -H "Authorization: Bearer <admin>"` — devuelve `409`, que es lo correcto hoy pero frágil.
3. Esperado tras el fix: mismo `409` con política registrada por agregado.

**[Cómo lo arregló]:** El mapa actúa como tabla de verdad que el ejecutor consulta por tipo, desacoplando qué se verifica de cómo se verifica. Al agregar una dependencia, se agrega una entrada sin tocar el flujo. La verificación se vuelve aditiva y auditable.

**[Argumento para el profesor]:** "Profesor, encontramos que el borrado seguro repite la misma coreografía en doce métodos, por lo que agregar una dependencia obliga a cazar el método y arriesga huérfanos. El impacto es medio pero estructural, porque la política vive dispersa. Aplicamos estrategia con mapa por agregado y ejecutor único, sin cambiar el `409` observado, con lo que extender es agregar una entrada. Lo evidenciamos con conteo de repeticiones y con `curl` de borrado bloqueado, mostrando lo correcto hoy frente a lo extensible esperado. Esto garantiza borrados auditables, extensiones sin tocar el flujo y dependencias que no se olvidan."
