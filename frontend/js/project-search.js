// Keyword search over projects. Every word in the query must appear somewhere in the project;
// results are ranked so title matches always come before address/description matches.

// how much a match in each field counts. Any title match (10+) outranks the best possible
// description match (3), so title hits always come first.
const SEARCH_FIELDS = [
  { weight: 10, text: (p) => p.name },
  { weight: 3, text: (p) => p.address },
  { weight: 1, text: (p) => p.description },
  { weight: 1, text: (p) => `${formatDateRange(p)} ${formatDate(p.submittedAt)}` },
];

const TITLE_PHRASE_BONUS = 20; // whole query appears as-is in the title

// returns matching projects, best match first (ties keep their original order)
function searchProjects(projects, query) {
  const words = splitWords(query);
  if (words.length === 0) return projects;

  return projects
    .map((project, index) => ({ project, index, score: scoreProject(project, words, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((result) => result.project);
}

// 0 if any word is missing from every field
function scoreProject(project, words, query) {
  const fields = SEARCH_FIELDS.map((field) => ({ weight: field.weight, text: (field.text(project) || "").toLowerCase() }));
  let total = 0;

  for (const word of words) {
    const best = Math.max(...fields.map((field) => field.weight * wordMatchStrength(field.text, word)));
    if (best === 0) return 0;
    total += best;
  }

  const phrase = query.trim().toLowerCase();
  if (words.length > 1 && fields[0].text.includes(phrase)) total += TITLE_PHRASE_BONUS;
  return total;
}

// 3 = whole word ("hall"), 2 = start of a word ("renov" in "renovation"), 1 = anywhere, 0 = none
function wordMatchStrength(text, word) {
  if (!text.includes(word)) return 0;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`).test(text)) return 3;
  if (new RegExp(`\\b${escaped}`).test(text)) return 2;
  return 1;
}

function splitWords(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}
