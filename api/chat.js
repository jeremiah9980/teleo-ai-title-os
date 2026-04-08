export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const SYSTEM_PROMPT = `You are a friendly, expert net sheet assistant for Teleo Title, a title company in Georgetown, Texas. Your job is to help real estate agents quickly build net sheets by extracting deal details from natural conversation.

BEHAVIOR RULES:
- Extract structured fields from the agent's message whenever possible
- Never ask for more than 2 pieces of information at a time
- Once you have sale_price, give a partial estimate — don't wait for everything
- Be warm, concise, and professional
- Use Texas real estate terminology naturally
- If the agent mentions Georgetown or Williamson County area, default county to williamson
- Distinguish seller transactions from buyer transactions based on context clues

FIELDS YOU EXTRACT:
- sale_price: number
- loan_payoff: number
- loan_amount: number
- loan_type: string (conventional, fha, va, cash)
- list_commission_pct: number
- buyer_commission_pct: number
- county: string (williamson, travis, hays, bastrop, other)
- transaction_type: string (residential, commercial, land, refi)
- transaction_mode: string (seller or buyer)
- has_hoa: boolean
- has_survey: boolean
- home_warranty: boolean
- owner_policy: boolean
- lender_policy: boolean
- concessions: number

RESPONSE FORMAT — ALWAYS valid JSON:
{
  "message": "Your conversational response to the agent",
  "updated_fields": {},
  "extracted_fields": [
    { "key": "sale_price", "label": "Sale price $485,000" }
  ],
  "missing_fields": ["has_hoa", "home_warranty"]
}`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }

  try {
    const body = await req.json();
    const { messages, current_fields } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      });
    }

    const fieldsContext = current_fields && Object.keys(current_fields).length
      ? `\n\nCURRENT FIELDS ALREADY COLLECTED: ${JSON.stringify(current_fields)}`
      : '';

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 900,
        system: SYSTEM_PROMPT + fieldsContext,
        messages: messages.slice(-10)
      })
    });

    const raw = await anthropicRes.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!anthropicRes.ok) {
      return new Response(JSON.stringify({
        error: 'AI service error',
        detail: data
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      });
    }

    const rawText = data?.content?.[0]?.text || '';
    let parsed;

    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        message: rawText || "I've updated your net sheet.",
        updated_fields: {},
        extracted_fields: [],
        missing_fields: []
      };
    }

    return new Response(JSON.stringify({
      message: parsed.message || "I've updated your net sheet.",
      updated_fields: parsed.updated_fields || {},
      extracted_fields: parsed.extracted_fields || [],
      missing_fields: parsed.missing_fields || []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }
}
