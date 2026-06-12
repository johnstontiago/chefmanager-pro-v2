// Unidades de medida disponibles para productos del inventario.
// Los envases con contenido ("Bolsa 25Kg", "Botella 33Cl") son entendidos
// por el módulo de fichas técnicas, que los convierte a g/ml para las
// recetas (ver unidadDeReceta en lib/fichas/costing.ts).

export const UNIDADES_MEDIDA = [
  { value: "kg", label: "Kg" },
  { value: "g", label: "G" },
  { value: "l", label: "L" },
  { value: "ml", label: "Ml" },
  { value: "bolsa 3kg", label: "Bolsa 3Kg" },
  { value: "bolsa 5kg", label: "Bolsa 5Kg" },
  { value: "bolsa 10kg", label: "Bolsa 10Kg" },
  { value: "bolsa 25kg", label: "Bolsa 25Kg" },
  { value: "caja", label: "Caja" },
  { value: "caja 12un", label: "Caja 12Un" },
  { value: "un", label: "Un" },
  { value: "botella 5l", label: "Botella 5L" },
  { value: "botella 3l", label: "Botella 3L" },
  { value: "botella 75cl", label: "Botella 75Cl" },
  { value: "botella 50cl", label: "Botella 50Cl" },
  { value: "botella 33cl", label: "Botella 33Cl" },
];
