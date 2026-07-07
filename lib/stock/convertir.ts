// Convierte una cantidad de unidadOrigen a unidadDestino.
// Soporta el mismo espacio de unidades que la app (g, kg, ml, l, un y envases).
// Si las unidades ya son iguales devuelve la cantidad sin cambios.
// Si no hay factor de conversión conocido devuelve la cantidad tal cual
// (evita lanzar excepción — el caller decide si la diferencia importa).

type UnidadBase = 'g' | 'ml' | 'un'

const FACTORES: Record<string, { base: UnidadBase; factor: number }> = {
  g:    { base: 'g',  factor: 1 },
  kg:   { base: 'g',  factor: 1000 },
  ml:   { base: 'ml', factor: 1 },
  cl:   { base: 'ml', factor: 10 },
  dl:   { base: 'ml', factor: 100 },
  l:    { base: 'ml', factor: 1000 },
  un:   { base: 'un', factor: 1 },
  ud:   { base: 'un', factor: 1 },
  uds:  { base: 'un', factor: 1 },
}

function parsearUnidad(u: string): { base: UnidadBase; factor: number } | null {
  const normalizada = u.trim().toLowerCase().replace(/\s+/g, ' ')

  // Primero buscar en tabla directa
  if (FACTORES[normalizada]) return FACTORES[normalizada]

  // Envases: "bolsa 25kg", "botella 75cl", "caja 12un", etc.
  const m = normalizada.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|dl|ml|un|ud|uds)$/)
  if (m) {
    const cantidad = parseFloat(m[1].replace(',', '.'))
    const unidadBase = FACTORES[m[2]]
    if (cantidad > 0 && unidadBase) {
      return { base: unidadBase.base, factor: cantidad * unidadBase.factor }
    }
  }

  return null
}

export function convertir(cantidad: number, desde: string, hasta: string): number {
  if (desde.trim().toLowerCase() === hasta.trim().toLowerCase()) return cantidad

  const origen  = parsearUnidad(desde)
  const destino = parsearUnidad(hasta)

  if (!origen || !destino || origen.base !== destino.base) return cantidad

  // cantidad × factor_origen / factor_destino
  return (cantidad * origen.factor) / destino.factor
}

// ¿Son "a" y "b" la misma unidad, o de la misma familia física (convertibles
// sin pérdida de sentido)? Permite distinguir una conversión real de un
// pass-through silencioso de convertir() cuando las familias no coinciden.
export function unidadesCompatibles(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  const oa = parsearUnidad(a)
  const ob = parsearUnidad(b)
  return !!oa && !!ob && oa.base === ob.base
}
