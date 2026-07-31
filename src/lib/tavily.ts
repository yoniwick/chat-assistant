export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface TavilyResponse {
  answer?: string;
  results: SearchResult[];
}

/**
 * Web search via the Tavily API. Returns a direct answer (when the API
 * provides one) plus the top results. Throws on missing API key.
 */
export async function webSearch(query: string): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
    }>;
  };

  return {
    answer: data.answer,
    results: (data.results ?? [])
      .slice(0, 5)
      .map((r) => ({
        title: r.title ?? "Untitled",
        url: r.url ?? "",
        snippet: r.content ?? "",
      }))
      .filter((r) => r.url.length > 0),
  };
}