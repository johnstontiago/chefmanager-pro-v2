# Contrato de Encargo del Tratamiento (DPA)

> **BORRADOR.** Es el contrato que **tú (ChefManager) ofreces a tus clientes** conforme al Art. 28 RGPD. Aquí tú eres el **Encargado** y el cliente el **Responsable**. Sustituye los marcadores `[ ]` y revísalo legalmente antes de usarlo con clientes.
> Versión: `[Vx.x]` · Fecha: `[FECHA]`

---

## Partes

- **Responsable del Tratamiento:** el cliente que contrata el servicio (en adelante, "el Responsable"), identificado en el contrato de suscripción.
- **Encargado del Tratamiento:** `[RAZÓN SOCIAL]`, NIF `[NIF]`, con domicilio en `[DOMICILIO]` (en adelante, "el Encargado" o "ChefManager").

Este contrato forma parte integrante del contrato de suscripción a ChefManager Pro y desarrolla las obligaciones del Art. 28 del RGPD.

## 1. Objeto

El Encargado tratará, por cuenta del Responsable, los datos personales necesarios para prestar el servicio de gestión de inventario, pedidos y registros operativos de ChefManager Pro.

## 2. Detalle del tratamiento

| Concepto | Detalle |
|---|---|
| Naturaleza y finalidad | Alojamiento y procesamiento de los datos necesarios para la prestación del servicio |
| Duración | Mientras esté vigente el contrato de suscripción |
| Tipo de datos | Datos identificativos y de contacto de los usuarios y proveedores que el Responsable introduzca (nombre, email, teléfono, dirección), credenciales de acceso |
| Categorías de interesados | Personal del Responsable y sus proveedores |
| Categorías especiales | No se tratan |

## 3. Obligaciones del Encargado

El Encargado se compromete a:

1. Tratar los datos **únicamente siguiendo instrucciones documentadas** del Responsable.
2. Garantizar la **confidencialidad** y que las personas autorizadas se comprometan a ella.
3. Aplicar las **medidas de seguridad** del Art. 32 RGPD (ver Anexo).
4. No recurrir a otro encargado sin **autorización** del Responsable (ver sub-encargados, cláusula 4).
5. **Asistir al Responsable** en la respuesta a solicitudes de ejercicio de derechos de los interesados.
6. Ayudar al Responsable a cumplir sus obligaciones de seguridad, notificación de brechas y evaluaciones de impacto.
7. **Notificar sin dilación indebida** (y en todo caso dentro de las 72 horas desde que tenga constancia) cualquier violación de seguridad de los datos.
8. A elección del Responsable, **suprimir o devolver** los datos al finalizar la prestación, salvo conservación exigida por ley.
9. Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento y permitir **auditorías**.

## 4. Sub-encargados

El Responsable **autoriza** al Encargado a servirse de los siguientes sub-encargados:

| Sub-encargado | Servicio | Ubicación |
|---|---|---|
| Railway Corporation | Alojamiento de aplicación y base de datos | **Unión Europea — EU-West (Ámsterdam)** |
| `[PROVEEDOR DE PAGOS, cuando aplique]` | Procesamiento de pagos | `[UBICACIÓN]` |

El Encargado informará al Responsable de cualquier cambio de sub-encargados, dándole la posibilidad de oponerse.

## 5. Transferencias internacionales

El tratamiento se realiza **íntegramente dentro de la Unión Europea**. No se efectúan transferencias internacionales de datos. `[Actualizar si se incorpora un proveedor fuera de la UE.]`

## 6. Duración

Este contrato estará vigente mientras dure el contrato de suscripción. A su finalización, el Encargado procederá conforme a la cláusula 3.8.

---

## Anexo — Medidas de seguridad (Art. 32 RGPD)

- Cifrado de contraseñas mediante funciones de hash (bcrypt).
- Comunicaciones cifradas en tránsito (HTTPS) con HSTS.
- Control de acceso basado en roles y autenticación con expiración de sesión.
- Cabeceras de seguridad del navegador (CSP, X-Frame-Options, etc.).
- Alojamiento en infraestructura profesional dentro de la UE (Railway, EU-West/Ámsterdam).
- Copias de seguridad y medidas de recuperación gestionadas por el proveedor de infraestructura.

---

*Documento orientativo. No constituye asesoramiento legal.*
