import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get('word');
  if (!word) {
    return Response.json({ examples: [] });
  }

  try {
    const res = await fetch(
      `https://tatoeba.org/api_v0/search?query=${encodeURIComponent(word)}&from=eng`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return Response.json({ examples: [] });

    const data = await res.json();
    const examples: string[] = (data?.results ?? [])
      .slice(0, 5)
      .map((s: { text: string }) => s.text)
      .filter(Boolean);

    return Response.json({ examples });
  } catch {
    return Response.json({ examples: [] });
  }
}
