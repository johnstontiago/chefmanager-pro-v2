# Guía de despliegue — entorno de pruebas

> **Objetivo:** poner `chefmanager-pro-v2` online en Railway para validar el módulo de stock
> (recepciones, elaboraciones, alertas, endpoint TPV y simulador) antes de migrar a producción.
>
> El entorno de producción (`chefmanager-inv`) **no se toca en ningún paso**.

---

## Requisitos previos

| Herramienta | Comprobación |
|---|---|
| Cuenta Railway | [railway.app](https://railway.app) |
| CLI Railway | `railway --version` (instalar: `npm i -g @railway/cli`) |
| Node.js ≥ 18 | `node --version` |
| Git | `git --version` |

---

## Paso 1 — Crear el proyecto en Railway

1. Entra en [railway.app](https://railway.app) → **New Project**
2. Elige **Deploy from GitHub repo**
3. Selecciona `johnstontiago/chefmanager-pro-v2`
4. Railway detecta automáticamente Next.js — continúa

---

## Paso 2 — Añadir la base de datos

En el proyecto Railway recién creado:

1. Clic en **+ New** → **Database** → **PostgreSQL**
2. Espera a que termine el aprovisionamiento
3. Ve a la pestaña **Variables** del servicio de base de datos
4. Copia el valor de `DATABASE_URL` (lo necesitas en el paso 3)

> Railway EU-West (Ámsterdam) — misma región que producción.
> Asegúrate de que el proyecto está en esa región en **Settings → Region**.

---

## Paso 3 — Variables de entorno del servicio web

En el servicio web de Railway → pestaña **Variables**, añade:

```
DATABASE_URL        = (el que copiaste del paso 2)
NEXTAUTH_SECRET     = (genera uno: openssl rand -base64 32)
NEXTAUTH_URL        = https://<tu-dominio-railway>.up.railway.app
NODE_ENV            = production
PORT                = 8080
```

Para `NEXTAUTH_SECRET` puedes usar este comando en tu terminal local:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Variables **opcionales** (solo si quieres SSO entre apps):

```
CROSS_APP_INV_URL   = https://chefmanager-pro-v2.up.railway.app
HMAC_SECRET         = (mismo que en producción si quieres SSO)
LEMON_SQUEEZY_KEY   = (solo si testeas registro de licencias)
```

---

## Paso 4 — Primer despliegue

Railway hace el build automáticamente al hacer push. El `railway.toml` ya configura:

```
Build:  npm ci → prisma generate → next build
Start:  prisma db push → next start -p 8080
```

El `prisma db push` del start command aplica el schema completo en la base de datos vacía
(incluye todos los modelos nuevos: `LoteInventario`, `Elaboracion`, `IntegracionTPV`, etc.)

Monitoriza el progreso en **Deployments** → clic en el deploy activo → ver logs.

El health check `GET /api/health` debe responder `{ "ok": true }` cuando todo esté listo.

---

## Paso 5 — Crear el superusuario inicial

Una vez que el deploy está en verde, ejecuta el seed desde tu máquina local:

```bash
# Desde la carpeta chefmanager-pro-v2
cd "C:\Users\johns\Documents\PANZZONI - APPS\chefmanager-pro-v2"

# Apunta al DATABASE_URL de Railway (pega el valor del paso 2)
$env:DATABASE_URL = "postgresql://..."    # PowerShell
# o: export DATABASE_URL="postgresql://..."  # bash

# Seed principal (tenant, usuarios, unidades, productos base)
npm run db:seed

# Seed del módulo de stock (elaboraciones, lotes, ficha con escandallo, TPV)
npm run db:seed-stock
```

Al terminar verás el resumen:

```
🏁  Seed completado. Resumen de datos de prueba:

  INVENTARIO:
  • Paleta ibérica      5.95 kg disponibles (2 lotes)
  • Mozzarella          3 kg disponibles
  • Aceite de oliva     5 L disponibles

  ELABORACIONES:
  • Pulled Pork         2 kg en stock

  SIMULADOR TPV:
  • Ficha: "Bocadillo Pulled Pork" (id=X)
  • Cada ración descuenta: 200g Pulled Pork + 60g Mozzarella

  API KEY TPV:
  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Guarda la API key — la necesitas para probar el endpoint directamente con curl/Postman.

---

## Paso 6 — Acceso a la app

| URL | Descripción |
|---|---|
| `https://<dominio>.up.railway.app/login` | Login |
| `/dashboard` | Panel principal |
| `/elaboraciones` | Crear elaboraciones y registrar producción |
| `/inventario/recepciones/nuevo` | Registrar entrada de mercancía |
| `/inventario/informe` | Informe unificado + alertas |
| `/configuracion/integracion-tpv` | Panel TPV (API key, logs) |
| `/configuracion/integracion-tpv/simulador` | **Simulador de comandas** |

**Credenciales del seed:**

| Rol | Email | Contraseña |
|---|---|---|
| Superusuario | `superadmin@chefmanager.com` | `984555` *(o la que tenga tu seed.ts)* |
| Admin local | `admin@restaurante.com` | `admin123` |

*(Revisa `scripts/seed.ts` para confirmar los valores exactos.)*

---

## Paso 7 — Probar el módulo de stock

### 7.1 Flujo completo de elaboraciones

1. `/elaboraciones` → crea una nueva elaboración o usa "Pulled Pork" del seed
2. Haz clic en "Registrar producción" → pon 1000 g → confirma
3. Ve a `/inventario/informe` → verifica que el stock de la elaboración sube
4. Comprueba que los lotes de paleta bajaron (insumos consumidos)

### 7.2 Recepción de mercancía

1. `/inventario/recepciones/nuevo`
2. Selecciona "Paleta de cerdo ibérica" (peso variable) → añade 2 piezas con peso
3. Confirma → verifica en el informe que el stock sube

### 7.3 Simulador TPV

1. `/configuracion/integracion-tpv/simulador`
2. Selecciona "Bocadillo Pulled Pork" → cantidad 2
3. El panel muestra lo que se va a descontar: 400g Pulled Pork + 120g Mozzarella
4. Pulsa "Enviar comanda" → revisa respuesta JSON
5. Ve al informe → confirma que el stock bajó
6. Prueba con más raciones de las que hay en stock → debe devolver `207` con `stockInsuficiente: true` sin crashes

### 7.4 Probar el endpoint directamente

```bash
curl -X POST https://<dominio>.up.railway.app/api/ventas/consumo \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_API_KEY_DEL_SEED" \
  -d '{"fichaId": 1, "cantidad": 1}'
```

Respuestas esperadas:
- `200` — OK, todo descontado
- `207` — Stock parcial (algún ingrediente sin stock suficiente)
- `401` — API key inválida
- `404` — Ficha no encontrada

---

## Solución de problemas frecuentes

### Build falla en `prisma generate`

El `prisma generate` necesita que `DATABASE_URL` esté definida en Railway.
Revisa que la variable está en **Variables** del servicio web, no solo en la base de datos.

### `prisma db push` falla al arrancar

Posibles causas:
- La base de datos aún no está lista cuando arranca el servicio web
- Solución: en Railway → servicio web → **Settings** → **Start Command**, añade un delay:
  ```
  sleep 5 && npx prisma db push && npm run start
  ```

### El seed falla con "Tenant 1 no existe"

El `seed.ts` crea el tenant con ID 1. Si la base de datos está vacía, el autoincrement empieza en 1.
Si ya hay datos, ajusta `TENANT_ID` al inicio de `seed-stock.ts`.

### Página en blanco / error 500

Revisa que `NEXTAUTH_SECRET` y `NEXTAUTH_URL` están correctamente configurados.
`NEXTAUTH_URL` debe coincidir exactamente con el dominio Railway (sin barra final).

---

## Variables de entorno — referencia completa

```env
# Obligatorias
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_SECRET=clave-aleatoria-32-bytes-base64
NEXTAUTH_URL=https://tu-app.up.railway.app
NODE_ENV=production
PORT=8080

# Opcionales
CROSS_APP_INV_URL=https://...       # SSO con app de registros
HMAC_SECRET=...                     # SSO entre apps
LEMON_SQUEEZY_KEY=...               # Licencias
```

---

## Una vez validado — migrar a producción

Cuando el entorno de prueba esté validado:

1. Aplica el schema al proyecto de producción:
   ```bash
   # Con DATABASE_URL de producción
   npx prisma db push
   ```
2. Verifica que los datos existentes siguen intactos (el schema es 100% aditivo)
3. Haz merge o cherry-pick de los cambios de `chefmanager-pro-v2` a `chefmanager-inv`
4. Despliega en el servicio de producción de Railway

> Los nuevos campos (`tipoPeso`, `unidadBase`) son `nullable` o tienen `@default`,
> así que los productos existentes en producción **no se ven afectados**.
