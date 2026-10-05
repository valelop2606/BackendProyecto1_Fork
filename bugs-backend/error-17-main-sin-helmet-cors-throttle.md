# Backend Error #17 — Arranque sin `helmet`, CORS restringido ni límite de tasa global — P1

**Subrepo:** `BackendProyecto1_Fork/` — **Archivo:** `src/main.ts:7 — bootstrap()`

## 1. Detección (forense)

**[Ruta Relativa y Línea]:** `BackendProyecto1_Fork/src/main.ts:7 — función bootstrap()` que crea la aplicación sin `helmet()`, sin `enableCors` con origen explícito y sin `ThrottlerModule`. Esta pieza es el perímetro del sistema, porque las cabeceras, el origen cruzado y la tasa se deciden antes de registrar rutas, de modo que su ausencia deja el perímetro en valores por defecto permisivos.

**[Síntoma Detectado]:** Hoy las respuestas incluyen `X-Powered-By: Express`, no fijan `Content-Security-Policy` ni `HSTS`, y aceptan cualquier origen si el cliente lo pide, además de no limitar reintentos globales. El sistema hoy se comporta así: el navegador recibe la pila tecnológica en la cabecera, cualquier sitio puede intentar llamadas con credenciales según la configuración del proxy, y un barrido masivo no encuentra freno en la puerta. Es incorrecto porque el perímetro debe ocultar la pila, declarar políticas de contenido y acotar origen y tasa por defecto denegado.

**[Gravedad / Impacto]:** La gravedad es alta de nivel P1 porque facilita reconocimiento y abuso en el escenario de exposición a internet del examen, donde el atacante enumera y golpea sin fricción. No filtra datos por sí solo, pero amplifica cualquier otro fallo. Se viola la guía de cabeceras seguras del estándar OWASP y el principio de configuración segura por defecto de los marcos NestJS y Express.

**Evidencia Postman:** Evidencia dinámica por cabeceras del `curl` vivo al prefijo sano, ya que Newman no aserta cabeceras. La respuesta a salud muestra `X-Powered-By` y ausencia de políticas, lo que demuestra el perímetro sin endurecer.

```text
curl -i http://localhost:3000/api/v1/health
  -> X-Powered-By: Express (anómalo; esperado ausente con helmet)
  -> sin content-security-policy, sin strict-transport-security (anómalo)
grep -n "helmet\|enableCors\|Throttler" src/main.ts src/app.module.ts -> sin resultados
```

## 2. Solución (fixer)

**[Solución Técnica]:** La idea del arreglo consiste en vestir el perímetro en el arranque con tres piezas complementarias. El cambio se hace en `main.ts` y `app.module.ts`. Primero se aplica `helmet()` tras crear la aplicación para ocultar la pila y fijar políticas. Después se habilita CORS con lista blanca de orígenes del frontend y se registra `ThrottlerModule` con ventana y máximo globales. Desde ese momento cada respuesta sale con cabeceras seguras, solo los orígenes declarados comparten credenciales y el abuso global recibe `429`. La robustez viene de que el perímetro se prueba una vez con `curl` de cabeceras para toda la superficie.

**[Patrón Aplicado]:** Perímetro seguro por defecto con cabeceras, lista blanca de origen y tasa global. Este patrón encaja aquí porque el defecto era la ausencia de las tres en el único punto de entrada, y agregarlas centraliza la protección sin tocar controladores.

```ts
// BackendProyecto1_Fork/src/main.ts — listo para pegar
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // antes (mal): sin perímetro; después (bien): perímetro explícito
  app.use(helmet());
  app.enableCors({ origin: ['http://localhost:3001'], credentials: true });
  app.setGlobalPrefix('api');
  // ... pipes y filtros ...
}
```

```ts
// BackendProyecto1_Fork/src/app.module.ts — fragmento listo para pegar
import { ThrottlerModule } from '@nestjs/throttler';
imports: [
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  // ... resto intacto ...
],
```

Tras el cambio, `X-Powered-By` desaparece, las políticas aparecen y el barrido masivo recibe `429`. Es robusto porque el perímetro queda declarativo y auditable en dos archivos.

## 3. Defensa (defensa)

**[Cómo estaba antes]:** La aplicación nacía sin casco de cabeceras, sin lista de orígenes y sin tasa, confiando en valores por defecto del marco. La consecuencia encadenada era reconocimiento fácil, intercambio cruzado sin acotar y abuso sin freno en la puerta.

**[Cómo se replicaba]:**

1. `JWT_SECRET="test-secret-supersecreto-1234567890" PORT=3000 node dist/main.js` — backend sano, resultado observado: arranque sin `helmet`.
2. `curl -i http://localhost:3000/api/v1/health` — muestra `X-Powered-By: Express` y sin políticas, que es lo anómalo.
3. Esperado tras el fix: sin `X-Powered-By`, con `content-security-policy` y CORS solo para el frontend.

**[Cómo lo arregló]:** El casco actúa como middleware previo que reescribe cabeceras de salida y valida origen y tasa antes de enrutar. Al registrarlo en el arranque, cada respuesta hereda la protección sin que los manejadores deban recordarla. El abuso se deniega en la frontera con `429`, antes de tocar servicios y base.

**[Argumento para el profesor]:** "Profesor, encontramos que el arranque no aplicaba casco de cabeceras, lista blanca de origen ni tasa global, exponiendo la pila y dejando abuso sin freno. El impacto es alto porque facilita reconocimiento y amplifica otros fallos. Aplicamos perímetro seguro por defecto, con `helmet`, CORS acotado al frontend y tasa global, en el arranque y el módulo raíz. Lo evidenciamos con `curl` a salud mostrando `X-Powered-By` y sin políticas frente a las cabeceras esperadas. Esto garantiza respuestas sin firma tecnológica, orígenes declarados y barridos contenidos en la puerta."
