# Estrategia de Venta — ChefManager Pro

> Plan de comercialización del SaaS por suscripción. Documento de trabajo, orientado a la acción.
> Precio de referencia fijado: **59 €/mes + IVA**.

---

## 1. Propuesta de valor

**ChefManager Pro es el sistema que mantiene una cocina bajo control: stock, pedidos, costes y cumplimiento sanitario, en una sola app que funciona incluso sin conexión.**

No es "otro software de inventario": combina tres cosas que normalmente se compran por separado:
1. **Gestión de inventario y pedidos** (con trazabilidad por lote y caducidad).
2. **Cumplimiento APPCC** (registros de temperaturas, checklists, etiquetado de seguridad alimentaria).
3. **Control de costes** (fichas técnicas / escandallos).

## 2. Cliente ideal (ICP)

| Característica | Detalle |
|---|---|
| Sector | Restauración, **pizzerías y panaderías** (el sistema gestiona tipos de masa, fermentación y lotes), obradores |
| Tamaño | De 1 a ~10 locales. Pequeños grupos de restauración es el punto dulce |
| Perfil | Negocios que ya sufren inspecciones de sanidad (APPCC obligatorio) y quieren dejar el Excel/papel |
| Decisor | Propietario, jefe de cocina o responsable de calidad |

> Tu cliente piloto (Grupo Gastronómico Norte) es el **caso de éxito** sobre el que construir el discurso de venta. Documéntalo: antes/después, tiempo ahorrado, inspección superada.

## 3. Diferenciadores (lo que dice la competencia que tú dices mejor)

- ✅ **APPCC integrado**: la mayoría de apps de inventario no cubren los registros sanitarios. Esto es **obligatorio por ley** para tus clientes → no es un "nice to have", es un dolor real.
- ✅ **Funciona sin conexión (PWA)**: las cocinas y cámaras tienen mala wifi. Tus competidores web se caen; tú no.
- ✅ **Trazabilidad por lote + etiquetas QR**: clave en seguridad alimentaria y ante inspecciones.
- ✅ **Escandallos**: control de coste por plato.
- ✅ **Datos en la UE, sin rastreadores**: argumento de confianza y privacidad (Ámsterdam, RGPD).
- ✅ **Instalable como app** en el móvil/tablet de cocina.

## 4. Modelo de precios

Precio base: **59 €/mes + IVA**. Recomendación de estructura para que el precio **escale con el cliente** y no te quedes corto con los grupos:

| Plan | Precio | Incluye |
|---|---|---|
| **Base** | **59 €/mes + IVA** | 1 local, usuarios ilimitados, todas las funciones |
| **Local adicional** | `[+X €/mes]` por local | Cada unidad de negocio extra |
| **Anual** | 2 meses gratis (≈ 590 €/año) | Pago anual con descuento → mejora la caja y la retención |

**Por qué por local y no por usuario:** en hostelería rota mucho el personal; cobrar por usuario penaliza el uso real (querrás que todo el equipo registre temperaturas y consumos). Cobrar **por local** alinea el precio con el valor y es predecible para el cliente.

> Decisión pendiente para ti: fija el precio del **local adicional** (sugerencia: 39-49 €/mes, con descuento por volumen para grupos).

## 5. Cómo facturar el IVA (decisión importante)

Vas a cobrar suscripciones recurrentes con IVA. Dos caminos:

| Opción | Quién gestiona el IVA | Cuándo conviene |
|---|---|---|
| **Merchant of Record** (Paddle, Lemon Squeezy) | **Ellos** declaran e ingresan el IVA de toda la UE por ti; te pagan neto | **Recomendado al empezar** y si vendes fuera de España. Cero burocracia fiscal transfronteriza |
| **Stripe / GoCardless** | **Tú** (con tu gestoría). Stripe Tax calcula, pero declaras tú | Si vendes **solo en España** y ya tienes gestoría |

**Recomendación:** empieza con un **Merchant of Record** (Paddle/Lemon Squeezy). Pagas algo más de comisión, pero te quitas el IVA intracomunitario, las facturas y el OSS de encima — críticos cuando vendes a varios países de la UE. Cuando el volumen lo justifique, valoras migrar a Stripe.

## 6. Embudo de venta

```
Captación  →  Prueba gratis  →  Conversión  →  Onboarding  →  Retención
```

1. **Captación**: demos en vídeo cortas (etiqueta QR, registro de temperatura, pedido en 30 s), landing con el caso del cliente piloto.
2. **Prueba gratis**: **14 días sin tarjeta** (reduce fricción) o **demo guiada 1-a-1** (mejor para B2B de ticket medio). Para hostelería, la demo guiada convierte más.
3. **Conversión**: al acabar la prueba, alta de la suscripción (Merchant of Record).
4. **Onboarding** (el punto crítico): el alta de productos, proveedores y fichas es la barrera de entrada. Ofrece **onboarding asistido** (tú o tu equipo cargáis el catálogo inicial). Esto dispara la activación.
5. **Retención**: cuanto más APPCC e inventario acumula el cliente, más cuesta irse. La función de registros sanitarios es el **ancla** (la necesitan sí o sí).

## 7. Canales de venta

- **Venta directa B2B**: demos a restaurantes locales; el sector funciona mucho por contacto directo.
- **Boca a boca / prescripción**: un cliente satisfecho en una zona trae a sus conocidos del gremio.
- **Alianzas**: asesorías de APPCC/calidad alimentaria y distribuidores de hostelería que ya tienen la confianza del restaurante. Comisión por referido.
- **Contenido**: "cómo pasar una inspección de sanidad", "control de mermas" → atrae a tu ICP por su dolor.

## 8. Documentos contractuales que faltan

Para cobrar de forma limpia necesitas, además de los legales ya redactados (privacidad, aviso legal, DPA):

- **Términos y Condiciones de Suscripción**: precio, periodo de facturación, renovación automática, **derecho de desistimiento**, política de cancelación y reembolso, SLA/disponibilidad, suspensión por impago, exportación de datos al cancelar.

> *(Pendiente de redactar — encaja como complemento de esta estrategia.)*

## 9. Métricas que debes seguir desde el día 1

| Métrica | Por qué |
|---|---|
| **MRR** (ingreso recurrente mensual) | El número que importa en SaaS |
| **Churn** (bajas) | Si supera ~5%/mes, hay un problema de producto u onboarding |
| **Conversión de prueba** | Mide si la prueba/onboarding funcionan |
| **CAC vs LTV** | Cuánto cuesta captar vs cuánto vale un cliente |
| **Activación** | % de clientes que completan el alta de catálogo y empiezan a registrar |

## 10. Primeros pasos (plan de lanzamiento)

1. Documentar el **caso del cliente piloto** (testimonial + datos).
2. Decidir y montar el cobro: **Merchant of Record** + planes (base + local adicional + anual).
3. Definir la **prueba** (recomendado: demo guiada + 14 días).
4. Redactar los **Términos y Condiciones de Suscripción** (ver sección 8).
5. Landing con propuesta de valor, precio y caso de éxito.
6. Cerrar los **3-5 primeros clientes** por venta directa antes de escalar canales.

---

*Documento de estrategia. Las cifras de precios de planes adicionales y descuentos son recomendaciones a validar con tu mercado.*
