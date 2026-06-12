# Fase 2 — Capa de IA generativa sobre las sugerencias de pedido

> Estado: **pendiente** (diseño guardado). La Fase 1 (motor estadístico +
> festivos + borrador de pedido) ya está implementada y en producción.
> Este documento describe cómo añadir la capa LLM cuando se decida activarla.

## Objetivo

Añadir lenguaje natural e inteligencia contextual encima del motor
determinista de `lib/predicciones/engine.ts`, sin sustituirlo. El LLM
**nunca calcula cantidades** — explica, resume y detecta patrones; los
números siguen saliendo de la estadística local (auditable y gratis).

## Casos de uso

1. **Explicación del pedido sugerido**: párrafo en lenguaje natural que
   resume el borrador ("Esta semana sube la harina un 20% por la media de
   las últimas 4 semanas; se añade colchón por el puente del 12 de octubre").
2. **Detección de anomalías**: comparar la serie semanal de cada producto
   y avisar de desviaciones ("el consumo de mozzarella se duplicó en las
   últimas 2 semanas — ¿cambio de carta o merma sin registrar?").
3. **Ajuste conversacional**: el usuario escribe "este finde tenemos un
   evento de 80 personas con menú de pizzas" y el LLM propone ajustes
   sobre las líneas sugeridas (siempre como propuesta editable).
4. **Resumen semanal por email/notificación** (opcional): estado de stock,
   festivos próximos y pedido recomendado.

## Arquitectura (agnóstica al proveedor)

El usuario quiere poder usar **Abacus.AI** como motor LLM. Abacus expone
su servicio (RouteLLM/ChatLLM) mediante API **compatible con el formato
OpenAI**, así que la integración se hace contra ese estándar y el
proveedor se elige por configuración:

```env
# .env (Railway)
LLM_BASE_URL=https://routellm.abacus.ai/v1   # o https://api.openai.com/v1, etc.
LLM_API_KEY=sk-...
LLM_MODEL=route-llm                           # o claude-sonnet-4-6, gpt-4o, ...
```

> Verificar en el momento de implementar: URL exacta del endpoint de
> Abacus, nombre del modelo y si el plan contratado incluye acceso API
> (sus planes cambian con frecuencia).

### Componentes nuevos (todo aditivo)

```
lib/predicciones/llm.ts        ← adaptador HTTP fino (fetch a LLM_BASE_URL,
                                  formato chat/completions de OpenAI)
app/api/predicciones/explicar/route.ts   ← POST: recibe el resultado del
                                  motor + festivos y devuelve la explicación
app/api/predicciones/anomalias/route.ts  ← GET: series semanales → aviso
```

UI: un bloque "Análisis IA" en `/pedidos/sugerencias` (botón "Explicar
este pedido"), renderizando el texto devuelto. Si `LLM_API_KEY` no está
configurada, el bloque no se muestra — la Fase 1 sigue funcionando igual.

### Contrato del adaptador

```ts
// lib/predicciones/llm.ts
export async function chatLLM(messages: { role: string; content: string }[]) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
```

### Esqueleto del prompt (explicación)

```
Sistema: Eres el asistente de compras de un restaurante. Recibes el pedido
semanal sugerido por un motor estadístico (consumo de 12 semanas, stock,
colchón, festivos). Explica en español, en 4-6 frases, por qué se sugiere
este pedido. No cambies cantidades. Señala los 2-3 productos más relevantes
y el efecto del festivo si lo hay.

Usuario: { JSON con lineas[], festivos[], factorFestivo }
```

## Reglas de seguridad

- Los datos enviados al LLM son agregados de consumo (nombres de producto y
  cantidades) — sin datos personales. Aun así, no enviar nombres de
  usuarios ni emails.
- El LLM no escribe en la base de datos: solo devuelve texto/propuestas;
  cualquier cambio pasa por los endpoints existentes con su auth y tenant.
- Timeout corto (10 s) y degradación silenciosa: si el LLM falla, la
  página de sugerencias funciona igual que en Fase 1.

## Coste estimado

Una explicación ≈ 1-2k tokens entrada + 300 salida → céntimos por uso con
cualquier proveedor. Con suscripción ChatLLM de Abacus, incluido hasta el
límite del plan.

## Checklist de implementación (cuando se active)

- [ ] Confirmar acceso API del plan de Abacus (o elegir otro proveedor)
- [ ] Añadir `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` en Railway
- [ ] `lib/predicciones/llm.ts` (adaptador + manejo de errores)
- [ ] `POST /api/predicciones/explicar` (roles: superuser/admin/recepcion)
- [ ] `GET /api/predicciones/anomalias`
- [ ] Bloque "Análisis IA" en `/pedidos/sugerencias` (oculto sin API key)
- [ ] Probar con festivo próximo y sin festivo
