# ChefManager Pro Design System
## Instrucciones para Claude Code — pegar en cualquier proyecto nuevo

Este archivo define la identidad visual y las reglas de construcción de interfaz para todas las apps del ecosistema ChefManager Pro. Extraído de `chefmanager-inv` como referencia canónica.

---

## Stack obligatorio

```
Next.js 14+ (App Router)
React 18 + TypeScript
Tailwind CSS
shadcn/ui (Radix UI primitives)
Lucide React (iconos)
next-auth (autenticación)
Prisma + PostgreSQL
```

---

## Paleta de colores

### Colores base (usar siempre estos valores concretos, NO variables CSS `bg-background`)

```
Fondo de página:  gradiente slate-50 → slate-100  (bg-gradient-to-b from-slate-50 to-slate-100)
Fondo de cards:   bg-white
Bordes:           border-slate-200
Texto principal:  text-slate-800  o  text-slate-900
Texto secundario: text-slate-500
Texto terciario:  text-slate-400
```

### Color primario — Azul ChefManager Pro

```
Primario:         bg-blue-600        #2563EB
Primario hover:   bg-blue-700        #1D4ED8
Primario suave:   bg-blue-50         #EFF6FF
Primario borde:   border-blue-200    #BFDBFE
Primario texto:   text-blue-600      #2563EB
Primario oscuro:  text-blue-900      #1E3A8A
Theme color PWA:  #1e40af
```

### Colores de estado semántico

```
Éxito / OK:       bg-green-100  text-green-700   border-green-200
Alerta / Warning: bg-yellow-100 text-yellow-700  border-yellow-200
Error / Peligro:  bg-red-100    text-red-700     border-red-200
Info / Neutro:    bg-slate-100  text-slate-700   border-slate-200
```

### Sidebar

```
Fondo:            bg-slate-900
Ítem activo:      bg-blue-600  text-white
Ítem hover:       bg-slate-800 text-white
Texto normal:     text-slate-300
Bordes internos:  border-slate-800
```

---

## Tipografía

```
Fuente:           Inter (Google Fonts, subsets: latin)
Título de página: text-2xl font-bold text-slate-800
Subtítulo:        text-slate-500 (sin font-bold)
Título de card:   text-lg font-semibold
Cuerpo normal:    text-sm text-slate-800
Texto secundario: text-sm text-slate-500
Texto pequeño:    text-xs text-slate-400
```

---

## Layout general (Shell del dashboard)

### Estructura HTML obligatoria

```tsx
<div className="min-h-screen bg-slate-50">

  {/* Backdrop móvil del sidebar */}
  {sidebarOpen && (
    <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
         onClick={() => setSidebarOpen(false)} />
  )}

  {/* Sidebar fijo */}
  <aside className={cn(
    "fixed top-0 left-0 z-50 h-full w-64 bg-slate-900",
    "transform transition-transform duration-200 ease-in-out lg:translate-x-0",
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  )}>
    {/* Logo */}
    <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
      <div className="flex items-center space-x-2">
        <img src="/icons/icon-192.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
        <span className="text-white font-bold">NombreApp</span>
      </div>
      <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Info usuario */}
    <div className="px-4 py-4 border-b border-slate-800">
      <div className="text-sm text-slate-400">Conectado como</div>
      <div className="text-white font-medium truncate">{user.name}</div>
      <div className="text-xs text-blue-400 capitalize">{user.rol}</div>
    </div>

    {/* Navegación */}
    <nav className="flex-1 px-2 py-4 overflow-y-auto">
      {/* Ítem de menú activo */}
      <Link href="/ruta" className="flex items-center px-4 py-3 mb-1 rounded-lg text-sm font-medium
                                    bg-blue-600 text-white">
        <IconoRuta className="w-5 h-5 mr-3" />
        Página
      </Link>
      {/* Ítem inactivo */}
      <Link href="/otra" className="flex items-center px-4 py-3 mb-1 rounded-lg text-sm font-medium
                                    text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        <OtroIcono className="w-5 h-5 mr-3" />
        Otra
      </Link>
    </nav>

    {/* Logout */}
    <div className="p-4 border-t border-slate-800">
      <button onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium
                         text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        <LogOut className="w-5 h-5 mr-3" />
        Cerrar Sesión
      </button>
    </div>
  </aside>

  {/* Contenido principal */}
  <div className="lg:pl-64 min-w-0 overflow-x-hidden">

    {/* Top bar */}
    <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
      <div className="flex items-center justify-between h-16 px-4">
        <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-600 hover:text-slate-900">
          <Menu className="w-6 h-6" />
        </button>
        {/* Contenido del top bar */}
      </div>
    </header>

    {/* Página */}
    <main className="p-4 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden">
      {children}
    </main>

  </div>
</div>
```

---

## Encabezado de página

```tsx
<div className="space-y-6">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Título de la Sección</h1>
    <p className="text-slate-500">Descripción breve de la pantalla</p>
  </div>
  {/* contenido... */}
</div>
```

