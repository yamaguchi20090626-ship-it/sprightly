import type { Meaning } from '../types/word';

export async function fetchSuggestions(prefix: string, max = 8): Promise<string[]> {
  if (prefix.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://api.datamuse.com/sug?s=${encodeURIComponent(prefix.trim())}&max=${max}`
    );
    if (!res.ok) return [];
    const data: Array<{ word: string }> = await res.json();
    return data.map((d) => d.word);
  } catch {
    return [];
  }
}

export async function fetchExamples(word: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://tatoeba.org/en/api_v0/search?query=${encodeURIComponent(word)}&from=eng&to=jpn&limit=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 3).map((r: { text: string }) => r.text);
  } catch {
    return [];
  }
}

interface DictDefinition {
  definition: string;
  example?: string;
}

interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
  synonyms?: string[];
}

interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings: DictMeaning[];
}

export interface DictResult {
  word: string;
  phonetic?: string;
  meanings: Meaning[];
}

export async function fetchWord(word: string): Promise<DictResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );
    if (!res.ok) return null;
    const data: DictEntry[] = await res.json();
    if (!data.length) return null;
    const entry = data[0];
    const phonetic = entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text;
    const meanings: Meaning[] = entry.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 3).map((d) => ({
        definition: d.definition,
        example: d.example,
      })),
      synonyms: m.synonyms?.slice(0, 5) ?? [],
    }));
    return { word: entry.word, phonetic, meanings };
  } catch {
    return null;
  }
}
