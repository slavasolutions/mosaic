// Render one page (or record-as-page) into HTML.
//
// Wireframe-quality output. Each page produces:
//   <header>  ← from `header` singleton if present
//   <main>    ← title + body + sections
//   <footer>  ← from `footer` singleton if present
//
// Section dispatch:
//   collection-list → <ul class="collection-list">
//   hero            → <section class="hero">
//   prose (from)    → load markdown, inline
//   stat-grid       → <section class="stat-grid">
//   feature-grid    → <section class="feature-grid">
//   any other       → <section data-type=...> generic dump
//
// Refs are deep-followed up to depth=1 to avoid cycles (spec leaves refs as
// stubs in the index; we materialise URL + title here).

import { escapeHtml, escapeAttr } from "./html.js";
import { renderMarkdown } from "./markdown.js";
import { isRefString, parseRef, resolveRef } from "./resolve-refs.js";

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export function renderPage({ kind, record, url, index, base }) {
  // kind: "page" | "record"
  const siteName = index.site.name || "";
  const locale = index.site.locale || "en";
  const title = record.title || (kind === "page" ? siteName : "");
  const titleSuffix = siteName && title !== siteName ? ` — ${siteName}` : "";
  const pageTitle = `${title}${titleSuffix}`;
  const baseHref = base || "";

  // For a page at URL /foo/bar we render to <out>/foo/bar/index.html. To make
  // links resolvable when the file is opened directly (no server), we convert
  // every root-relative URL (`/x/y`) to a `../../x/y` prefixed form. The depth
  // is the number of path segments in the URL (excluding the trailing index).
  // The home page `/` has depth 0; `/about` has depth 1; `/team/anna` has depth 2.
  const ctx = {
    index,
    base: baseHref,
    pagePrefix: computePagePrefix(url),
  };

  const headerHtml = renderHeader(index, ctx);
  const footerHtml = renderFooter(index, ctx);
  const body = renderRecordBody({ record, title, ctx, kind });

  return `<!doctype html>
<html lang="${escapeAttr(locale)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(pageTitle)}</title>
  <link rel="stylesheet" href="${escapeAttr(toHref(ctx, "/_tokens.css"))}">
  <link rel="stylesheet" href="${escapeAttr(toHref(ctx, "/_styles.css"))}">
</head>
<body>
${headerHtml}
<main>
  <h1>${escapeHtml(title)}</h1>
${body}
</main>
${footerHtml}
</body>
</html>
`;
}

// Compute the relative-prefix needed to reach the output root from this page's
// directory. /          → ""           (page is at <out>/index.html)
//            /about     → "../"        (page is at <out>/about/index.html)
//            /team/anna → "../../"
function computePagePrefix(url) {
  if (!url || url === "/") return "";
  const segs = url.replace(/^\/+/, "").split("/").filter(Boolean);
  return "../".repeat(segs.length);
}

