"use strict";

// Emit a redirect HTML file: meta-refresh + JS fallback + a Location comment.

const { escapeHtml, escapeAttr } = require("./html");

function renderRedirect({ to, status, locale }) {
  const safeTo = String(to || "/");
  const safeStatus = Number(status) || 301;
  const lang = locale || "en";
  // Use JSON.stringify for JS string literal safety.
  const toJs = JSON.stringify(safeTo);
  return `<!doctype html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="utf-8">
  <title>Redirecting…</title>
  <meta http-equiv="refresh" content="0; url=${escapeAttr(safeTo)}">
  <link rel="canonical" href="${escapeAttr(safeTo)}">
  <!-- mosaic:redirect status="${safeStatus}" location="${escapeAttr(safeTo)}" -->
</head>
<body>
  <p>Redirecting to <a href="${escapeAttr(safeTo)}">${escapeHtml(safeTo)}</a>.</p>
  <script>window.location.replace(${toJs});</script>
</body>
</html>
`;
}

module.exports = { renderRedirect };
