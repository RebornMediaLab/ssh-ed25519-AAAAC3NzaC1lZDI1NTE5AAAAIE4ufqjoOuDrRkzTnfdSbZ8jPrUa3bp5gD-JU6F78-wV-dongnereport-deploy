// 정적 사이트 생성기: content/posts/*.md, content/pages/*.md -> dist/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const DIST = path.join(ROOT, "docs");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const url = (p) => cfg.siteUrl.replace(/\/$/, "") + p;

function parse(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  return { meta, body: m ? m[2] : raw };
}

const gsv = cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : "";
const adsense = cfg.adsensePublisherId
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsensePublisherId)}" crossorigin="anonymous"></script>`
  : "";

const layout = ({ title, desc, path: p, body, type = "website", date }) => `<!doctype html>
<html lang="${cfg.lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}${p === "/" ? "" : " | " + esc(cfg.siteName)}</title>
<meta name="description" content="${esc(desc || cfg.description)}">
<link rel="canonical" href="${url(p)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc || cfg.description)}">
<meta property="og:type" content="${type}"><meta property="og:url" content="${url(p)}"><meta property="og:locale" content="ko_KR">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="/rss.xml">
<link rel="stylesheet" href="/style.css">
${gsv}
${adsense}
</head><body>
<header class="top"><div class="wrap"><a class="brand" href="/">${esc(cfg.siteName)}</a>
<nav><a href="/">글 목록</a><a href="/about/">소개</a><a href="/contact/">문의</a></nav></div></header>
<main class="wrap">${body}</main>
<footer class="foot"><div class="wrap"><p>${esc(cfg.siteName)} · 일반적인 정보 제공을 목적으로 하며 법률·세무·의료 자문이 아닙니다. 중요한 사항은 반드시 공식 기관에서 확인하세요.</p>
<p><a href="/about/">소개</a> · <a href="/contact/">문의</a> · <a href="/privacy/">개인정보처리방침</a> · <a href="/terms/">이용약관</a></p></div></footer>
</body></html>`;

const write = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// 글
const postsDir = path.join(ROOT, "content/posts");
const posts = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md")).map((f) => {
  const { meta, body } = parse(path.join(postsDir, f));
  return { slug: meta.slug || f.replace(/\.md$/, ""), ...meta, body };
}).filter((p) => p.draft !== "true").sort((a, b) => (b.date || "").localeCompare(a.date || ""));

for (const p of posts) {
  const html = marked.parse(p.body);
  const body = `<article class="post"><h1>${esc(p.title)}</h1>
<p class="meta">${esc(p.date)} ${p.updated ? "· 수정 " + esc(p.updated) : ""}</p>
${p.image ? `<img class="hero" src="${esc(p.image)}" alt="${esc(p.imageAlt || p.title)}" loading="eager">` : ""}
<div class="content">${html}</div>
<p class="disclaimer">이 글은 ${esc(p.date)} 기준의 일반적인 안내입니다. 제도와 금액은 바뀔 수 있으니 공식 기관의 최신 안내를 확인하세요.</p></article>`;
  write(`posts/${p.slug}/index.html`, layout({ title: p.title, desc: p.description, path: `/posts/${p.slug}/`, body, type: "article", date: p.date }));
}

// 홈
const list = posts.map((p) => `<article class="card"><h2><a href="/posts/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.description || "")}</p><span class="meta">${esc(p.date)}</span></article>`).join("\n");
write("index.html", layout({ title: cfg.siteName, desc: cfg.description, path: "/", body: `<section class="hero-box"><h1>${esc(cfg.siteName)}</h1><p>${esc(cfg.tagline)}</p></section>\n<section class="list">${list || "<p>곧 첫 글이 올라옵니다.</p>"}</section>` }));

// 고정 페이지
const pagesDir = path.join(ROOT, "content/pages");
const pages = [];
for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith(".md"))) {
  const { meta, body } = parse(path.join(pagesDir, f));
  const slug = meta.slug || f.replace(/\.md$/, "");
  const md = body.replaceAll("{{siteName}}", cfg.siteName).replaceAll("{{email}}", cfg.contactEmail || "(이메일 준비 중)").replaceAll("{{siteUrl}}", cfg.siteUrl).replaceAll("{{author}}", cfg.author);
  pages.push(slug);
  write(`${slug}/index.html`, layout({ title: meta.title || slug, desc: meta.description, path: `/${slug}/`, body: `<article class="post"><h1>${esc(meta.title || slug)}</h1><div class="content">${marked.parse(md)}</div></article>` }));
}

// 404, sitemap, robots, rss, ads.txt
write("404.html", layout({ title: "페이지를 찾을 수 없습니다", path: "/404.html", body: `<article class="post"><h1>페이지를 찾을 수 없습니다</h1><p><a href="/">홈으로 돌아가기</a></p></article>` }));
const urls = ["/", ...pages.map((s) => `/${s}/`), ...posts.map((p) => `/posts/${p.slug}/`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${url(u)}</loc></url>`).join("\n")}\n</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${url("/sitemap.xml")}\n`);
write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(cfg.siteName)}</title><link>${url("/")}</link><description>${esc(cfg.description)}</description>${posts.slice(0, 30).map((p) => `<item><title>${esc(p.title)}</title><link>${url(`/posts/${p.slug}/`)}</link><description>${esc(p.description || "")}</description><pubDate>${new Date(p.date).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`);
if (cfg.adsensePublisherId) write("ads.txt", `google.com, ${cfg.adsensePublisherId.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
fs.copyFileSync(path.join(ROOT, "style.css"), path.join(DIST, "style.css"));
for (const d of ["images"]) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
if (fs.existsSync(path.join(ROOT, "static"))) for (const f of fs.readdirSync(path.join(ROOT, "static"))) fs.copyFileSync(path.join(ROOT, "static", f), path.join(DIST, f));
fs.writeFileSync(path.join(DIST, "CNAME"), new URL(cfg.siteUrl).hostname + "\n");
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
console.log(`빌드 완료: 글 ${posts.length}개, 페이지 ${pages.length}개 → docs/`);
