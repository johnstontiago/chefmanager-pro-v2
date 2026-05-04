# Plan de mejoras `chefmanager-inv` — Prompt para Claude Code (v2 final)

> Copia todo lo que está debajo de la línea y pégalo en Claude Code dentro de la carpeta del repo.

---

Hola Claude. Vas a trabajar sobre el repositorio **chefmanager-inv** (Next.js 14 + Prisma + NextAuth + PostgreSQL + Tailwind/shadcn, desplegado en Railway).

Vas a aplicar **4 fases en orden estricto**. No avances sin que yo te confirme la fase anterior. Una rama por fase, un PR por fase.

## Antes de empezar

1. Lee `package.json`, `schema.prisma`, `next.config.js`, `RAILWAY_DEPLOY.md`, `middleware.ts` (si existe) y la estructura de carpetas completa.
2. Identifica concretamente:
   - Cómo está configurado NextAuth.
   - Dónde está el componente del lector QR actual y qué librería usa (`@zxing/browser`, `html5-qrcode`, o `getUserMedia` custom).
   - Estructura de los modelos `pedido`, `pedido_linea` (o `pedido_item`), `producto`, `movimiento`.
   - Si ya existe alguna pantalla de "recepción de pedidos" aunque esté incompleta.
3. Hazme un **resumen breve** de lo que encontraste antes de tocar código.

---

## FASE 1 — SEGURIDAD (CRÍTICA, va primero)

Detecté que `.env` está commiteado al repo público. Eso expone credenciales reales.

### 1.1 Auditar qué secretos se filtraron
- Lee `.env` y lista (sin imprimir los valores) qué claves están expuestas.
- Marca cuáles requieren rotación inmediata: `DATABASE_URL`, `NEXTAUTH_SECRET`, cualquier API key.

### 1.2 Sacar `.env` del repo
- Crear/actualizar `.gitignore` con: `.env`, `.env.local`, `.env*.local`, `*.pem`, `.DS_Store`, `node_modules`, `.next`.
- Crear `.env.example` con todas las claves pero **sin valores**.
- Quitar `.env` del tracking: `git rm --cached .env`.
- Avísame para que yo **rote los secretos en Railway** antes del próximo deploy.
- Ofréceme el comando para reescribir el historial con `git-filter-repo` (no lo ejecutes sin mi OK).

### 1.3 Endurecer auth y proteger rutas
- Crear/revisar `middleware.ts` en raíz que proteja: `/dashboard`, `/pedidos`, `/categorias`, `/movimientos`, `/reportes`, `/usuarios`. Solo usuarios autenticados.
- Si hay roles (admin vs operador), aplica autorización por rol.
- Verifica que las server actions y rutas `/api` revaliden sesión **server-side**, no solo en cliente.

### 1.4 Rate limiting y hardening
- Rate limiting a login/signup (Upstash Redis o middleware in-memory para empezar).
- Verificar que `bcryptjs` use cost factor ≥ 10.
- Headers de seguridad en `next.config.js` (CSP básica, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin).
- Validar **todos** los inputs server-side con Zod antes de tocar la base de datos.

**Confirmación Fase 1:** resumen de cambios + checklist de qué tengo que rotar manualmente en Railway. **No sigas a Fase 2** sin mi OK.

---

## FASE 2 — DESBLOQUEO OPERATIVO (lo que necesito que funcione ya)

Estas 3 cosas me están bloqueando el día a día. Van antes que el refactor estructural.

### 2.1 Arreglar el lector QR — "no abre la cámara"

**Diagnóstico primero, parche después.** No reescribas el componente entero sin entender por qué falla el actual.

1. Localiza el componente del scanner en el código y qué librería está usando.
2. Verifica en este orden y **repórtame el resultado de cada paso** antes de tocar nada:
   - ¿La página se sirve por HTTPS? `getUserMedia` no funciona en HTTP excepto en `localhost`. Confirma que el dominio de Railway / dominio custom fuerce HTTPS.
   - ¿El componente realmente se monta? Añade un `console.log` al inicio del componente y al `useEffect` que pide la cámara.
   - ¿Se llama a `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`? El `facingMode: 'environment'` es clave en móvil — `'user'` abre la cámara frontal.
   - ¿Qué error devuelve el navegador exactamente? Captura y muestra el `error.name`:
     - `NotAllowedError` → permisos denegados.
     - `NotFoundError` → sin cámara detectada.
     - `NotReadableError` → otra app está usando la cámara.
     - `OverconstrainedError` → constraints inválidos.
     - `SecurityError` → contexto inseguro (HTTP).
   - ¿El elemento `<video>` existe en el DOM antes de asignarle `srcObject`? Un orden mal en el render lo rompe.
