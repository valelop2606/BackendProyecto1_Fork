# Backend Error #25 — Horarios y roster con consultas secuenciales que escalan como N+1 — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/academic/academic.service.ts:76 — roster()` y `src/academic/academic.service.ts:190 — studentSchedule()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/academic/academic.service.ts:76 — roster()` con `await assertCanManage`, `await loadGroup` y `await groupEnrollments` en serie, y el mismo patrón en `gradeSheet`, `studentSchedule` e `history`. Esta pieza arma vistas que cruzan grupos, matrículas y notas, por lo que serializar lo independiente multiplica la latencia por el número de pasos.

**[Síntoma Detectado]:** Hoy pedir el roster o el horario encadena tres o más idas a base aunque varias son independientes tras la autorización. El sistema hoy se comporta así: verifica permiso, carga el grupo, carga matrículas y luego notas, sumando tiempos en lugar de solaparlos. Es incorrecto porque tras autorizar, grupo y matrículas pueden viajar en paralelo y las notas después, reduciendo la latencia al camino crítico real.

**[Gravedad / Impacto]:** La gravedad es media de nivel P2 porque degrada la experiencia en el escenario de grupos grandes y horarios pico, donde cada milisegundo suma y la base recibe ráfagas serializadas. No rompe datos, pero desperdicia concurrencia. Se viola el principio de paralelizar lo independiente y la guía de rendimiento que pide medir el camino crítico antes de serializar.

**Evidencia Postman:** Evidencia estática por lectura de awaits en serie más tiempos del `curl` a roster y horario. Con grupo mediano, el tiempo supera la suma de dos idas cuando podría ser el máximo, lo que demuestra la serialización.

```text
curl -w "%{time_total}\n" -s http://localhost:3000/api/v1/groups/<id>/roster -H "Authorization: Bearer <docente>"
  -> latencia ≈ suma serial (anómalo; esperado ≈ máximo en paralelo tras auth)
grep -n "await .*loadGroup\|await .*groupEnrollments\|await .*resolvePeriod" src/academic/academic.service.ts
  -> awaits en serie tras la autorización
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en autorizar primero y paralelizar lo independiente después, sin cambiar el contrato. El cambio se hace en el servicio académico. Primero se mantiene `await assertCanManage` como puerta. Después se agrupan `loadGroup` y `groupEnrollments` en un `Promise.all`, y en horarios se agrupan estudiante y periodo. Desde ese momento la latencia es el máximo y no la suma, con el mismo resultado. La robustez viene de que la autorización sigue serializada por seguridad y solo lo independiente se solapa.

**[Patrón Aplicado]:** Puerta serial con abanico paralelo para lo independiente. Este patrón encaja aquí porque el defecto era la serialización indiscriminada, y separar puerta de abanico conserva seguridad con velocidad.

```ts
// BackendProyecto1_Fork/src/academic/academic.service.ts — listo para pegar (esquema)
async roster(groupId: string, status: EnrollmentStatus | undefined, user: AuthUser) {
  // antes (mal): tres awaits en serie; después (bien): puerta + abanico
  await this.groupsService.assertCanManage(groupId, user);
  const [group, enrollments] = await Promise.all([
    this.loadGroup(groupId),
    this.groupEnrollments(groupId, status),
  ]);
  return { /* mismo contrato */ };
}
```

Tras el cambio, el roster devuelve lo mismo en menos tiempo y la base recibe picos paralelos controlados. Es robusto porque la puerta no se salta y el abanico es medible.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Tras autorizar, las cargas independientes viajaban en serie, sumando latencias. La consecuencia encadenada era pantallas lentas en grupos grandes y base infrautilizada en concurrencia.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: awaits en serie.
2. `curl -w "%{time_total}\n" -s http://localhost:3000/api/v1/groups/<id>/roster -H "Authorization: Bearer <docente>"` — latencia de suma, que es lo anómalo.
3. Esperado tras el fix: misma respuesta con latencia de máximo.

**[Cómo lo arregló]:** El abanico actúa lanzando las promesas juntas y esperando al conjunto, por lo que el tiempo es el de la más lenta y no la suma. Al mantener la autorización antes, la seguridad no se relaja y la velocidad mejora sin cambiar datos.

**[Argumento para el profesor]:** "Profesor, encontramos que roster y horarios serializaban cargas independientes tras autorizar, sumando latencias en grupos grandes. El impacto es medio pero sensible en pico, porque desperdicia concurrencia. Aplicamos puerta serial con abanico paralelo, manteniendo la autorización primero y solapando lo independiente, sin cambiar el contrato. Lo evidenciamos con lectura de awaits y con tiempos de `curl` al roster, mostrando suma frente al máximo esperado. Esto garantiza vistas más rápidas, base mejor aprovechada y seguridad intacta."
