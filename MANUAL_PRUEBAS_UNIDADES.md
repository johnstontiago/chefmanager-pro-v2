# Manual de pruebas: conversión de unidades y elaboraciones portionadas

Guía paso a paso para probar dos cosas: (1) recepción de mercancía con conversión de unidad de compra → unidad base (ya existente), y (2) elaboraciones que se producen en porciones discretas (ej. 30 bolas de masa de 280 g) y cómo se usan como ingrediente en otras recetas (nuevo).

## 1. Declarar la conversión de un producto al comprarlo

Ruta: **Admin → Productos**

1. Crea o edita el producto **"Harina"**.
2. En **Unidad**, elige la unidad de compra (ej. `kg` o `un` si la compras por bolsas).
3. Baja a la sección azul **"Contenido por unidad de compra (para fichas técnicas)"**:
   - **Contenido**: `25000`
   - **Unidad mínima**: `g`
4. Guarda. Esto significa: "cada unidad que compro de Harina contiene 25000 g".

Repite para **"Tomate Pelati"**:
   - **Contenido**: `2600`
   - **Unidad mínima**: `g`

Esto ya funcionaba antes de esta sesión — solo hace falta rellenarlo por cada producto que lo necesite.

## 2. Recibir mercancía usando esa conversión

Ruta: **Inventario → Recepciones → Nueva recepción**

1. Selecciona el producto (ej. Harina).
2. Introduce la **Cantidad** en la unidad de compra (ej. `2` si recibes 2 bolsas).
3. Si el proveedor te entrega en un formato distinto al habitual, marca **"El proveedor entrega en formato diferente"** y crea una variante (ej. "Saco 25kg", factor `25000`).
4. El sistema calcula automáticamente el **Total a ingresar** en la unidad base (g) y así queda registrado en el stock.
5. Rellena fecha de caducidad y nº de lote si aplica, y pulsa **Registrar entrada**.

## 3. Crear la elaboración "Biga" (stock en gramos)

Ruta: **Fichas → Elaboraciones → Nueva elaboración**

1. Nombre: `Biga`. Unidad de stock: `g`.
2. Añade sus ingredientes (harina, agua, etc.) con la cantidad **por cada gramo de Biga producida** (cantidades pequeñas, ej. `0.6` de harina por 1 g de Biga — usa el "Conversor de proporciones" si es más fácil: pon las cantidades reales de un lote y la producción total, y pulsa convertir).
3. Guarda.

Produce un lote de prueba desde **Fichas → Preparaciones → Nueva preparación**, eligiendo Biga y una cantidad (ej. `6000` g), para tener stock disponible.

## 4. Crear la elaboración "Masa" en porciones (lo nuevo)

Ruta: **Fichas → Elaboraciones → Nueva elaboración**

1. Nombre: `Masa`.
2. **Unidad de stock**: elige **`Unidades`**. Al seleccionarla aparece una caja azul nueva: **"Contenido por unidad producida"**.
3. Rellena:
   - **Cantidad**: `280`
   - **Unidad**: `g`

   Esto dice: "cada unidad (bola) de Masa pesa 280 g".
4. Añade los ingredientes de Masa **por cada bola (unidad) producida**, en las cantidades reales de una bola: ej. `93 g` de Biga, `150 g` de harina, `37 ml` de agua (nota: en el picker de ingredientes ahora deberías ver Biga listada junto con productos e insumos manuales — si no aparece, revisa la nota al final de este manual).
5. Guarda.

## 5. Producir un lote de Masa (30 porciones)

Ruta: **Fichas → Preparaciones → Nueva preparación**

1. Elige `Masa`.
2. **Cantidad producida (unidad)**: `30`. Debajo verás el texto informativo **"≈ 8400 g en total"** (30 × 280 g) — solo informativo.
3. Pulsa **Producir**. Verifica:
   - Se crea un lote de Masa con `30` unidades disponibles.
   - Se descontó `93 × 30 = 2790 g` de Biga (compruébalo en Fichas → Elaboraciones, la tarjeta de Biga debe mostrar su stock reducido).

## 6. Usar "Masa" como ingrediente de una ficha técnica

Ruta: **Fichas → Fichas técnicas → nueva/editar ficha** (ej. "Pizza Margherita")

1. Añade `Masa` como ingrediente.
2. La cantidad se pide directamente **en la unidad de Masa (unidades/porciones)**, no en gramos: escribe `1` para una bola entera, o `0.5` para media.
3. Guarda y comprueba el coste calculado de la ficha (debe incluir el coste de Masa, que a su vez incluye el de Biga).
4. Si tienes el simulador de TPV (Configuración → Integración TPV → Simulador), vende una unidad de esa ficha y confirma que el stock de Masa baja en `1` (o `0.5`) unidades.

## 7. Caso avanzado: usar "Masa" como ingrediente de OTRA elaboración, en gramos

Si alguna vez necesitas que una elaboración (no una ficha) use Masa como ingrediente expresado en gramos en vez de unidades (ej. una elaboración "Calzone" que usa `140 g` de Masa):

1. En el picker de ingredientes de esa elaboración, elige `Masa`.
2. En la columna de unidad, escribe `g` (en vez de `unidad`) y la cantidad en gramos (`140`).
3. El sistema convertirá automáticamente `140 g ÷ 280 g/unidad = 0.5 unidades` de Masa al producir o calcular coste — gracias al "contenido por unidad" del paso 4.

## Limitaciones conocidas

- Las alertas de stock mínimo y el valor total de inventario del dashboard todavía muestran las elaboraciones portionadas solo en "unidades", sin el equivalente en peso. No afecta al cálculo de coste ni al descuento de stock, es solo una mejora visual pendiente.
- El "contenido por unidad" solo aplica cuando la unidad de stock de la elaboración es `Unidades`. Para elaboraciones en g/ml/kg/l no hace falta y el campo no aparece.

## Si algo no aparece

Si después de desplegar no ves los cambios reflejados (ej. un ingrediente nuevo no aparece en un selector), antes de reportarlo prueba:
1. Recargar la página con Ctrl+Shift+R (fuerza a descartar caché).
2. Confirmar que el despliegue en Railway ya terminó (puede tardar 1-2 minutos tras el push).
