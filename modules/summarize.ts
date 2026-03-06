import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  let text = "";
  let maxLength = 200;

  try {
    const body = await request.json();
    text = (body.text || body.content || "").trim();
    if (body.maxLength && typeof body.maxLength === "number" && body.maxLength > 0) {
      maxLength = Math.min(body.maxLength, 500);
    }
  } catch {
    try {
      text = (await request.text()).trim();
    } catch {
      return new Response(
        JSON.stringify({ error: "No se pudo leer el contenido." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!text) {
    return new Response(
      JSON.stringify({ error: "El texto está vacío." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY no configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content: "Eres un resumidor experto. Resume en español, de forma concisa, manteniendo los hechos clave. Usa bullets si el contenido lo permite."
          },
          {
            role: "user",
            content: `Resume en máximo ${maxLength} palabras: ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: Math.round(maxLength * 1.5),
        top_p: 0.9
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return new Response(
        JSON.stringify({ error: `Error de Groq: ${groqResponse.status} - ${errorText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await groqResponse.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || "No se pudo generar el resumen.";

    return new Response(
      JSON.stringify({
        summary,
        original_length: text.length,
        summary_length: summary.length,
        max_length_requested: maxLength,
        model_used: "llama3-70b-8192 via Groq",
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch {
    return new Response(
      JSON.stringify({ error: "Error interno. Intenta de nuevo." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}