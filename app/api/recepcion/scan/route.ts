import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

const PROMPT = `Analiza esta etiqueta de producto alimentario y extrae:
1. Número de lote (puede aparecer como "LOT", "LOTE", "L:", "Lot No.", "Batch", "L/N", o simplemente un código alfanumérico)
2. Fecha de caducidad (puede aparecer como "CAD", "CADU", "F.CAD", "BBD", "EXP", "Best Before", "Consume antes de", con formatos DD/MM/YYYY, MM/YYYY, DD.MM.YY, etc.)

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"lote": "VALOR_O_NULL", "fechaCaducidad": "YYYY-MM-DD_O_NULL"}

Para fechas con solo mes/año (como 12/26 o 12/2026), usa el último día del mes: 2026-12-31.
Si no encuentras algún campo, usa null.`;

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
          max_tokens: 256,
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
          max_tokens: 256,
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
