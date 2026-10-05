# Backend Error #26 — Etiqueta Swagger `deletions21312` con resto de prueba que ensucia la documentación — P2

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/deletions/deletions.controller.ts:11 — @ApiTags('deletions21312')`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/deletions/deletions.controller.ts:11 — decorador @ApiTags('deletions21312')` de `DeletionsController`. Esta pieza agrupa doce borrados en Swagger, que es la carta de presentación para el evaluador, de modo que un sufijo numérico de prueba degrada la confianza.

**[Síntoma Detectado]:** Hoy la documentación lista el grupo como `deletions21312` en lugar de `deletions`, mientras los controladores vecinos usan nombres limpios. El sistema hoy se comporta así: el evaluador abre `/api/doc`, ve el grupo corrupto y duda si el borrado es oficial o experimental. Es incorrecto porque las etiquetas son contrato visible y deben ser estables, sin restos de depuración.

**[Gravedad / Impacto]:** La gravedad es media-baja de nivel P2 porque no rompe ejecución, pero sí percepción en el escenario de evaluación con Swagger abierto, donde cada detalle cuenta. Además dificulta filtrar por etiqueta en clientes generados. Se viola el principio de documentación veraz y la convención de nombres estables de la interfaz.

**Evidencia Postman:** Evidencia estática por lectura de la etiqueta más captura de Swagger vivo, ya que Newman no aserta etiquetas. En `/api/doc`, el grupo aparece como `deletions21312` en lugar de `deletions`.

```text
curl -s http://localhost:3000/api/doc | grep -o "deletions21312" -> aparece (anómalo; esperado deletions)
grep -n "ApiTags" src/deletions/deletions.controller.ts -> deletions21312
Swagger GET http://localhost:3000/api/doc -> 200 con grupo corrupto visible
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en devolver a la etiqueta su nombre canónico en un literal. El cambio se hace en el controlador. Primero se sustituye `'deletions21312'` por `'deletions'`. Después se recarga Swagger y se verifica el grupo. Desde ese momento los doce borrados cuelgan del grupo oficial y los clientes generados los agrupan bien. La robustez viene de que el nombre queda en un solo lugar y cualquier resto futuro se detecta en la revisión de etiquetas.

**[Patrón Aplicado]:** Documentación como contrato con nombres canónicos. Este patrón encaja aquí porque el defecto era léxico visible, y corregirlo alinea lo servido con lo esperado sin tocar lógica.

```ts
// BackendProyecto1_Fork/src/deletions/deletions.controller.ts — listo para pegar
// Eliminacion segura: se rechaza (409) si otros registros dependen del que se quiere borrar
@ApiTags('deletions')
@ApiBearerAuth()
@Controller()
export class DeletionsController {
  // manejadores sin cambios
}
```

Tras el cambio, Swagger muestra `deletions` y los doce borrados se agrupan. Es robusto porque la etiqueta vuelve a ser filtrable y estable.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La etiqueta arrastraba un sufijo numérico de prueba, dejando el grupo de borrados con nombre corrupto. La consecuencia encadenada era documentación que parecía experimental aunque la funcionalidad era oficial.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: etiqueta corrupta.
2. `curl -s http://localhost:3000/api/doc | grep -o "deletions21312"` — aparece, que es lo anómalo.
3. Esperado tras el fix: `deletions` en Swagger y clientes generados.

**[Cómo lo arregló]:** El literal actúa como clave de agrupación que Swagger usa para ordenar. Al corregirlo, los doce manejadores se reagrupan bajo el nombre oficial sin mover código. La documentación y el código vuelven a decir lo mismo.

**[Argumento para el profesor]:** "Profesor, encontramos que el grupo de borrados se etiquetaba como `deletions21312`, mostrando un resto de prueba en la documentación oficial. El impacto es medio en percepción, porque el evaluador duda de lo oficial. Aplicamos nombre canónico en la etiqueta, sin tocar manejadores, con lo que los doce borrados se agrupan bien. Lo evidenciamos con lectura de la etiqueta y con Swagger vivo mostrando el grupo corrupto frente al limpio esperado. Esto garantiza documentación veraz, grupos filtrables y una presentación sin restos."
