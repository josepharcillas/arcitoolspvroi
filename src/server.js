/**
 * Serves the ROI tracker.
 *
 * Deliberately trivial: the calculator runs entirely in the browser, so there
 * is no API to call and nothing to render server-side. That is what keeps the
 * page instant, crawlable, and free of anything to leak - no account, no
 * upload, no stored figures.
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3005);
const page = readFileSync(path.join(here, "ui", "index.html"));

const ROBOTS = `User-agent: *
Allow: /
Sitemap: https://pvroi.arcitools.com/sitemap.xml
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://pvroi.arcitools.com/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`;

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok\n");
  }
  if (url.pathname === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end(ROBOTS);
  }
  if (url.pathname === "/sitemap.xml") {
    res.writeHead(200, { "content-type": "application/xml" });
    return res.end(SITEMAP);
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    });
    return res.end(page);
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
}).listen(PORT, "0.0.0.0", () => console.log(`pvroi listening on ${PORT}`));
