import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  let text = "";

  // Intentamos leer el body como JSON
  try {
    const body = await request.json();
    text = body.text || body.content || "";
  } catch (jsonErr) {
    // Fallback a texto plano si no es JSON
    try {
      text = await request.text();
    } catch (textErr) {
      return {
        error: "No se pudo leer el contenido. Envía JSON con { \"text\": \"...\", \"maxLength\": 150 } o texto plano."
      };
    }
  }

  text = text.trim();

  if (!text) {
    return {
      error: "El texto a resumir está vacío. Envía contenido válido."
    };
  }

  // Obtenemos la clave de Groq
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return {
      error: "La clave de Groq no está configurada."
    };
  }

  // Parámetro opcional maxLength (por defecto 200 palabras)
  let maxLength = 200;
  try {
    const body = await request.json(); // Volvemos a leer body para obtener maxLength
    if (body.maxLength && typeof body.maxLength === 'number' && body.maxLength > 0) {
      maxLength = Math.min(body.maxLength, 500); // Límite razonable para evitar abusos
    }
  } catch {
    // Si no hay body JSON, usamos el default
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: "Eres un resumidor experto y preciso. Resume el texto en español, de forma concisa, manteniendo los hechos clave. Usa bullets si el contenido lo permite. Evita agregar información que no esté en el texto original."
          },
          {
            role: "user",
            content: `Resume este contenido en máximo ${maxLength} palabras: ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: Math.round(maxLength * 1.5), // Aproximación conservadora (1 palabra ~1.5 tokens)
        top_p: 0.9
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Error al contactar Groq: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || "No se pudo generar el resumen.";

    // Respuesta profesional con metadatos
    return {
      summary,
      original_length: text.length,
      summary_length: summary.length,
      max_length_requested: maxLength,
      model_used: "llama3-70b-8192 via Groq",
      timestamp: new Date().toISOString()
    };

  } catch (fetchErr) {
    return {
      error: "Error interno al procesar el resumen. Intenta de nuevo más tarde."
    };
  }
}