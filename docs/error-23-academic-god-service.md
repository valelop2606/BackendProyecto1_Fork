# Backend Error #23 — `AcademicService` como Dios que concentra horarios, promedios y finales — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/academic/academic.service.ts:58 — clase AcademicService`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/academic/academic.service.ts:58 — clase con roster(), gradeSheet(), finalizeGroup(), studentSchedule(), teacherSchedule(), history(), curriculum(), progress() y availableGroups()`. Esta pieza cruza grupos, matrículas, notas y horarios, por lo que concentrar nueve responsabilidades la vuelve frágil al cambio.

**[Síntoma Detectado]:** Hoy cualquier ajuste de horarios obliga a tocar el mismo archivo que calcula promedios y finales, con riesgo de romper lo no tocado. El sistema hoy se comporta así: el servicio inyecta seis modelos y cuatro servicios, mezcla consultas pobladas con reglas de negocio y deja pruebas que deben levantar todo para verificar una sola regla. Es incorrecto porque cada responsabilidad merece su módulo con interfaz, y el archivo supera largamente el umbral de cambio único.

**[Gravedad / Impacto]:** La gravedad es media de nivel P2 porque no tumba hoy, pero encarece cada cambio en el escenario de evolución del examen, donde cada grupo toca una esquina distinta y choca en el mismo archivo. Además impide mocks finos en pruebas. Se viola el principio de responsabilidad única del diseño SOLID y la guía de NestJS de servicios acotados por agregado.

**Evidencia Postman:** Evidencia estática por conteo de responsabilidades y acoplamientos, ya que el síntoma es de mantenimiento. El archivo supera 500 líneas con nueve operaciones públicas y múltiples modelos, lo que demuestra la concentración.

```text
grep -c "async .*(" src/academic/academic.service.ts -> 9 operaciones públicas
grep -n "private readonly.*Model\|private readonly.*Service" src/academic/academic.service.ts
  -> 6 modelos + 4 servicios inyectados (anómalo por concentración)
curl de humo a /students/me/schedule y /groups/:id/finalize -> 200 pero desde el mismo Dios
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en partir por agregado sin cambiar rutas, dejando fachadas delgadas. El cambio se hace creando tres servicios: `ScheduleService` para horarios, `ProgressService` para malla e historial, y `FinalizationService` para planillas y cierres. Primero se mueve cada método con sus privados de carga a su nuevo servicio. Después se deja `AcademicService` como fachada que delega o se eliminan las delegaciones y el controlador inyecta los tres. Desde ese momento cada cambio toca un archivo y cada prueba levanta un agregado. La robustez viene de que las interfaces permiten mocks por agregado.

**[Patrón Aplicado]:** Descomposición por responsabilidad única con fachada de compatibilidad. Este patrón encaja aquí porque el defecto era la concentración, y partir por agregado devuelve cambios locales sin romper rutas.

```ts
// BackendProyecto1_Fork/src/academic/schedule.service.ts — listo para pegar (esquema)
@Injectable()
export class ScheduleService {
  constructor(/* solo modelos de grupos+matrículas y servicios de alumnos/docentes */) {}
  studentSchedule(studentId: string | null, userId: string | null, periodId?: string) { /* movido */ }
  teacherSchedule(teacherId: string | null, userId: string | null, periodId?: string) { /* movido */ }
}
// ProgressService: history, progress, curriculum, availableGroups
// FinalizationService: roster, gradeSheet, finalizeGroup
```

Tras el cambio, el controlador delega a tres servicios acotados y las pruebas mockean por agregado. Es robusto porque el cambio deja de propagarse a lo no tocado.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** Nueve operaciones vivían en una clase con diez dependencias, mezclando lectura poblada con reglas de cierre. La consecuencia encadenada era merges en conflicto, pruebas pesadas y miedo a tocar horarios por romper finales.

**[Cómo se replicaba]:**

1. `read src/academic/academic.service.ts` — nueve públicos y diez inyecciones, resultado observado: Dios.
2. Cambiar un detalle de horario y correr pruebas de finales — riesgo de romper lo no tocado, que es lo anómalo de diseño.
3. Esperado tras el fix: tres servicios con pruebas por agregado y fachada delgada.

**[Cómo lo arregló]:** La partición actúa separando razones de cambio por agregado, de modo que cada servicio solo cambia cuando su regla cambia. Al delegar, el controlador no nota la diferencia pero las pruebas sí, porque cada agregado se mockea. El acoplamiento baja y la evolución se vuelve local.

**[Argumento para el profesor]:** "Profesor, encontramos que el servicio académico concentra nueve operaciones con diez dependencias, mezclando horarios con finales en un solo archivo. El impacto es medio pero con costo creciente, porque cada cambio arriesga lo no tocado e impide mocks finos. Aplicamos responsabilidad única, partiendo en horarios, progreso y finalización con fachada compatible, sin cambiar rutas. Lo evidenciamos con conteo de operaciones y dependencias frente a los tres agregados esperados. Esto garantiza cambios locales, pruebas por agregado y evolución sin miedo."