---

## Cards

```tsx
{/* Card estándar */}
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2">
      <Icono className="w-5 h-5 text-blue-600" />
      <span>Título</span>
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* contenido */}
  </CardContent>
</Card>

{/* Card de estadística (KPI) */}
<Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
  <CardContent className="pt-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-blue-700 font-medium">Etiqueta</p>
        <p className="text-2xl font-bold text-blue-900">42</p>
      </div>
      <Icono className="w-8 h-8 text-blue-600" />
    </div>
  </CardContent>
</Card>

{/* Grid de KPIs — 2 cols móvil, 4 cols desktop */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* cards de KPI */}
</div>
```

---

## Botones

```tsx
{/* Primario */}
<Button className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
  Acción Principal
</Button>

{/* Secundario */}
<Button variant="outline" className="min-h-[44px]">
  Acción Secundaria
</Button>

{/* Peligro */}
<Button className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]">
  Eliminar
</Button>

{/* Icono solo (móvil) + texto (desktop) */}
<Button className="flex-shrink-0 min-w-[44px] px-2 sm:px-4" aria-label="Descripción">
  <Icono className="w-4 h-4 sm:mr-2" />
  <span className="hidden sm:inline">Texto</span>
</Button>
```

**Regla:** mínimo `min-h-[44px]` y `min-w-[44px]` en todos los botones para área táctil en cocina.

---

## Formularios e Inputs

```tsx
{/* Input con icono de búsqueda */}
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
  <Input placeholder="Buscar..." className="pl-10" />
</div>

{/* Input estándar */}
<div>
  <Label>Campo</Label>
  <Input type="text" placeholder="..." />
</div>

{/* Textarea */}
<div>
  <Label>Notas</Label>
  <textarea className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white
                        text-slate-900 placeholder:text-slate-400 resize-none
                        focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3} />
</div>

{/* Select */}
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="opcion">Opción</SelectItem>
  </SelectContent>
</Select>
```

---

## Badges / Etiquetas de estado

```tsx
{/* OK / Disponible */}
<Badge className="bg-green-100 text-green-700">Normal</Badge>

{/* Alerta / Pendiente */}
<Badge className="bg-yellow-100 text-yellow-700">Pendiente</Badge>

{/* Error / Stock bajo */}
<Badge className="bg-red-100 text-red-700">Stock Bajo</Badge>

{/* Info / En proceso */}
<Badge className="bg-blue-100 text-blue-700">En proceso</Badge>

{/* Neutral */}
<Badge variant="secondary">Inactivo</Badge>
```

---

## Listas de ítems (tarjetas apiladas — patrón preferido en móvil)

```tsx
{/* NO usar tablas en móvil. Usar tarjetas apiladas: */}
<div className="space-y-3">
  {items.map((item) => (
    <div key={item.id}
         className="flex flex-col sm:flex-row sm:items-center sm:justify-between
                    p-4 bg-slate-50 rounded-lg border border-slate-200 gap-3">
      {/* Lado izquierdo: info principal */}
      <div className="flex items-start gap-3">
        <Icono className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{item.nombre}</p>
          <p className="text-sm text-slate-500">{item.descripcion}</p>
          {/* Datos secundarios — solo si tienen valor */}
          {(item.fabricante || item.formato) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {item.fabricante && <span>🏭 {item.fabricante}</span>}
              {item.fabricante && item.formato && <span className="mx-1">·</span>}
              {item.formato && <span>📦 {item.formato}</span>}
            </p>
          )}
        </div>
      </div>
      {/* Lado derecho: acciones/valor */}
      <div className="flex sm:flex-col items-center sm:items-end
                      justify-between sm:justify-start gap-2 pl-8 sm:pl-0 flex-shrink-0">
        <Badge className="bg-green-100 text-green-700">{item.estado}</Badge>
        <p className="text-sm text-slate-600">{item.fecha}</p>
      </div>
    </div>
  ))}
</div>
```

---

## Filtros / Barra de búsqueda

```tsx
{/* Grid responsivo: 2 cols móvil, 4 cols desktop */}
<Card>
  <CardContent className="py-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Buscador ocupa 2 cols en móvil */}
      <div className="relative col-span-2 md:col-span-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Buscar..." className="pl-10" />
      </div>
      <Select><SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>...</Select>
      <Select><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>...</Select>
      <Select><SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger>...</Select>
    </div>
  </CardContent>
</Card>
```

---

## Modales / Dialogs

