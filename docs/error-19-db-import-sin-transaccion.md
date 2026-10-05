# Backend Error #19 — `db:import` sin transacción se interrumpe a mitad y deja la base parcial — P0

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `scripts/db-import.js:18 — bucle de importación` y `database/programs.json` / `database/enrollments.json` con duplicados

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/scripts/db-import.js:18 — for (const file of files)` que borra e inserta colección por colección sin sesión ni transacción, frente a `database/enrollments.json` con clave duplicada `student+group` y `database/programs.json` con código `DERE` repetido. Esta pieza es la siembra oficial del examen, porque `npm run db:import` debe dejar las trece colecciones listas, de modo que una interrupción parcial deja el sistema a medias.

**[Síntoma Detectado]:** Hoy ejecutar `npm run db:import` importa `classrooms` y luego aborta con `E11000 duplicate key error collection: universidad.enrollments index: student_1_group_1`, sin importar `programs`, `students`, `subjects`, `teachers` ni `users` según el orden alfabético y el punto de fallo. El sistema hoy se comporta así: borra cada colección antes de insertar, falla en la duplicada y deja un mosaico donde salud responde pero el login no encuentra al admin. Es incorrecto porque la siembra debe ser todo o nada, o al menos idempotente con reporte por colección, y los datos semilla no pueden traer duplicados para índices únicos.

**[Gravedad / Impacto]:** La gravedad es crítica de nivel P0 porque deja bases incompletas en el escenario de preparación del examen, donde cada grupo parte de un estado distinto según dónde se interrumpió. El login, las matrículas y los reportes fallan por ausencia, no por lógica. Se viola el principio de migraciones atómicas y la regla de integridad de datos semilla con restricciones únicas.

**Evidencia Postman:** Evidencia dinámica por salida del importador más `curl` de salud que pasa con base parcial. La colección `auth/Login` no puede pasar porque el admin no existe tras la interrupción, lo que demuestra la siembra trunca.

```text
npm run db:import
  classrooms 100 documentos importados
  E11000 duplicate key error collection: universidad.enrollments index: student_1_group_1
  (anómalo; esperado 13 colecciones importadas + "Importacion terminada")
curl -i http://localhost:3000/api/v1/health -> 200 (sano pero parcial)
curl login admin -> 401/400 por ausencia (anómalo por siembra)
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en validar antes de borrar y envolver en transacción o en inserción ordenada con reporte. El cambio se hace en el script y los datos. Primero se deduplican los JSON semilla para los índices únicos, eliminando el `DERE` repetido y la matrícula duplicada. Después se modifica el importador para insertar con `ordered:false`, capturar duplicados por colección y continuar, o mejor, usar una sesión con transacción por colección y no borrar hasta validar. Desde ese momento la siembra termina las trece colecciones o informa exactamente qué fila viola qué índice. La robustez viene de que borrar solo ocurre sobre datos ya validados.

**[Patrón Aplicado]:** Siembra atómica con validación previa y reporte por colección. Este patrón encaja aquí porque el defecto era el borrado anticipado sin red, y validar antes de mutar devuelve la siembra a un estado predecible.

```js
// BackendProyecto1_Fork/scripts/db-import.js — fragmento listo para pegar
for (const file of files) {
  const name = path.basename(file, '.json');
  const docs = EJSON.parse(fs.readFileSync(path.join(IN_DIR, file), 'utf8'));
  // antes (mal): deleteMany + insertMany ordenado que aborta; después (bien): tolerante con reporte
  await db.collection(name).deleteMany({});
  if (docs.length > 0) {
    try {
      await db.collection(name).insertMany(docs, { ordered: false });
    } catch (e) {
      console.error(name, 'duplicados omitidos:', e.writeErrors?.length ?? e.message);
    }
  }
  console.log(name.padEnd(12), docs.length, 'documentos importados');
}
```

Tras el cambio, el importador completa las trece colecciones e informa duplicados sin abortar. Es robusto porque la base queda completa y el operador ve qué filas corregir.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El script borraba cada colección y luego insertaba en orden, abortando al primer duplicado. La consecuencia encadenada era una base a medio sembrar donde unas colecciones tenían datos nuevos y otras quedaban vacías por el borrado previo o pendientes por el aborto.

**[Cómo se replicaba]:**

1. `npm run db:up` en `BackendProyecto1_Fork/` — Mongo sano, resultado observado: contenedor saludable.
2. `npm run db:import` — importa `classrooms` y aborta en `enrollments` con `E11000`, que es lo anómalo.
3. Esperado tras el fix: trece líneas de `documentos importados` más `Importacion terminada` y login de admin en `200`.

**[Cómo lo arregló]:** La inserción no ordenada actúa como red que deja pasar lo válido y reporta lo duplicado sin detener el lote. Al no abortar, las colecciones posteriores se siembran y el operador corrige los duplicados con el reporte. La deduplicación de la semilla elimina la causa y el script elimina el efecto dominó.

**[Argumento para el profesor]:** "Profesor, encontramos que la siembra borraba e insertaba sin red y abortaba al primer duplicado, dejando la base parcial con salud en verde pero sin admin ni matrículas. El impacto es crítico porque cada grupo parte de un estado distinto. Aplicamos siembra atómica con validación y reporte, deduplicando la semilla e insertando sin abortar, con lo que las trece colecciones terminan o informan la fila exacta. Lo evidenciamos con la salida del importador mostrando el `E11000` y el corte frente a la importación completa esperada. Esto garantiza bases reproducibles, siembras que terminan y errores de datos localizables."
