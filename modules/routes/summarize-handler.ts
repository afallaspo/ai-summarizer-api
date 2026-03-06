import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  let text = "";

  // Intentamos leer el body como JSON (lo más común)
  try {
    const body = await request.json();
    // Aceptamos tanto "text" como "content" para mayor flexibilidad
    text = body.text || body.content || "";
  } catch (jsonErr) {
    // Si falla json() → intentamos leer como texto plano
    try {
      text = await request.text();
    } catch (textErr) {
      return {
        error: "No se pudo leer el contenido enviado. Envía un JSON con { \"text\": \"tu texto aquí\" } o simplemente texto plano."
      };
    }
  }

  // Quitamos espacios en blanco y verificamos que haya contenido
  text = text.trim();

  if (!text) {
    return {
      error: "El texto a resumir está vacío. Envía contenido en 'text' o directamente en el body."
    };
  }

  // Obtenemos la clave de Groq desde variables de entorno (más seguro)
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return {
      error: "La clave de Groq no está configurada. Contacta al administrador."
    };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",  // Puedes cambiar a "mixtral-8x7b-32768" o "gemma2-9b-it" si prefieres
        messages: [
          {
            role: "system",
            content: "Eres un resumidor experto y preciso. Resume el texto en español, de forma concisa, manteniendo los hechos clave. Usa bullets si el contenido lo permite. Evita agregar información que no esté en el texto original."
          },
          {
            role: "user",
            content: `Resume este contenido: ${text}`
          }
        ],
        temperature: 0.3,      // Bajo para resúmenes más fieles y consistentes
        max_tokens: 400,       // Límite razonable para resúmenes (ajusta si quieres más largos)
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

    return { summary };
  } catch (fetchErr) {
    return {
      error: "Error interno al procesar el resumen. Intenta de nuevo más tarde."
    };
  }
}