3. **Después del diagnóstico**, propón el fix mínimo y muéstramelo antes de aplicar.
4. Añadir un **fallback claro**: si la cámara falla, mostrar input manual del código + un mensaje tipo "Activa los permisos de cámara en los ajustes del navegador" con instrucciones por sistema (iOS Safari, Android Chrome).
5. Probar en: Chrome desktop, Safari iOS, Chrome Android. No marcar como "fixed" hasta que funcione en los 3.

### 2.2 Flujo de recepción de pedidos — ítem por ítem

**Comportamiento exacto:**

- Al abrir un pedido en estado `pendiente` o `en_recepcion`, veo la lista de productos pedidos.
- Cada línea muestra: nombre del producto, cantidad pedida, y botón "Confirmar recepción".
- Al pulsar confirmar de una línea, se abre un mini-form (Drawer en móvil con `vaul`) que pide:
  - **Cantidad recibida** (numérico, default = cantidad pedida).
  - **Lote** (texto).
  - **Fecha de caducidad** (date picker).
  - Opción de **escanear QR** para autocompletar el producto (usa el lector ya arreglado en 2.1).
- Al guardar la línea:
  - Se crea un `movimiento` tipo `entrada` con cantidad, lote, fecha de caducidad, usuario y referencia al `pedido_linea_id`.
  - Se suma `cantidad_recibida` al stock del producto.
  - La línea queda **visible pero tachada/marcada como recibida** (icono verde + `line-through` + badge "Recibido"). No editable después.
  - Si `cantidad_recibida < cantidad_pedida`, marca la línea como `parcial`.
- Cuando se procesan todas las líneas:
  - Si hay líneas parciales o no recibidas, muestra resumen y pregunta: **"¿Generar pedido pendiente con lo que falta?"**.
  - Si confirmo, crea un nuevo `pedido` en estado `pendiente` con las cantidades faltantes (`cantidad_pedida - cantidad_recibida`) y lo enlaza con `parent_pedido_id` apuntando al pedido original.
  - El pedido original pasa a `recibido` (si todo entró completo) o `recibido_parcial` (si hubo faltantes).

**Cambios de schema (probables):**

- `pedido_linea`: añadir `cantidad_recibida` (Int, default 0), `lote` (String?), `fecha_caducidad` (DateTime?), `fecha_recepcion` (DateTime?), `recibido_por_id` (relación a User), `estado_linea` (enum: `pendiente`, `recibida`, `parcial`).
- `pedido`: añadir `parent_pedido_id` (relación opcional al mismo modelo) y actualizar enum de estado para incluir `recibido_parcial`.
- `producto`: si no tiene `qrcode` (String, unique), añadirlo.

**Antes de migrar:** muéstrame el diff del schema y los nombres exactos que vas a usar (mantén la convención de español/inglés ya presente en el repo). Espera mi OK antes de correr `prisma migrate dev`.

### 2.3 Exportar CSV del pedido recibido

- Botón "Exportar CSV" en la pantalla de detalle del pedido, visible cuando el pedido está en estado `recibido` o `recibido_parcial`.
- Columnas exactas en este orden:
  1. `Nombre producto`
  2. `Fecha caducidad`
  3. `Lote`
  4. `qrcode`
  5. `Cantidad`
- Usar `Cantidad` = `cantidad_recibida` (lo que entró realmente).
- Una fila por `pedido_linea` recibida. Saltar las líneas en estado `pendiente` o no recibidas.
- Codificación **UTF-8 con BOM** (`\uFEFF` al inicio) para que Excel abra bien acentos y "ñ".
- Separador: punto y coma (`;`) — es lo estándar en Excel español. Escapar correctamente comillas y saltos de línea dentro de campos.
- Fecha en formato `DD/MM/YYYY`.
- Nombre del archivo: `pedido-{id_o_numero}-{YYYY-MM-DD}.csv`.
- Generación **server-side** (route handler en `/api/...` o server action con `Response`), descarga forzada con `Content-Disposition: attachment; filename="..."`.

