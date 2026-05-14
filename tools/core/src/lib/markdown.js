// Markdown helpers used across tools. Heading detection, slug computation,
// section extraction. No HTML rendering — that's tool-specific.

// SPEC §5.6 heading slug.
export function headingSlug(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

// First H1, or null. Body must start (after blank lines) with an `# H1`.
export function firstH1(text) {
  if (typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[0] === "---") {
    let j = 1;
    while (j < lines.length && lines[j] !== "---") j++;
    if (j < lines.length) i = j + 1;
  }
  while (i < lines.length && lines[i].trim() === "") i++;
  for (; i < lines.length; i++) {
    const ln = lines[i];
    const m = /^# +(.+?)\s*$/.exec(ln);
    if (m) return m[1].trim();
    if (ln.trim() !== "") break;
  }
  return null;
}

// All headings → list of { level, text, slug, lineIndex }.
export function allHeadings(text) {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6}) +(.+?)\s*$/.exec(lines[i]);
    if (m) {
      out.push({
        level: m[1].length,
        text: m[2],
        slug: headingSlug(m[2]),
        lineIndex: i,
      });
    }
  }
  return out;
}

// Detect markdown frontmatter (forbidden in 0.8).
export function hasFrontmatter(text) {
  if (typeof text !== "string") return false;
  if (!text.startsWith("---")) return false;
  const firstNl = text.indexOf("\n");
  if (firstNl !== 3 && !(firstNl === 4 && text[3] === "\r")) return false;
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < Math.min(lines.length, 200); i++) {
    if (lines[i] === "---") return true;
  }
  return false;
}

// Extract markdown section by heading slug. Returns slice (inclusive of
// heading) up to but not including next heading at same-or-higher level.
export function extractMarkdownSection(src, slug) {
  if (typeof src !== "string" || !slug) return null;
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let foundLevel = -1;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    if (headingSlug(m[2]) === slug) {
      foundLevel = m[1].length;
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let j = startIdx + 1; j < lines.length; j++) {
    const m = lines[j].match(/^\s*(#{1,6})\s+/);
    if (m && m[1].length <= foundLevel) { endIdx = j; break; }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

// Title precedence per SPEC §2.3. JSON > H1 > slug-titlecase.
export function resolveTitle(record) {
  const data = record.data || record.json;
  if (data && typeof data.title === "string" && data.title.length > 0) {
    return { source: "json", value: data.title };
  }
  if (record.h1) return { source: "h1", value: record.h1 };
  if (record.body) {
    const h1 = firstH1(record.body);
    if (h1) return { source: "h1", value: h1 };
  }
  if (record.slug) {
    const titlecased = record.slug
      .split("-")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return { source: "slug", value: titlecased };
  }
  return { source: "slug", value: "" };
}
