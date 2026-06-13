/**
 * Lightweight language detection based on high-frequency word matching.
 * Returns an ISO 639-1 code. Falls back to "en".
 */

const MARKERS: Record<string, string[]> = {
  da: [
    // stop words
    "og", "at", "er", "den", "det", "af", "til", "en", "et", "jeg", "som", "for", "med", "ikke",
    "vi", "du", "din", "dit", "vores", "hos", "vil", "kan", "har", "men", "der", "om",
    // job-posting words unique to Danish
    "stilling", "ansøgning", "ansøger", "søger", "udvikler", "udvikling", "virksomhed",
    "erfaring", "hjemmeside", "forsikring", "pension", "arbejde", "løn", "dansksproget",
    "dansktalende", "opgaver", "team", "kolleger", "mulighed",
  ],
  sv: ["och", "att", "är", "en", "det", "av", "till", "som", "för", "med", "inte", "vi", "du", "din", "vill", "kan", "har", "men", "jobb", "arbete", "söker", "erfarenhet"],
  no: ["og", "er", "til", "det", "av", "som", "ikke", "men", "har", "vi", "du", "din", "vil", "kan", "jobb", "arbeid", "søker", "erfaring"],
  de: ["und", "der", "die", "das", "ist", "ich", "sie", "wir", "nicht", "für", "mit", "haben", "eine", "einen", "werden", "stellen", "erfahrung", "aufgaben", "unternehmen"],
  nl: ["de", "het", "een", "van", "en", "is", "dat", "voor", "met", "niet", "zijn", "wij", "jij", "jouw", "werk", "functie", "ervaring", "bedrijf"],
  fr: ["le", "la", "les", "un", "une", "de", "est", "je", "vous", "pour", "dans", "que", "nous", "poste", "entreprise", "expérience", "travail"],
  es: ["el", "la", "los", "un", "una", "de", "es", "que", "por", "para", "con", "nos", "puesto", "empresa", "experiencia", "trabajo"],
  en: ["the", "and", "to", "of", "is", "in", "you", "that", "for", "have", "with", "we", "our", "role", "team", "experience", "company", "will", "join"],
};

export const LANGUAGE_LABELS: Record<string, { category: string; position: string }> = {
  da: { category: "ANSØGNING", position: "STILLING" },
  sv: { category: "ANSÖKAN",   position: "TJÄNST" },
  no: { category: "SØKNAD",    position: "STILLING" },
  de: { category: "BEWERBUNG", position: "STELLE" },
  nl: { category: "SOLLICITATIE", position: "FUNCTIE" },
  fr: { category: "CANDIDATURE", position: "POSTE" },
  es: { category: "SOLICITUD", position: "PUESTO" },
  en: { category: "APPLICATION", position: "POSITION" },
};

export function detectLanguage(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-zæøåäöü\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const wordSet = new Set(words);
  const scores: Record<string, number> = {};

  for (const [lang, markers] of Object.entries(MARKERS)) {
    scores[lang] = markers.filter((m) => wordSet.has(m)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "en";
}
