interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiCandidatePart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface GeminiPlaylistResponse {
  queries: Array<{
    query: string;
    reason?: string;
  }>;
}

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function extractJsonPayload(raw: string): GeminiPlaylistResponse | null {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```json([^`]+)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;

  try {
    const parsed = JSON.parse(candidate) as GeminiPlaylistResponse;
    if (Array.isArray(parsed.queries)) {
      return parsed;
    }
  } catch {
    // swallow parsing errors and fallback
  }

  return null;
}

export type GeminiSuggestion = {
  query: string;
  reason?: string;
};

export async function requestGeminiSetList(prompt: string, minutes: number): Promise<GeminiSuggestion[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key missing. Set VITE_GEMINI_API_KEY.');
  }

  const safeMinutes = Math.max(15, Math.min(240, Math.round(minutes)));

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'You are DJ Gemini, a creative Spotify party selector.',
              'Given the desired vibe and duration, craft a JSON object with field "queries",',
              'an array of 15-20 search prompts to feed into the Spotify Web API.',
              'Each query should mix track titles or artist names that currently exist on Spotify,',
              'keeping the full set around the target duration by balancing upbeat and chill selections.',
              'Example JSON:',
              '{ "queries": [ { "query": "artist - track", "reason": "short note" } ] }',
              'Avoid markdown. Respond with pure JSON only.',
              `Vibe prompt: "${prompt || 'feel-good office party playlist'}"`,
              `Target duration (minutes): ${safeMinutes}`
            ].join(' ')
          }
        ]
      }
    ]
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n') ?? '';

  const parsed = extractJsonPayload(text);
  if (!parsed) {
    throw new Error('Gemini response was not valid JSON.');
  }

  const unique: GeminiSuggestion[] = [];
  const seen = new Set<string>();

  parsed.queries.forEach((item) => {
    const query = item.query.trim();
    if (!query || seen.has(query)) {
      return;
    }
    seen.add(query);
    unique.push({ query, reason: item.reason?.trim() || undefined });
  });

  if (unique.length === 0) {
    throw new Error('Gemini returned an empty selection.');
  }

  return unique;
}
