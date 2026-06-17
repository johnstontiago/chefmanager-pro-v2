# Verificación de Cumplimiento UE — Auditoría Técnica

> Auditoría técnica de protección de datos (RGPD) y seguridad del ecosistema ChefManager, como paso previo a la comercialización por suscripción.
> Fecha de la auditoría: junio 2026 · Alcance: las dos aplicaciones del sistema.

> ⚠️ **Aviso:** este documento es una auditoría **técnica**, no asesoramiento jurídico. Las conclusiones deben revisarse con un profesional legal antes de publicar políticas o firmar contratos. Sirve para tener el 90% del trabajo hecho y llegar al abogado con los deberes hechos.

---

## 1. Resumen ejecutivo

El sistema parte de una **base técnica sólida** para el RGPD: contraseñas cifradas, control de acceso por roles, cabeceras de seguridad, sin rastreadores de terceros y muy poca información personal (solo cuentas de usuario; los registros son datos operativos, no de clientes finales).

Los puntos a resolver **antes de comercializar** no son fallos graves de código, sino **piezas de cumplimiento documental y de infraestructura**: confirmar la región del hosting y firmar su contrato (DPA), publicar la política de privacidad y el aviso legal, y habilitar un procedimiento para los derechos de los usuarios (acceso y supresión real).

