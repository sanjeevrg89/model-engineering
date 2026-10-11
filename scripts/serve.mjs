#!/usr/bin/env node
// Static server for dist/: `node scripts/serve.mjs [port]`.
// ES modules and the lab worker need http://, not file://.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// usage: node scripts/serve.mjs [port] [dir]
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const ROOT = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith("/")) {
        res.writeHead(301, { Location: p + "/" }).end();
        return;
      }
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      const nf = path.join(ROOT, "404.html");
      res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : "not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`serving dist/ at http://localhost:${PORT}/`));