```tsx
{/* bg-white explícito — NO usar bg-background */}
<Dialog>
  <DialogContent className="bg-white border-slate-200 max-w-[calc(100vw-2rem)] sm:max-w-lg
                             max-h-[calc(100vh-2rem)] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Título del Modal</DialogTitle>
      <DialogDescription>Descripción opcional</DialogDescription>
    </DialogHeader>
    {/* contenido */}
    <DialogFooter className="flex-col sm:flex-row gap-2">
      <Button variant="outline">Cancelar</Button>
      <Button className="bg-blue-600 hover:bg-blue-700">Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* AlertDialog de confirmación */}
<AlertDialog>
  <AlertDialogContent className="bg-white border-slate-200">
    <AlertDialogHeader>
      <AlertDialogTitle>¿Confirmar acción?</AlertDialogTitle>
      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Tabs

```tsx
{/* Full-width en móvil */}
<Tabs defaultValue="tab1">
  <TabsList className="w-full sm:w-auto">
    <TabsTrigger value="tab1" className="flex-1 sm:flex-none flex items-center justify-center gap-2">
      <Icono className="w-4 h-4" />
      <span>Tab 1</span>
    </TabsTrigger>
    <TabsTrigger value="tab2" className="flex-1 sm:flex-none flex items-center justify-center gap-2">
      <Icono className="w-4 h-4" />
      <span>Tab 2</span>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="tab1" className="mt-6">
    {/* contenido */}
  </TabsContent>
</Tabs>
```

---

## Grids responsivos

```tsx
{/* Contenido principal con sidebar lateral */}
{/* Móvil: columna única. Desktop: 2/3 + 1/3 */}
{/* IMPORTANTE: en móvil el formulario va PRIMERO (order) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-3 order-1">  {/* Header / buscador — siempre arriba */}
  <div className="order-2 lg:order-3">      {/* Formulario / panel derecho */}
    <Card className="lg:sticky top-24">
  <div className="lg:col-span-2 order-3 lg:order-2">  {/* Lista / contenido principal */}
</div>

{/* KPIs: 2 cols siempre en móvil, 4 en desktop */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">

{/* Tabla de admin: 1 col móvil, múltiples desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
```

---

## Reglas de responsividad obligatorias

### Lo que NUNCA hacer
```
❌ Tablas HTML (<table>) en pantallas de lista — usar tarjetas apiladas
❌ flex sin flex-wrap en filas con muchos elementos
❌ space-x-* en lugar de gap-* cuando hay riesgo de overflow
❌ text-2xl en móvil sin reducir con text-lg sm:text-2xl
❌ w-* fijo en elementos que deben ser fluidos
❌ bg-background, text-foreground (variables sin definir → transparente)
❌ Botones sin min-h-[44px] en vistas usadas en cocina/móvil
```

### Lo que SIEMPRE hacer
```
✅ Mobile-first: construir desde 360px hacia arriba
✅ flex-col en móvil → flex-row en sm:  (flex-col sm:flex-row)
✅ Texto que trunca en lista: truncate + min-w-0 en el padre
✅ Imágenes: object-cover + dimensiones fijas
✅ Áreas táctiles: min-h-[44px] min-w-[44px]
✅ Botones en móvil: solo icono + aria-label; texto en sm:
✅ Padding safe area en componentes fijos: env(safe-area-inset-bottom)
✅ overflow-x-hidden en el contenedor principal
✅ Datos secundarios condicionales: {valor && <span>...</span>}
```

---

## Indicador de conexión offline (PWA)

Todas las apps deben incluir el componente `SyncStatus` de `chefmanager-inv`:

```tsx
// Copia components/sync-status.tsx y lib/api-client.ts
// Monta en el DashboardShell:
import SyncStatus from "@/components/sync-status";
// ...dentro del return:
<SyncStatus />
```

---

## Headers de seguridad (next.config.js)

```js
const nextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self'",
            "media-src 'self' blob:",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    }];
  },
};
```

---

## Checklist antes de hacer deploy

- [ ] `bg-background` reemplazado por `bg-white` en todos los componentes flotantes
- [ ] Todos los botones tienen `min-h-[44px]`
- [ ] No hay tablas HTML en vistas de lista
- [ ] Modales tienen `bg-white` explícito
- [ ] `overflow-x-hidden` en contenedor principal
- [ ] Safe areas configuradas (`viewport-fit=cover` en layout)
- [ ] `/api/signup` o cualquier ruta de registro sin auth → eliminada
- [ ] Rate limiting en endpoints de autenticación
- [ ] `NEXTAUTH_SECRET` en variables de entorno (nunca en código)

---

## Referencia de archivos en chefmanager-inv

| Archivo | Qué copiar/adaptar |
|---------|-------------------|
| `app/(dashboard)/_components/dashboard-shell.tsx` | Shell completo del dashboard |
| `components/sync-status.tsx` | Indicador offline |
| `lib/offline-queue.ts` | Cola IndexedDB |
| `lib/api-client.ts` | Fetch wrapper offline |
| `lib/rate-limit.ts` | Rate limiter para auth |
| `app/globals.css` | Estilos base + scrollbar |
| `next.config.js` | Headers de seguridad + PWA |
| `public/manifest.json` | Plantilla manifest PWA |