**Veredicto:** comercializable con un esfuerzo **acotado y de bajo riesgo técnico**, una vez completadas las acciones de la [sección 7](#7-plan-de-acción-antes-de-comercializar).

---

## 2. Alcance y arquitectura

El sistema lo forman **dos aplicaciones independientes** que comparten usuarios mediante inicio de sesión cruzado:

| | **ChefManager (inv)** | **chefmanager-registros** |
|---|---|---|
| Función | Inventario, pedidos, fichas, consumo | Registros APPCC (temperaturas, masas, checklists, etiquetas) |
| Tecnología | Next.js + Prisma + PostgreSQL | Hono + Drizzle + PostgreSQL |
| Hosting | Railway | Railway |
| Base de datos | PostgreSQL (Railway) | PostgreSQL (Railway) |

**Conexión entre ambas (SSO):** ChefManager genera una URL firmada con HMAC-SHA256 (email + marca de tiempo + firma) que la app de registros valida para crear sesión. Es una transferencia puntual de un dato personal (el email) **dentro del mismo grupo/responsable**.

---

## 3. Registro de datos personales (base del Art. 30 RGPD)

| Dato personal | Dónde | Finalidad | Cifrado |
|---|---|---|---|
| Email de usuario | Ambas apps | Identificación / login | En tránsito (HTTPS) |
| Contraseña | Ambas apps | Autenticación | **Sí — hash bcrypt** ✅ |
| PIN de usuario / local | Ambas apps | Segunda verificación | Ver acción [H-7] |
| Nombre de usuario | ChefManager | Identificación en la interfaz | En tránsito |
| Negocio: nombre, CIF, email | ChefManager | Gestión del cliente | En tránsito |
| Proveedor: nombre, teléfono, email | ChefManager | Gestión de compras | En tránsito |
| Unidad: dirección, responsable, teléfono | ChefManager | Gestión de locales | En tránsito |

**Categorías especiales (Art. 9):** ninguna. No se tratan datos de salud, biométricos ni similares.
**Datos de clientes finales del restaurante:** no se tratan. Los registros (temperaturas, masas, checklists) son datos operativos, no personales.

> **Rol clave (modelo SaaS B2B):** tu cliente (el restaurante) es el **Responsable del Tratamiento**; tú (ChefManager) eres el **Encargado del Tratamiento**. Esto define qué documentos necesitas (ver GDPR).

---

## 4. Medidas técnicas de seguridad — estado verificado

### ChefManager (inv)

| Medida | Estado | Evidencia |
|---|---|---|
| Contraseñas con bcrypt | ✅ | `lib/auth-options.ts` |
| Sesión con expiración (8 h) y secreto en variable de entorno | ✅ | `lib/auth-options.ts` |
| Control de acceso por rol en rutas sensibles | ✅ | `middleware.ts` (admin/superadmin) |
| HSTS (fuerza HTTPS 1 año) | ✅ | `next.config.js` |
| Content-Security-Policy | ⚠️ presente pero con `unsafe-eval`/`unsafe-inline` | `next.config.js` |
| X-Frame-Options: DENY / frame-ancestors none | ✅ | `next.config.js` |
| X-Content-Type-Options, Referrer-Policy, Permissions-Policy | ✅ | `next.config.js` |
| Sin rastreadores de terceros (Analytics, etc.) | ✅ | fuente Inter auto-alojada |
| Cookies de sesión (httpOnly, secure, sameSite) | ✅ | NextAuth (valores seguros por defecto en HTTPS) |

### chefmanager-registros

| Medida | Estado | Evidencia |
|---|---|---|
| Contraseñas con bcrypt | ✅ | `package.json` / rutas auth |
| SSO con firma HMAC, validez de 60 s (anti-replay) y comparación en tiempo constante | ✅ | `src/index.ts` (`/auto-login-inv`) |
| Cookies de sesión (httpOnly, secure, sameSite) | ✅ | `src/routes/auth.ts` |
| Referrer-Policy: no-referrer en el SSO | ✅ | `src/index.ts` |
| Política CORS | ⚠️ `origin: '*'` con `credentials: true` | `src/index.ts` |

---

## 5. Hosting y transferencias internacionales (el punto más importante)

Ambas apps y sus dos bases de datos están en **Railway**, una empresa estadounidense.

**Estado:**
1. ✅ **Región confirmada: EU-West (Ámsterdam).** Tanto las dos aplicaciones como las dos bases de datos PostgreSQL están desplegadas en la UE. **No hay transferencia internacional de datos** — el dato no sale del territorio europeo.
2. ⏳ **Pendiente: firmar el DPA (Data Processing Agreement) de Railway.** Es el contrato que regula que Railway trata datos por tu cuenta. Railway lo ofrece; hay que aceptarlo/firmarlo formalmente.
3. ⏳ **Pendiente: documentar a Railway como sub-encargado** en tu propio DPA hacia los clientes (incluyendo que el tratamiento ocurre en EU-West/Ámsterdam).

> Con la región europea ya confirmada, el riesgo principal queda neutralizado. Solo falta la formalización contractual (DPA), que es trámite, no infraestructura.

---

## 6. Derechos de los interesados (Art. 15–22 RGPD)

| Derecho | Estado | Acción |
|---|---|---|
| Acceso / portabilidad (Art. 15, 20) | ⚠️ Sin procedimiento de exportación | Habilitar exportación de los datos de un usuario a petición |
| Rectificación (Art. 16) | ✅ | Edición de usuario disponible en Administración |
| **Supresión / derecho al olvido (Art. 17)** | ⚠️ El borrado estándar es **soft-delete** (`activo: false`, conserva el email) | Procedimiento de **borrado real o anonimización** a petición. El borrado total existe vía superadmin (`prisma.usuario.delete`) |
| Información (Art. 13–14) | ❌ Sin política de privacidad publicada | Publicar política de privacidad y aviso legal (ver GDPR) |

---

## 7. Plan de acción antes de comercializar

Ordenado por prioridad:

| # | Acción | Prioridad | Tipo |
|---|---|---|---|
| H-1 | ✅ **HECHO** — Región EU confirmada: EU-West (Ámsterdam), apps + las dos BBDD | — | Infra |
| H-2 | Firmar el **DPA de Railway** | 🔴 Crítica | Legal/Infra |
| H-3 | Publicar **política de privacidad** y **aviso legal** | 🔴 Alta | Documento (GDPR) |
| H-4 | Preparar **DPA propio** para ofrecer a tus clientes | 🔴 Alta | Documento (GDPR) |
| H-5 | ✅ **HECHO** — Anonimización RGPD de usuario (`POST /api/usuarios/[id]/anonimizar`) + opción en la UI | — | Código |
| H-6 | Procedimiento de **exportación** de datos de usuario | 🟠 Media | Código + proceso |
| H-7 | ✅ **HECHO** — CORS de registros restringido a lista blanca (`CROSS_APP_INV_URL` + `ALLOWED_ORIGINS`) | — | Código |
| H-8 | Endurecer **CSP** de ChefManager (evitar `unsafe-eval` si es viable) | 🟢 Baja | Código |
| H-9 | Redactar el **Registro de Actividades de Tratamiento** (Art. 30) | 🟢 Baja | Documento interno |
| H-10 | Definir **plan de notificación de brechas** (72 h) y retención de datos | 🟢 Baja | Proceso |

---

## 8. Conclusión

No hay vulnerabilidades graves que bloqueen la comercialización. El trabajo pendiente es, sobre todo, **documental y de infraestructura**: cerrar el hosting (región + DPA), publicar las políticas y habilitar dos derechos (acceso y supresión real). Las correcciones de código (CORS, CSP, borrado real) son menores y acotadas.

**Siguiente entregable:** los documentos GDPR (política de privacidad, DPA para clientes, aviso legal), que se apoyan directamente en este registro de datos.

---

*Documento técnico orientativo. No constituye asesoramiento legal.*
