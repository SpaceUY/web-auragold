export interface FaqItem {
  question: string;
  answer: string;
}

// El blog usa dos convenciones para "Preguntas frecuentes": posts más viejos
// ponen cada pregunta como H3 seguida de un párrafo; posts más nuevos usan
// "**¿Pregunta?** Respuesta." inline. Parseamos ambas desde el markdown crudo
// para generar FAQPage schema sin duplicar contenido en el frontmatter.
export function extractFaqFromMarkdown(markdown: string): FaqItem[] {
  const heading = markdown.match(/^##\s+.*preguntas frecuentes.*$/im);
  if (!heading || heading.index === undefined) return [];

  const afterHeading = markdown.slice(heading.index + heading[0].length);
  const nextH2Offset = afterHeading.search(/\n##\s/);
  const block = nextH2Offset === -1 ? afterHeading : afterHeading.slice(0, nextH2Offset);

  return /^###\s/m.test(block) ? extractHeadingPairs(block) : extractInlinePairs(block);
}

function extractInlinePairs(block: string): FaqItem[] {
  const items: FaqItem[] = [];
  const pairPattern = /\*\*(.+?)\*\*\s*([^\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(block))) {
    const question = stripMarkdown(match[1]);
    const answer = stripMarkdown(match[2]);
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

function extractHeadingPairs(block: string): FaqItem[] {
  const items: FaqItem[] = [];
  const parts = block.split(/\n###\s+/).slice(1);
  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    const question = stripMarkdown(newlineIdx === -1 ? part : part.slice(0, newlineIdx));
    const answer = stripMarkdown(newlineIdx === -1 ? "" : part.slice(newlineIdx + 1));
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