**Confirmación Fase 2:** demo corta (video o GIF) de los 3 flujos funcionando en móvil real. Espera mi OK.

---

## FASE 3 — ESTRUCTURA, PERFORMANCE Y CALIDAD DE CÓDIGO

Hay rarezas: carpetas `/categorias`, `/pedidos`, `/movimientos`, `/reportes`, `/usuarios`, `/signup`, `/auth` en raíz fuera de `/app`. Existe `schema.prisma` en raíz **y** carpeta `/prisma`. El build script tiene `rm -rf node_modules/.prisma` que parece workaround.

### 3.1 Reorganizar estructura
- Auditar si las carpetas en raíz son rutas duplicadas o residuos. Si son rutas activas, moverlas a `/app/(dashboard)/...`.
- Consolidar `schema.prisma` en `/prisma/schema.prisma` como fuente única.
- Limpiar build script: `"build": "prisma generate && next build"` (sin `rm -rf` salvo que demuestres que sigue siendo necesario).
- Paths en `tsconfig.json` para imports limpios: `@/components`, `@/lib`, `@/hooks`.

### 3.2 Performance
- Convertir a **Server Components** lo que no necesita ser cliente (la mayoría de listados de inventario).
- Streaming + Suspense con `loading.tsx` por ruta.
- `error.tsx` por ruta para error boundaries.
- Cache de queries Prisma de catálogos estáticos con `unstable_cache` o React `cache`.
- Paginación cursor-based para `movimientos` y `pedidos` cuando crezcan las listas.
- `next/image` en todos los lugares con imágenes.

### 3.3 Calidad de código
- ESLint estricto + Prettier con `husky` + `lint-staged`.
- Validación Zod compartida client/server para todos los formularios.
- Tipar correctamente todas las server actions (cero `any`).
- Mover lógica de negocio a `/lib/services/` (pedidos, inventario, reportes), fuera de los componentes.
- README.md con instrucciones de instalación, variables de entorno, comandos y deploy.

### 3.4 CI básico
- GitHub Action que corra `typecheck`, `lint`, `build` en cada PR.
- (Opcional) Tests con Vitest para lógica crítica (cálculo de stock, recepción parcial, generación del pedido pendiente).

**Confirmación Fase 3:** diff resumido + benchmarks antes/después si los puedes medir.

---

## FASE 4 — UX EXTRA Y FUNCIONALIDADES SECUNDARIAS

(Una vez que lo crítico funciona.)

### 4.1 Mobile-first review
- Auditar pantallas en viewport 375px.
- Botones tactiles mínimo 44×44px.
- `inputMode="numeric"` o `"decimal"` en inputs numéricos.
- Drawer (`vaul`) en móvil en lugar de Dialog para flujos de edición.
- Sticky header con la acción primaria siempre visible.

### 4.2 Alertas de stock bajo
- Añadir `stock_minimo` a `producto` + migración.
- Widget "Productos bajo mínimo" en rojo en el dashboard.
- Badge con contador en sidebar.

### 4.3 Búsqueda rápida + filtros
- Cmd+K global con `cmdk` (ya instalado): productos, pedidos, movimientos.
- Filtros guardados en URL (`searchParams`) para que sean compartibles.

### 4.4 Pulido visual
- Modo oscuro persistente (`next-themes` ya está, verifica que persista entre sesiones).
- Toasts consistentes con `sonner`.
- Estados vacíos con CTA claro ("aún no hay productos → Añadir primer producto").

---

## REGLAS DE TRABAJO

- **Una rama por fase**, un PR por fase con descripción clara.
- Commits atómicos con conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- **No instales librerías** sin avisarme antes qué resuelven, peso y alternativas.
- Para acciones destructivas (migraciones, borrar archivos, reescribir historial git): pide confirmación explícita.
- Si encuentras algo más grave que lo que listé, **dímelo antes de seguir el plan**.
- Si una solución requiere romper compatibilidad con datos existentes en producción, **plan de migración primero**, ejecución después.
