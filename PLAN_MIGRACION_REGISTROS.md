# Plan de Migración — Fusionar "registros" dentro de ChefManager

> Plan por fases para absorber la app **chefmanager-registros** (Hono + Drizzle + JS vanilla) dentro de **chefmanager-inv** (Next.js + Prisma + React), como módulo interno.
> Estado: **propuesta**. No se ha tocado código de producción.

---

## Premisas (acordadas)

1. **Aislamiento total**: la app de inventario que ya funciona **no se rompe** en ningún momento. El trabajo va en una **rama/worktree** y el módulo nuevo permanece **oculto** (sin enlace en el menú) hasta el swap final.
2. **Swap al final**: cuando el módulo esté validado, se "cambia una por otra" — se activa el módulo interno y se apaga la app vieja de registros.
3. **Sin migración de datos**: la app de registros está en **fase de pruebas, sin datos reales**. El módulo nuevo arranca **vacío** (solo un seed mínimo). → elimina el mayor riesgo y simplifica todo.

---

## Estrategia de aislamiento (por qué no rompe nada)

- Todo el trabajo ocurre en una **rama** (o `git worktree`) de `chefmanager-inv`; `main`/producción intactos.
- Las únicas adiciones al proyecto son **aditivas**: tablas Prisma **nuevas** y rutas **nuevas** (`/registros`, `/api/registros/*`). No se modifica ni una tabla ni una ruta existente.
- El módulo **no aparece en el menú** hasta el swap → aunque se desplegara, nadie lo ve.
- La **app vieja de registros sigue viva** en su Railway hasta que el módulo nuevo esté confirmado. El SSO actual sigue funcionando mientras tanto.
- **Swap (fase final)**: se cambia el botón "Registros APPCC" del menú para que apunte al módulo interno en vez del SSO externo, y se apaga la app vieja + su base de datos.

> Resultado: en cada punto del proceso o bien todo sigue como hoy, o el cambio es invisible hasta que tú decides activarlo.

---

## Decisiones de modelo de datos

Como arrancamos **vacíos**, podemos diseñar el modelo bien desde el principio. Mapeo propuesto:

| Entidad en registros | Decisión en ChefManager |
|---|---|
| `users` (owner/superadmin) | **Reutilizar `Usuario`** (NextAuth). Se elimina el login propio de registros y el SSO. Los roles se mapean a los de ChefManager |
| `locations` (local + PIN) | **Reutilizar `Unidad`** (ya es el "local"). El PIN ya existe a nivel de usuario en ChefManager |
| `products` (alérgenos, shelfDays, ingredientes) | **Entidad propia nueva** (p. ej. `RegistroProducto`). Es distinto del `Producto` de compras; fusionarlos se evalúa **después**, no ahora |
| `chambers`, `temperatureRecords`, `doughTypes`, `doughRecords`, `checklistItems`, `checklistRecords`, `labelRecords` | **Tablas nuevas** en Prisma, todas con `tenantId` y `unidadId` |

> Todas las tablas nuevas llevan `tenantId` desde el día 1 → multi-tenant nativo, algo que la app vieja no tenía.

---

## Fases

### Fase 0 — Preparación
- Crear rama/worktree de `chefmanager-inv`.
- Inventariar las pantallas del SPA de registros (temperaturas, masas, checklists, etiquetas, informes, admin, config) y sus endpoints.
- Confirmar el mapeo de modelo de la tabla anterior.
- **Entregable:** rama lista + mapeo cerrado. **Riesgo:** nulo.

### Fase 1 — Modelo de datos (Prisma)
- Añadir las tablas nuevas al `schema.prisma` (aditivo, con `tenantId`/`unidadId`).
- `prisma migrate` (solo crea tablas nuevas; no toca nada existente).
- Seed mínimo para pruebas.
- **Entregable:** schema unificado. **Riesgo:** bajo (migración aditiva).

### Fase 2 — Backend (Hono → API routes de Next)
- Portar cada router (`temperaturas`, `masa`, `checklists`, `etiquetas`, `informes`, `config`, `admin`) a `app/api/registros/*` con Prisma y sesión NextAuth.
- Extraer la **lógica de negocio pura** (cálculos de masa/hidratación, generación de etiquetas/PDF) a `lib/registros/` — es agnóstica y se reutiliza casi tal cual.
- **Entregable:** API interna funcional. **Riesgo:** medio (reescritura, pero con la app vieja como referencia viva).

### Fase 3 — Frontend (vanilla → React)
- Reescribir las pantallas del `index.html` como componentes React bajo `app/(dashboard)/registros/`.
- Reutilizar el **layout, diseño y componentes UI** de ChefManager (no se recrean).
- Sinergias: ChefManager ya tiene `qr-scanner` y la dependencia `qrcode`; para PDF se añade `jspdf` como dependencia npm (en vez del CDN).
- **Entregable:** UI del módulo. **Riesgo:** medio (es el grueso del trabajo manual).

### Fase 4 — Auth y navegación
- Integrar acceso por **rol** (definir qué roles ven `/registros`).
- Añadir la entrada al menú **detrás de un flag/oculta** todavía.
- Preparar (sin activar) el reemplazo del SSO.
- **Entregable:** módulo accesible internamente para pruebas. **Riesgo:** bajo.

### Fase 5 — QA en paralelo
- Probar cada pantalla contra la app vieja (que sigue viva): temperaturas, masas, checklists, etiquetas (QR/PDF), informes, admin.
- Verificar PWA/offline y el service worker unificado.
- **Entregable:** módulo validado. **Riesgo:** medio (APPCC es cumplimiento → QA exigente).

### Fase 6 — Swap ("cambiar una por otra")
- Activar la entrada "Registros APPCC" del menú apuntando al módulo interno `/registros`.
- Retirar el SSO HMAC y las variables `CROSS_APP_*`.
- Apagar la app vieja `chefmanager-registros` y su base de datos.
- **Entregable:** una sola app. **Riesgo:** bajo (reversible: basta revertir el enlace del menú).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper la app de inventario | Todo aditivo + en rama + módulo oculto hasta el swap |
| Regresión funcional en APPCC | QA en paralelo con la app vieja viva como referencia (Fase 5) |
| Service worker / caché PWA | Unificar SW con cuidado; probar offline antes del swap |
| Reescritura del frontend | Es el grueso, pero registros es pequeña (~6 pantallas) |
| Roles/permisos mal mapeados | Cerrar el mapeo de roles en Fase 0 |

## Lo que ya NO es un riesgo (gracias a empezar vacío)
- ❌ Migración de datos de producción.
- ❌ Downtime por traspaso de datos.
- ❌ Pérdida de registros sanitarios reales.

---

## Evaluación actualizada

| Dimensión | Antes | Ahora (vacío + aislado) |
|---|---|---|
| Complejidad de la migración | 7/10 | **~5/10** |
| Riesgo sobre lo que funciona | Medio | **Bajo** |
| Resultado final | 9/10 | **9/10** |

**Recomendación de momento:** abordarlo **después** de cerrar las pendientes de comercialización (datos legales, H-6), o en paralelo si hay capacidad. El orden de fases permite parar en cualquier punto sin dejar nada roto.

---

*Documento de planificación. No constituye un compromiso de implementación.*
