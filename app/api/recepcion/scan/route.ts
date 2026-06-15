import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

const PROMPT = `Eres un sistema de lectura de etiquetas de productos alimentarios. Analiza la imagen con atención y extrae DOS campos:

**LOTE** — busca cualquiera de estas variantes:
- Prefijos: LOT, LOTE, L/, L:, LT, Lot No., Batch, Batch No., B/, Nº Lote, Nro. Lote, N° Lot
- Puede ser alfanumérico (ej: L2507A, LOT240615, B-12345X, 2507001A)
- Suele estar impreso en relieve, tinta negra sobre fondo claro, o al revés
- En productos italianos: LOTTO; en franceses: LOT; en alemanes: Charge/Ch.

**FECHA DE CADUCIDAD** — busca cualquiera de estas variantes:
- Prefijos: CAD, CADU, F.CAD, F.C., Fecha Cad., Consumir antes de, BBD, BB, Best Before, EXP, Exp. Date, Use By, Ablaufdatum, DLC, DLUO
- Formatos posibles: DD/MM/YYYY · DD/MM/YY · MM/YYYY · MM/YY · DD.MM.YY · YYYY-MM-DD · MES/YYYY (ej: ENE/2027)
- Para MM/YY o MM/YYYY usa siempre el ÚLTIMO día del mes (ej: 06/26 → 2026-06-30, 12/2026 → 2026-12-31)
- Años de 2 dígitos: 25→2025, 26→2026, 27→2027, 28→2028

Instrucciones CRÍTICAS — léelas antes de responder:
- Lee TODA la imagen, incluyendo bordes, laterales y texto pequeño
- NUNCA inventes, supongas ni completes datos que no estén visibles en la imagen
- Si no puedes leer un valor con certeza absoluta, devuelve null para ese campo
- Es preferible devolver null que devolver un valor incorrecto
- Devuelve el lote y la fecha TAL COMO APARECEN en la imagen, solo convierte el formato de fecha a YYYY-MM-DD
- No confundas la fecha de fabricación (FAB, MFG, Fabricación, Prod. Date) con la de caducidad
- Para años de 2 dígitos (ej: 26, 27) solo conviértelos si esos dígitos son claramente visibles en la imagen
- Para MM/YY o MM/YYYY usa el último día del mes ÚNICAMENTE si el mes y año son legibles con certeza
- Si la imagen está borrosa, mal iluminada o el texto no es legible, devuelve null en ambos campos

Responde ÚNICAMENTE con JSON válido, sin explicaciones ni texto adicional:
{"lote": "VALOR_EXACTO_O_NULL", "fechaCaducidad": "YYYY-MM-DD_O_NULL"}`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const llmKey = process.env.LLM_API_KEY;
  const llmBase = process.env.LLM_BASE_URL;
  const llmModel = process.env.LLM_MODEL;

  if (!anthropicKey && !llmKey) {
    return NextResponse.json(
      { error: "Escáner no configurado. Añade ANTHROPIC_API_KEY o LLM_API_KEY en las variables de entorno." },
      { status: 503 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  let image: string;
  try {
    ({ image } = JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Campo 'image' requerido" }, { status: 400 });
  }

  // Detectar tipo de imagen desde el data URI
  let mediaType = "image/jpeg";
  if (image.startsWith("data:image/png")) mediaType = "image/png";
  else if (image.startsWith("data:image/webp")) mediaType = "image/webp";
  else if (image.startsWith("data:image/gif")) mediaType = "image/gif";

  const base64 = image.replace(/^data:image\/[^;]+;base64,/, "");

  try {
    let responseText: string;

    if (anthropicKey) {
      // Anthropic Messages API (formato nativo)
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: llmModel ?? "claude-haiku-4-5-20251001",
          max_tokens: 512,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Anthropic API error:", err);
        return NextResponse.json({ error: "Error al procesar la imagen" }, { status: 502 });
      }

      const data = await res.json();
      responseText = data?.content?.[0]?.text ?? "";
    } else {
      // OpenAI-compatible API (Abacus.AI, etc.)
      const base64Url = `data:${mediaType};base64,${base64}`;
      const res = await fetch(`${llmBase}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: llmModel ?? "gpt-4o-mini",
          max_tokens: 512,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: base64Url } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("LLM API error:", err);
        return NextResponse.json({ error: "Error al procesar la imagen" }, { status: 502 });
      }

      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content ?? "";
    }

    // Extraer JSON de la respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ lote: null, fechaCaducidad: null });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      lote: parsed.lote ?? null,
      fechaCaducidad: parsed.fechaCaducidad ?? null,
    });
  } catch (error) {
    console.error("Error en scan:", error);
    return NextResponse.json({ error: "Error interno al procesar la imagen" }, { status: 500 });
  }
}