// Convert a logical URL ('/x/y' or 'mailto:...' or 'http://...') into the href
// to emit. If a --base prefix is set, root-relative URLs are joined to that
// prefix and emitted as-is (we assume a server is rooted there). Otherwise,
// root-relative URLs are rewritten as page-relative paths using `pagePrefix`.
function toHref(ctx, url) {
  if (typeof url !== "string" || !url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#") || url.startsWith("//")) return url;
  if (ctx.base) return joinUrl(ctx.base, url);
  if (!url.startsWith("/")) return url; // already relative
  const stripped = url.replace(/^\/+/, "");
  if (!ctx.pagePrefix) return stripped || "./";
  return ctx.pagePrefix + stripped;
}

// ---------------------------------------------------------------------------
// Site header / footer singletons.
// ---------------------------------------------------------------------------

function renderHeader(index, ctx) {
  const rec = index.singletons.header;
  if (!rec) return "";
  const data = rec.data || {};
  const logo = data.logo;
  const nav = Array.isArray(data.nav) ? data.nav : [];
  const localCtx = withContextDir(ctx, rec.jsonDir);

  let logoHtml = "";
  if (logo) {
    const resolved = resolveValue(logo, index, rec.jsonDir);
    if (resolved && resolved.kind === "asset") {
      const dest = toHref(ctx, "/" + resolved.assetPath);
      logoHtml = `<a class="site-logo" href="${escapeAttr(toHref(ctx, "/"))}">` +
        `<img src="${escapeAttr(dest)}" alt="${escapeAttr(resolved.alt || index.site.name || "")}"` +
        (resolved.width ? ` width="${resolved.width}"` : "") +
        (resolved.height ? ` height="${resolved.height}"` : "") +
        `></a>`;
    } else {
      logoHtml = `<a class="site-logo" href="${escapeAttr(toHref(ctx, "/"))}">${escapeHtml(index.site.name || "")}</a>`;
    }
  } else if (index.site.name) {
    logoHtml = `<a class="site-logo" href="${escapeAttr(toHref(ctx, "/"))}">${escapeHtml(index.site.name)}</a>`;
  }

  const navItems = nav
    .filter((n) => n && typeof n === "object")
    .map((n) => {
      const label = renderInlineValue(n.label, localCtx);
      const href = resolveLinkHref(n.url, localCtx);
      return `    <li><a href="${escapeAttr(href)}">${label}</a></li>`;
    })
    .join("\n");

  return `<header class="site-header">
  ${logoHtml}
  <nav><ul>
${navItems}
  </ul></nav>
</header>
`;
}

function renderFooter(index, ctx) {
  const rec = index.singletons.footer;
  if (!rec) return "";
  const data = rec.data || {};
  const localCtx = withContextDir(ctx, rec.jsonDir);
  const copyright = renderInlineValue(data.copyright, localCtx);
  const links = Array.isArray(data.links) ? data.links : [];
  const linkItems = links
    .filter((l) => l && typeof l === "object")
    .map((l) => {
      const label = renderInlineValue(l.label, localCtx);
      const href = resolveLinkHref(l.url, localCtx);
      return `    <li><a href="${escapeAttr(href)}">${label}</a></li>`;
    })
    .join("\n");
  return `<footer class="site-footer">
  ${copyright ? `<p>${copyright}</p>` : ""}
  ${links.length ? `<nav><ul>\n${linkItems}\n  </ul></nav>` : ""}
</footer>
`;
}

function withContextDir(ctx, contextDir) {
  return {
    index: ctx.index,
    base: ctx.base,
    pagePrefix: ctx.pagePrefix,
    contextDir,
  };
}

// ---------------------------------------------------------------------------
// Record body: title is rendered in the wrapper; we emit body + sections here.
// ---------------------------------------------------------------------------

function renderRecordBody({ record, title, ctx, kind }) {
  let out = "";
  const data = record.data || {};
  const hasSections = Array.isArray(data.sections) && data.sections.length > 0;
  const recCtx = withContextDir(ctx, record.jsonDir);

  if (record.body && !hasSections) {
    out += renderMarkdown(record.body, { stripFirstH1: true });
  }

  const sections = Array.isArray(data.sections) ? data.sections : [];
  for (const sec of sections) {
    if (!sec || typeof sec !== "object") continue;
    out += renderSection(sec, recCtx);
  }

  if (kind === "record") {
    out += renderRemainingFields(data, recCtx);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Section dispatch.
// ---------------------------------------------------------------------------

function renderSection(sec, ctx) {
  const type = sec.type || "section";
  if (type === "collection-list") return renderCollectionList(sec, ctx);
  if (type === "hero") return renderHero(sec, ctx);
  if (type === "prose") return renderProse(sec, ctx);
  if (type === "stat-grid") return renderStatGrid(sec, ctx);
  if (type === "feature-grid") return renderFeatureGrid(sec, ctx);
  if (type === "page-intro") return renderPageIntro(sec, ctx);
  if (type === "cta") return renderCta(sec, ctx);
  if (type === "contact-block") return renderContactBlock(sec, ctx);
  if (type === "form") return renderForm(sec, ctx);
  if (type === "definition-list") return renderDefinitionList(sec, ctx);
  if (type === "pull-quote") return renderPullQuote(sec, ctx);
  if (type === "principles") return renderPrinciples(sec, ctx);
  return renderGenericSection(sec, ctx);
}

function renderCollectionList(sec, ctx) {
  const { index } = ctx;
  const from = typeof sec.from === "string" ? sec.from : "";
  const cname = from.startsWith("collections/") ? from.slice(12) : from;
  const coll = index.collections[cname];
  if (!coll) {
    return `<section class="collection-list-empty">
  <p class="mosaic-unresolved">Missing collection: ${escapeHtml(from)}</p>
</section>
`;
  }
  const records = sortRecords(Object.values(coll.records), sec.sort, coll.defaultSort);
  const limit = typeof sec.limit === "number" && sec.limit > 0 ? sec.limit : records.length;
  const slice = records.slice(0, limit);

  const items = slice.map((r) => {
    const linkable = r.url && sec.routes !== false;
    const dateStr = r.data && r.data.date ? ` <span class="meta">${escapeHtml(String(r.data.date))}</span>` : "";
    const summaryStr = r.data && r.data.summary
      ? `<div class="meta">${escapeHtml(String(r.data.summary))}</div>`
      : "";
    if (linkable) {
      return `  <li><a href="${escapeAttr(toHref(ctx, r.url))}">${escapeHtml(r.title)}</a>${dateStr}${summaryStr}</li>`;
    }
    return `  <li>${escapeHtml(r.title)}${dateStr}${summaryStr}</li>`;
  }).join("\n");

  const titleAttr = coll.name ? ` data-collection="${escapeAttr(coll.name)}"` : "";
  return `<section class="collection-list-section"${titleAttr}>
  <h2 class="section-title">${escapeHtml(coll.name)}</h2>
  <ul class="collection-list">
${items}
  </ul>
</section>
`;
}

function sortRecords(records, sortStr, defaultSort) {
  const records2 = records.slice();
  const useSort = (typeof sortStr === "string" && sortStr.trim().length)
    ? sortStr
    : (typeof defaultSort === "string" ? defaultSort : null);
  if (!useSort) {
    // Tie-break by slug ascending for determinism.
    records2.sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    return records2;
  }
  const m = useSort.trim().match(/^(\S+)\s+(asc|desc)$/i);
  if (!m) {
    records2.sort((a, b) => a.slug < b.slug ? -1 : 1);
    return records2;
  }
  const key = m[1];
  const dir = m[2].toLowerCase() === "desc" ? -1 : 1;
  records2.sort((a, b) => {
    const av = (a.data && a.data[key]) ?? (key === "title" ? a.title : undefined);
    const bv = (b.data && b.data[key]) ?? (key === "title" ? b.title : undefined);
    if (av === bv) return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    return (av < bv ? -1 : 1) * dir;
  });
  return records2;
}

function renderHero(sec, ctx) {
  const { index, contextDir } = ctx;
  const headline = renderInlineValue(sec.headline, ctx);
  const subhead = renderInlineValue(sec.subhead, ctx);
  let imgHtml = "";
  if (sec.image) {
    const asset = resolveValue(sec.image, index, contextDir);
    if (asset && asset.kind === "asset") {
      const src = toHref(ctx, "/" + asset.assetPath);
      imgHtml = `<img src="${escapeAttr(src)}" alt="${escapeAttr(asset.alt || "")}"` +
        (asset.width ? ` width="${asset.width}"` : "") +
        (asset.height ? ` height="${asset.height}"` : "") +
        ">";
    }
  }
  let ctaHtml = "";
  if (sec.cta && typeof sec.cta === "object" && sec.cta.url) {
    const label = renderInlineValue(sec.cta.label, ctx) || "Learn more";
    const href = resolveLinkHref(sec.cta.url, ctx);
    ctaHtml = `<p class="hero-cta"><a href="${escapeAttr(href)}">${label}</a></p>`;
  }
  return `<section class="hero">
${headline ? `  <h2>${headline}</h2>` : ""}
${subhead ? `  <p class="subhead">${subhead}</p>` : ""}
${imgHtml}
${ctaHtml}
</section>
`;
}

function renderProse(sec, ctx) {
  const { index, contextDir } = ctx;
  const from = sec.from;
  // The prose section commonly inlines the page's own markdown via `./index.md`.
  // That markdown often begins with a `# Title` that the page wrapper already
  // emits, so we strip the leading H1 to avoid duplication.
  if (typeof from === "string" && from.startsWith("./")) {
    const resolved = resolveValue(from, index, contextDir);
    if (resolved && resolved.kind === "markdown") {
      return `<section class="prose">\n${renderMarkdown(resolved.source, { stripFirstH1: true })}\n</section>\n`;
    }
  }
  if (typeof from === "string" && from.startsWith("ref:")) {
    const resolved = resolveValue(from, index, contextDir);
    if (resolved && resolved.kind === "markdown") {
      return `<section class="prose">\n${renderMarkdown(resolved.source, { stripFirstH1: true })}\n</section>\n`;
    }
    if (resolved && resolved.kind === "record" && resolved.record.body) {
      return `<section class="prose">\n${renderMarkdown(resolved.record.body, { stripFirstH1: true })}\n</section>\n`;
    }
  }
  if (typeof sec.body === "string") {
    return `<section class="prose">\n${renderMarkdown(sec.body, { stripFirstH1: true })}\n</section>\n`;
  }
  return "";
}

function renderStatGrid(sec, ctx) {
  const items = Array.isArray(sec.items) ? sec.items : [];
  const cells = items
    .filter((it) => it && typeof it === "object")
    .map((it) => {
      const label = renderInlineValue(it.label, ctx.index, ctx.contextDir);
      const value = renderInlineValue(it.value, ctx.index, ctx.contextDir);
      return `  <div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
    }).join("\n");
  return `<section class="stat-grid">
${cells}
</section>
`;
}

function renderFeatureGrid(sec, ctx) {
  const items = Array.isArray(sec.items) ? sec.items : [];
  const cells = items
    .filter((it) => it && typeof it === "object")
    .map((it) => {
      let label = renderInlineValue(it.title || it.label, ctx);
      let href = null;
      if (typeof it.ref === "string") {
        const resolved = resolveValue(it.ref, ctx.index, ctx.contextDir);
        if (resolved && resolved.kind === "record") {
          if (!label) label = escapeHtml(resolved.title);
          href = resolved.url;
        } else if (resolved && resolved.kind === "value") {
          if (!label) label = escapeHtml(String(resolved.value));
        }
      } else if (typeof it.url === "string") {
        href = resolveLinkHref(it.url, ctx);
      }
      const labelHtml = href
        ? `<a href="${escapeAttr(toHref(ctx, href))}">${label}</a>`
        : label;
      const summary = renderInlineValue(it.summary || it.description, ctx);
      return `  <div class="feature">
    <h3>${labelHtml}</h3>
    ${summary ? `<p>${summary}</p>` : ""}
  </div>`;
    }).join("\n");
  return `<section class="feature-grid">
${cells}
</section>
`;
}

function renderPageIntro(sec, ctx) {
  const headline = renderInlineValue(sec.headline, ctx);
  const lede = renderInlineValue(sec.lede, ctx);
  return `<section class="page-intro">
${headline ? `  <h2>${headline}</h2>` : ""}
${lede ? `  <p class="lede">${lede}</p>` : ""}
</section>
`;
}

function renderCta(sec, ctx) {
  const headline = renderInlineValue(sec.headline, ctx);
  const body = renderInlineValue(sec.body, ctx);
  const url = typeof sec.url === "string" ? resolveLinkHref(sec.url, ctx) : null;
  const label = renderInlineValue(sec.label, ctx) || "Learn more";
  return `<section class="cta">
${headline ? `  <h2>${headline}</h2>` : ""}
${body ? `  <p>${body}</p>` : ""}
${url ? `  <p class="hero-cta"><a href="${escapeAttr(url)}">${label}</a></p>` : ""}
</section>
`;
}

function renderContactBlock(sec, ctx) {
  const fields = ["email", "phone", "address", "social"];
  const rows = [];
  for (const key of fields) {
    if (sec[key] === undefined) continue;
    let valueHtml;
    if (key === "social" && Array.isArray(sec[key])) {
      const items = sec[key].map((s) => {
        if (!s || typeof s !== "object") return "";
        const plat = renderInlineValue(s.platform, ctx);
        const url = typeof s.url === "string" ? resolveLinkHref(s.url, ctx) : "#";
        return `<a href="${escapeAttr(url)}">${plat}</a>`;
      }).join(", ");
      valueHtml = items;
    } else {
      const resolved = resolveValue(sec[key], ctx.index, ctx.contextDir);
      valueHtml = resolvedValueToInlineHtml(resolved, ctx);
      if (key === "social" && resolved && resolved.kind === "value" && Array.isArray(resolved.value)) {
        valueHtml = resolved.value.map((s) => {
          if (!s || typeof s !== "object") return "";
          const plat = escapeHtml(String(s.platform || ""));
          const url = typeof s.url === "string" ? resolveLinkHref(s.url, ctx) : "#";
          return `<a href="${escapeAttr(url)}">${plat}</a>`;
        }).join(", ");
      }
    }
    rows.push(`  <dt>${escapeHtml(cap(key))}</dt>\n  <dd>${valueHtml}</dd>`);
  }
  return `<section class="contact-block">
  <dl class="section-fields">
${rows.join("\n")}
  </dl>
</section>
`;
}

function renderForm(sec, ctx) {
  const fields = Array.isArray(sec.fields) ? sec.fields : [];
  const submitTo = typeof sec.submitTo === "string" ? resolveLinkHref(sec.submitTo, ctx) : "#";
  const inputs = fields.map((f) => {
    if (typeof f !== "string") return "";
    const id = `f-${f}`;
    if (f === "message") {
      return `  <p><label for="${id}">${escapeHtml(cap(f))}</label><br><textarea id="${id}" name="${escapeAttr(f)}" rows="5" cols="40"></textarea></p>`;
    }
    return `  <p><label for="${id}">${escapeHtml(cap(f))}</label><br><input id="${id}" name="${escapeAttr(f)}" type="${f === "email" ? "email" : "text"}"></p>`;
  }).join("\n");
  return `<section class="form-section">
<form action="${escapeAttr(submitTo)}" method="post">
${inputs}
  <p><button type="submit">Send</button></p>
</form>
</section>
`;
}

function renderDefinitionList(sec, ctx) {
  const items = Array.isArray(sec.items) ? sec.items : [];
  const rows = items
    .filter((it) => it && typeof it === "object")
    .map((it) => {
      const term = renderInlineValue(it.term, ctx);
      const def = renderInlineValue(it.definition, ctx);
      return `  <dt>${term}</dt>\n  <dd>${def}</dd>`;
    }).join("\n");
  return `<section class="definition-list">
  <dl class="section-fields">
${rows}
  </dl>
</section>
`;
}

function renderPullQuote(sec, ctx) {
  const text = renderInlineValue(sec.text, ctx);
  const attribution = renderInlineValue(sec.attribution, ctx);
  return `<section class="pull-quote">
  <blockquote>
    <p>${text}</p>
${attribution ? `    <footer>— ${attribution}</footer>` : ""}
  </blockquote>
</section>
`;
}

function renderPrinciples(sec, ctx) {
  let items = Array.isArray(sec.items) ? sec.items : null;
  if (!items && typeof sec.from === "string") {
    const r = resolveValue(sec.from, ctx.index, ctx.contextDir);
    if (r && r.kind === "value" && Array.isArray(r.value)) items = r.value;
  }
  if (!items) items = [];
  const lis = items.map((p) => {
    const inline = renderInlineValue(p, ctx);
    return `  <li>${inline}</li>`;
  }).join("\n");
  return `<section class="principles">
  <ol class="principles-list">
${lis}
  </ol>
</section>
`;
}

// Fallback for unknown section types: dump fields generically.
function renderGenericSection(sec, ctx) {
  const type = String(sec.type || "section");
  const rows = [];
  for (const key of Object.keys(sec)) {
    if (key === "type") continue;
    const v = sec[key];
    rows.push(renderFieldRow(key, v, ctx));
  }
  return `<section data-type="${escapeAttr(type)}">
  <h2 class="section-title">${escapeHtml(type)}</h2>
  <dl class="section-fields">
${rows.join("\n")}
  </dl>
</section>
`;
}

function renderRemainingFields(data, ctx) {
  // For records-as-pages: dump everything except keys we've already rendered.
  const used = new Set(["title", "sections", "body"]);
  const rows = [];
  for (const key of Object.keys(data)) {
    if (used.has(key)) continue;
    const v = data[key];
    rows.push(renderFieldRow(key, v, ctx));
  }
  if (!rows.length) return "";
  return `<section class="record-fields">
  <h2 class="section-title">Details</h2>
  <dl class="section-fields">
${rows.join("\n")}
  </dl>
</section>
`;
}

function renderFieldRow(key, v, ctx) {
  return `  <dt>${escapeHtml(cap(key))}</dt>\n  <dd>${renderAnyValue(v, ctx)}</dd>`;
}

// ---------------------------------------------------------------------------
// Inline value renderers. These handle the ref/value bifurcation.
// ---------------------------------------------------------------------------

function renderInlineValue(v, ctx) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    if (isRefString(v)) {
      const r = resolveValue(v, ctx.index, ctx.contextDir);
      return resolvedValueToInlineHtml(r, ctx);
    }
    return escapeHtml(v);
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return escapeHtml(String(v));
  }
  if (Array.isArray(v)) {
    return v.map((x) => renderInlineValue(x, ctx)).join(", ");
  }
  if (typeof v === "object") {
    return `<code>${escapeHtml(JSON.stringify(v))}</code>`;
  }
  return escapeHtml(String(v));
}

function renderAnyValue(v, ctx) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    if (isRefString(v)) {
      const r = resolveValue(v, ctx.index, ctx.contextDir);
      return resolvedValueToInlineHtml(r, ctx);
    }
    return escapeHtml(v);
  }
  if (typeof v === "number" || typeof v === "boolean") return escapeHtml(String(v));
  if (Array.isArray(v)) {
    const items = v.map((it) => `  <li>${renderAnyValue(it, ctx)}</li>`).join("\n");
    return `<ul>\n${items}\n</ul>`;
  }
  if (typeof v === "object") {
    const rows = [];
    for (const k of Object.keys(v)) {
      rows.push(`<dt>${escapeHtml(cap(k))}</dt><dd>${renderAnyValue(v[k], ctx)}</dd>`);
    }
    return `<dl class="section-fields">${rows.join("")}</dl>`;
  }
  return escapeHtml(String(v));
}

function resolveValue(raw, index, contextDir) {
  if (typeof raw !== "string" || !isRefString(raw)) return null;
  const parsed = parseRef(raw);
  return resolveRef(parsed, index, contextDir);
}

function resolvedValueToInlineHtml(resolved, ctx) {
  if (!resolved) return "";
  if (resolved.kind === "unresolved") {
    return `<span class="mosaic-unresolved" title="${escapeAttr(resolved.reason || "")}">${escapeHtml(resolved.original)}</span>`;
  }
  if (resolved.kind === "asset") {
    const src = toHref(ctx, "/" + resolved.assetPath);
    if (isImageMime(resolved.mime) || isImageExt(resolved.assetPath)) {
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(resolved.alt || "")}"` +
        (resolved.width ? ` width="${resolved.width}"` : "") +
        (resolved.height ? ` height="${resolved.height}"` : "") +
        ">";
    }
    return `<a href="${escapeAttr(src)}">${escapeHtml(resolved.assetPath)}</a>`;
  }
  if (resolved.kind === "record") {
    const url = resolved.url;
    if (url) {
      return `<a href="${escapeAttr(toHref(ctx, url))}">${escapeHtml(resolved.title || "")}</a>`;
    }
    return escapeHtml(resolved.title || "");
  }
  if (resolved.kind === "value") {
    const v = resolved.value;
    if (typeof v === "string") return escapeHtml(v);
    if (typeof v === "number" || typeof v === "boolean") return escapeHtml(String(v));
    if (Array.isArray(v)) {
      return v.map((x) => typeof x === "string" ? escapeHtml(x) : escapeHtml(JSON.stringify(x))).join(", ");
    }
    if (typeof v === "object") return `<code>${escapeHtml(JSON.stringify(v))}</code>`;
    return escapeHtml(String(v));
  }
  if (resolved.kind === "markdown") {
    return renderMarkdown(resolved.source);
  }
  return "";
}

function resolveLinkHref(rawUrl, ctx) {
  if (typeof rawUrl !== "string") return "#";
  if (isRefString(rawUrl)) {
    const r = resolveValue(rawUrl, ctx.index, ctx.contextDir);
    if (!r) return "#";
    if (r.kind === "record") return toHref(ctx, r.url || "#");
    if (r.kind === "asset") return toHref(ctx, "/" + r.assetPath);
    if (r.kind === "value" && typeof r.value === "string") {
      if (looksLikeEmail(r.value)) return "mailto:" + r.value;
      if (/^https?:\/\//.test(r.value)) return r.value;
      if (r.value.startsWith("/")) return toHref(ctx, r.value);
      return r.value;
    }
    return "#";
  }
  return toHref(ctx, rawUrl);
}

function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isImageMime(m) {
  return typeof m === "string" && m.startsWith("image/");
}

function isImageExt(p) {
  return /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(p || "");
}

function joinUrl(base, url) {
  if (!base) return url;
  if (typeof url !== "string") return base;
  if (/^https?:\/\//.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")) return url;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  if (!url.startsWith("/")) return `${b}/${url}`;
  return `${b}${url}`;
}

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

