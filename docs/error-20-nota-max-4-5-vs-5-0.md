# Backend Error #20 — Nota máxima `4.5` en DTO frente a documentación de `5.0` trunca calificaciones — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/grades/dto/grade.dto.ts:16 — UpsertGradeDto.value`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/grades/dto/grade.dto.ts:16 — propiedad value` con `@Max(4.5)` e `@IsNumber({ maxDecimalPlaces: 2 })`, frente a `@ApiProperty({ minimum: 0, maximum: 5 })` del mismo campo. Esta pieza es la frontera de calificaciones, porque el tubo valida antes de promediar, de modo que un techo menor al documentado recorta el mérito.

**[Síntoma Detectado]:** Hoy registrar `4.8` o `5.0`, que la documentación y la escala nacional permiten, devuelve `400 value must not be greater than 4.5`, aunque el docente y la evaluación lo avalan. El sistema hoy se comporta así: el docente digita la excelencia, el tubo la rechaza por techo, y el promedio nunca ve el tramo alto. Es incorrecto porque el contrato documentado promete `5.0` y el negocio de finales y becas depende de ese tramo, dejando una contradicción entre lo anunciado y lo exigido.

**[Gravedad / Impacto]:** La gravedad es media de nivel P2 porque recorta el escenario de excelencia, donde becas y promedios ponderados pierden décimas decisivas. No tumba el sistema, pero distorsiona justicia académica. Se viola el principio de contrato veraz entre documentación y validación y la regla de dominio que fija la escala de cero a cinco.

**Evidencia Postman:** Evidencia estática por lectura del DTO más réplica `curl` a `PUT /api/v1/grades` con valor alto y token docente. Con `4.8`, la respuesta es `400` por techo en lugar de `200` con la nota guardada.

```text
curl -i -X PUT http://localhost:3000/api/v1/grades -H "Authorization: Bearer <docente>"
  -H "Content-Type: application/json" -d '{"enrollment":"<id>","evaluation":"<id>","value":4.8}'
  -> 400 {"message":["value must not be greater than 4.5"]} (anómalo; esperado 200)
grep -n "Max" src/grades/dto/grade.dto.ts -> @Max(4.5) frente a ApiProperty maximum 5
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en igualar el techo exigido al techo documentado y de dominio, sin tocar la precisión. El cambio se hace en el DTO. Primero se sustituye `@Max(4.5)` por `@Max(5)` manteniendo `@Min(0)` y dos decimales. Después se verifica que el servicio de finales y promedios ya opera sobre cero a cinco, sin reescalados. Desde ese momento `5.0` pasa el tubo y el promedio refleja excelencia, mientras lo mayor a cinco sigue en `400`. La robustez viene de que documentación, validación y dominio comparten el mismo intervalo.

**[Patrón Aplicado]:** Intervalo de dominio único con documentación y validación alineadas. Este patrón encaja aquí porque el defecto era la divergencia de techos, y unificarlos elimina el recorte sin abrir la puerta a valores fuera de escala.

```ts
// BackendProyecto1_Fork/src/grades/dto/grade.dto.ts — listo para pegar
export class UpsertGradeDto {
  @ApiProperty({ description: 'ID de la matricula del estudiante' })
  @IsMongoId()
  enrollment!: string;

  @ApiProperty({ description: 'ID de la evaluacion' })
  @IsMongoId()
  evaluation!: string;

  @ApiProperty({ minimum: 0, maximum: 5, example: 4.2, description: 'Nota de 0.0 a 5.0 (maximo 2 decimales)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  // antes (mal): @Max(4.5); después (bien): @Max(5)
  value!: number;
}
```

Tras el cambio, `5.0` devuelve éxito y `5.01` sigue en `400`. Es robusto porque el intervalo queda cerrado y documentado en un solo lugar.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** El DTO anunciaba cinco pero exigía cuatro y medio, de modo que el tubo recortaba la excelencia antes de promediar. La consecuencia encadenada era promedios teñidos a la baja y docentes que subregistraban para evitar el error.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: DTO con `Max(4.5)`.
2. `curl -i -X PUT http://localhost:3000/api/v1/grades -H "Authorization: Bearer <docente>" -H "Content-Type: application/json" -d '{"enrollment":"<id>","evaluation":"<id>","value":4.8}'` — devuelve `400`, que es lo anómalo.
3. Esperado tras el fix: `200` con la nota persistida y promedios que contemplan el tramo alto.

**[Cómo lo arregló]:** El decorador actúa en el tubo comparando el valor contra el techo declarado. Al subirlo a cinco, los valores de excelencia pasan y el servicio los promedia sin reescalado. Lo fuera de escala sigue denegado, por lo que la frontera recupera su papel de guardián del intervalo.

**[Argumento para el profesor]:** "Profesor, encontramos que las notas se anunciaban hasta `5.0` pero se exigían hasta `4.5`, recortando la excelencia con `400` antes de promediar. El impacto es medio pero injusto, porque distorsiona becas y promedios. Aplicamos intervalo único de dominio, igualando la validación a la documentación en el DTO sin tocar el servicio, con lo que `5.0` pasa y lo mayor sigue denegado. Lo evidenciamos con lectura del DTO y con `curl` docente de `4.8`, mostrando el `400` anómalo frente al `200` esperado. Esto garantiza escala veraz, promedios justos y un contrato sin contradicciones."
