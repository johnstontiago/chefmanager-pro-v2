# Manual de Usuario — ChefManager Pro

> Guía de uso de la aplicación de gestión de inventario, pedidos y fichas técnicas para hostelería.
> Versión del manual: 1.0 · Aplicación web instalable (PWA) — funciona en móvil, tablet y ordenador.

---

## Índice

1. [Qué es ChefManager Pro](#1-qué-es-chefmanager-pro)
2. [Primeros pasos](#2-primeros-pasos)
3. [Roles y permisos](#3-roles-y-permisos)
4. [La pantalla principal](#4-la-pantalla-principal)
5. [Dashboard](#5-dashboard)
6. [Pedidos](#6-pedidos)
7. [Recepción de mercancía](#7-recepción-de-mercancía)
8. [Inventario](#8-inventario)
9. [Consumo y mermas](#9-consumo-y-mermas)
10. [Etiquetas](#10-etiquetas)
11. [Fichas técnicas](#11-fichas-técnicas)
12. [Administración](#12-administración)
13. [Trabajar sin conexión (offline)](#13-trabajar-sin-conexión-offline)
14. [Resolución de problemas](#14-resolución-de-problemas)

---

## 1. Qué es ChefManager Pro

ChefManager Pro es una herramienta para gestionar la operativa de cocina y almacén de un negocio de hostelería. Permite:

- **Hacer pedidos** a proveedores y llevar su seguimiento.
- **Recepcionar la mercancía** que llega, registrando lote y caducidad, e imprimir etiquetas con código QR.
- **Controlar el inventario** en tiempo real, con avisos de stock bajo y productos por caducar.
- **Registrar consumos y mermas** de los productos.
- **Crear fichas técnicas** (escandallos/recetas) para calcular costes.
- Todo organizado por **unidades de negocio** (locales) y con **distintos perfiles de usuario**.

La aplicación funciona desde el navegador y se puede **instalar en el móvil como una app**. Sigue funcionando aunque te quedes sin conexión (ver [sección 13](#13-trabajar-sin-conexión-offline)).

---

## 2. Primeros pasos

### Iniciar sesión

1. Abre la aplicación en el navegador (o desde el icono si la has instalado).
2. Introduce tu **correo electrónico** y **contraseña**.
3. Pulsa **Entrar**.

Tus credenciales te las facilita el administrador del negocio. La sesión permanece abierta durante 8 horas; después tendrás que volver a iniciar sesión.

### Código PIN

Algunas acciones o accesos pueden requerir un **PIN** de seguridad adicional, independiente de tu contraseña. Si tu cuenta lo tiene configurado, se te pedirá tras iniciar sesión.

### Seleccionar la unidad de negocio

Si tu negocio tiene varios locales, en la barra superior aparece el **selector de unidad** (icono de edificio). Pulsa sobre él para cambiar entre unidades. Todo lo que veas (inventario, pedidos, etc.) corresponde a la unidad seleccionada.

> Si ves el mensaje **"Sin unidad asignada"**, contacta con el administrador para que te asigne una.

---

## 3. Roles y permisos

Cada usuario tiene un **rol** que determina a qué módulos puede acceder:

| Rol | Acceso |
|---|---|
| **Administrador** | Acceso completo, incluida la Administración del negocio |
| **Recepción** | Pedidos, Recepción, Inventario, Fichas, Dashboard |
| **Cocina** | Consumo, Inventario, Fichas, Dashboard |
| **Visor (viewer)** | Solo consulta: Inventario, Fichas, Dashboard |
| **Superusuario** | Acceso total + Panel de gestión de negocios |

El menú lateral solo muestra los módulos a los que tu rol tiene acceso, así que no todos los usuarios ven las mismas opciones.

---

## 4. La pantalla principal

- **Menú lateral (izquierda):** navegación entre módulos. En móvil se abre con el icono ☰.
- **Barra superior:** selector de unidad y tu correo.
- **Indicador de sincronización:** muestra si estás conectado o si hay cambios pendientes de enviar (ver [sección 13](#13-trabajar-sin-conexión-offline)).
- **Registros APPCC:** acceso directo (en el pie del menú) al sistema de registros de control sanitario.
- **Cerrar sesión:** en el pie del menú.

El menú de **Inventario** muestra un **globo rojo** con el número de productos en stock bajo, para que lo veas de un vistazo.

---

## 5. Dashboard

Es la pantalla de inicio. Ofrece un resumen del estado del negocio y **accesos rápidos** a las acciones más habituales. Aquí verás de un vistazo indicadores como el stock bajo de la unidad activa.

---

## 6. Pedidos

Módulo para crear y gestionar los pedidos a proveedores.

### Crear un pedido

1. Entra en **Pedidos**.
2. Añade productos al **carrito** desde el catálogo. Puedes filtrar por **categoría** y por **proveedor**, y buscar por nombre.
3. Indica las cantidades. Puedes añadir **notas** al pedido.
4. El pedido se guarda como **Borrador**, que puedes seguir editando antes de enviarlo.

> El sistema puede ofrecer **sugerencias** de pedido basadas en el consumo y el stock, y tiene en cuenta los **festivos** configurados para ajustar las previsiones.

### Estados de un pedido

| Estado | Significado |
|---|---|
| **Borrador** | En preparación, editable |
| **Enviado** | Enviado al proveedor |
| **Recibido** | Mercancía recibida por completo |
| **Recibido parcial** | Recibida solo una parte |
| **Cancelado** | Anulado |

### Exportar y compartir

Desde un pedido puedes:
- **Exportar a CSV** (para hoja de cálculo).
- **Generar un PDF**.
- **Copiar al portapapeles** para pegarlo, por ejemplo, en un correo o WhatsApp al proveedor.

### Historial

La pestaña **Historial** muestra todos los pedidos anteriores con su estado, fecha y usuario.

---

## 7. Recepción de mercancía

Módulo para registrar la entrada de la mercancía de un pedido.

### Registrar la recepción

1. Entra en **Recepción** y selecciona el pedido que ha llegado.
2. Por cada ítem, registra:
   - **Cantidad recibida**
   - **Lote**
   - **Fecha de caducidad**
3. Para acelerar, puedes pulsar **Escanear etiqueta** y hacer una foto de la etiqueta del producto: el sistema intenta leer automáticamente el **lote** y la **caducidad**. **Revisa siempre** los datos detectados y corrígelos si hace falta.
4. Al registrar el ítem, el sistema le asigna un **código único** y, si tienes la impresora conectada, **imprime una etiqueta** con su código QR (ver [sección 10](#10-etiquetas)).

### Cerrar la recepción

Cuando hayas registrado todos los ítems, **cierra la recepción**. Si todos los ítems se han recibido, el pedido se archiva automáticamente. Puedes **exportar a CSV** los ítems recibidos.

El **Historial de Recepciones** guarda todas las recepciones realizadas.

---

## 8. Inventario

Muestra el stock actual de la unidad seleccionada, agrupado por producto.

### Consultar y filtrar

Puedes filtrar el inventario por:
- **Categoría**
- **Proveedor**
- **Estado**

Y buscar un producto por nombre.

### Estados del stock

| Estado | Significado |
|---|---|
| **Normal** | Stock suficiente |
| **Stock bajo** | Por debajo del mínimo definido para el producto |
| **Sin stock** | Sin existencias |
| **Por caducar** | Próximo a la fecha de caducidad |
| **Caducado** | Fecha de caducidad superada |

Cada lote muestra su cantidad, ubicación y caducidad, lo que te permite aplicar **FIFO** (primero en caducar, primero en salir).

---

## 9. Consumo y mermas

Módulo para descontar producto del inventario, ya sea por **consumo** (uso normal en cocina) o por **merma** (pérdida, rotura, caducidad…).

### Registrar un movimiento

1. Entra en **Consumo**.
2. Localiza el lote: usa la **búsqueda rápida por código** (teclea el código único) o pulsa **Escanear** para leer el **QR** de la etiqueta con la cámara.
3. Elige el tipo de movimiento: **Consumo** o **Merma**.
4. Indica la **cantidad**. No puede ser mayor que el stock disponible.
5. En las **mermas, las notas son obligatorias** (hay que indicar el motivo).
6. Confirma para registrar el movimiento y descontar el stock.

### Historial

La pestaña **Historial** muestra todos los movimientos (consumos, mermas y entradas) con cantidad, fecha y usuario.

---

## 10. Etiquetas

Pestaña dentro de **Consumo** para imprimir etiquetas en una impresora térmica Bluetooth.

### Conectar la impresora

1. En la pestaña **Etiquetas**, pulsa **Conectar** y selecciona la impresora Bluetooth.

> Requiere un navegador compatible con Bluetooth (Chrome o Edge) y conexión segura (HTTPS). Si ves "Bluetooth no soportado", usa Chrome/Edge.

### Imprimir una etiqueta

Hay dos modos:

- **Desde ítem:** escanea el QR de la etiqueta o busca por código único. Se rellenan automáticamente el **nombre del producto, el código y la caducidad original**. Los campos **Fecha de apertura, Caducidad tras apertura y Porción** quedan en blanco para rellenarlos a mano.
- **En blanco:** imprime una etiqueta con todos los campos vacíos, para rellenar a mano.

Indica la **cantidad de copias** (hasta 50) y pulsa **Imprimir etiqueta**. Este apartado **no guarda ningún dato**: solo imprime.

---

## 11. Fichas técnicas

Módulo para crear escandallos/recetas y calcular costes.

### Gestionar fichas

- **Nueva ficha técnica:** crea una ficha con sus ingredientes.
- **Editar / Ver detalle:** consulta el desglose y el coste de una ficha.
- **Eliminar:** borra una ficha.

Las fichas se organizan en **categorías**, y se componen de **insumos** (ingredientes) y **preparaciones** (elaboraciones intermedias reutilizables). Puedes crear, editar y eliminar categorías, insumos y preparaciones.

El **detalle de la ficha** muestra el coste calculado a partir de los precios de los productos del inventario.

---

## 12. Administración

Disponible solo para **Administradores** y **Superusuarios**. Centraliza la configuración del negocio mediante pestañas:

| Pestaña | Para qué sirve |
|---|---|
| **Productos** | Alta, edición y baja del catálogo de productos (nombre, fabricante, categoría, proveedor, unidad de medida, precio, stock mínimo, contenido neto) |
| **Proveedores** | Gestión de proveedores (nombre, teléfono, email) |
| **Unidades** | Gestión de las unidades de negocio (locales) |
| **Usuarios** | Alta y baja de usuarios y asignación de roles. La contraseña es obligatoria al crear un usuario nuevo |
| **Reportes** | Generación de informes del negocio |
| **Etiqueta** | Configuración y calibración de la etiqueta de impresión (tamaño, márgenes, posición del QR), con **vista previa** |

> Las acciones de borrado piden confirmación. Eliminar un producto, proveedor, unidad o usuario es una acción sensible: revisa siempre antes de confirmar.

---

## 13. Trabajar sin conexión (offline)

ChefManager Pro es una **PWA**: puede instalarse como app y seguir funcionando aunque pierdas la conexión a internet.

- El **indicador de sincronización** (esquina inferior) muestra si estás **conectado** o si hay **cambios pendientes** de enviar.
- Los movimientos que registres sin conexión se **guardan en el dispositivo** y se **sincronizan automáticamente** cuando vuelve la conexión.
- No cierres la sesión mientras tengas cambios pendientes de sincronizar.

### Instalar la app en el móvil

En Chrome/Edge para Android, abre la app y usa **"Añadir a la pantalla de inicio"** desde el menú del navegador. Tendrás un icono como el de cualquier otra app.

---

## 14. Resolución de problemas

| Problema | Solución |
|---|---|
| **"Sin unidad asignada"** | Pide al administrador que te asigne una unidad de negocio |
| **No veo un módulo en el menú** | Tu rol no tiene acceso a ese módulo. Consulta con el administrador |
| **"Bluetooth no soportado"** | Usa Chrome o Edge y accede por HTTPS. Safari y Firefox no soportan la impresión Bluetooth |
| **La impresora no imprime** | Comprueba que esté encendida, con papel y emparejada; vuelve a pulsar **Conectar** |
| **El escáner de etiqueta no detecta datos** | Repite la foto con buena luz y enfoque; siempre puedes introducir los datos a mano |
| **El escáner de QR no abre la cámara** | Acepta los permisos de cámara del navegador. También puedes teclear el código manualmente |
| **Hay cambios "pendientes" que no se envían** | Recupera la conexión a internet; la sincronización es automática. No cierres sesión hasta que se complete |
| **No puedo registrar más cantidad de la que hay** | El consumo no puede superar el stock disponible del lote |

---

> **Nota para el responsable del negocio:** este manual describe las funciones estándar de la aplicación. Adáptalo a tu operativa concreta (nombres de unidades, flujos internos, política de mermas, etc.) antes de entregarlo a tu equipo.
