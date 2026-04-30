# SEO & Performance Notes

Internal reference for interpreting Lighthouse / SEO audit reports run against
the published site (`https://irobokidattendance.lovable.app`).

---

## 1. LCP element is the Lovable badge (not real app content)

### What the audit reports

Lighthouse identifies the Largest Contentful Paint (LCP) element as:

```
<span id="lovable-badge-text">Edit with</span>
```

with a breakdown like:

| Subpart                | Duration  |
| ---------------------- | --------- |
| Time to first byte     | ~4 ms     |
| Element render delay   | ~2,600 ms |

### Cause

The "Edit with Lovable" badge is **injected by the Lovable hosting layer**
into every published deployment. It is **not part of this project's source
code** (you will not find any `lovable-badge` reference in the repo). The
badge script loads asynchronously, so by the time it renders, it becomes the
largest visible element on the viewport at that moment, and Lighthouse
attributes the entire delay between FCP and the badge render to LCP.

In other words: the 2.6 s "render delay" measures **how late the badge
mounts**, not how slow our app paints. Real app content (logo, dashboard
cards, sidebar) paints far earlier.

### How to reproduce improved Lighthouse scores

1. Open **Project Settings → Publishing → Badge visibility** (or use the
   publish dialog) and set the badge to **Hidden**. (Requires Pro plan or
   higher.)
2. Re-publish the project so the change goes live.
3. Open the published URL in an **Incognito/Private window** to bypass any
   cached badge script.
4. Run Lighthouse again (DevTools → Lighthouse → Mobile → Performance + SEO).
5. The LCP element will now resolve to actual app content (typically the
   sidebar logo or the first dashboard card), and the LCP metric will
   reflect real rendering performance, not third-party script load time.

> If hiding the badge is not an option, the audit can be safely dismissed —
> there is no code change in this repo that can fix it.

---

## 2. Other recurring audit items that are environmental

These are commonly flagged by Lighthouse but originate from the Lovable
hosting/CDN layer, not from this project's code. **No code changes will
move these scores.**

### "Use efficient cache lifetimes"

- Flags `/assets/index-*.js`, `/assets/index-*.css`, `/logo.ico`,
  `cdn.gpteng.co/.../*.woff2`, `/~flock.js`.
- Cache-Control headers are emitted by the hosting server, not by Vite or
  any file in this repo. Vite already produces hashed filenames
  (`index-CXzi7eVM.js`) that are safe for long-term caching — the hosting
  layer just needs to serve a long `max-age`.
- **Action:** none. This is a Lovable-hosting concern.

### "Forced reflow" (unattributed)

- Reported as `[unattributed]` source, ~30 ms total.
- Source is almost always Radix UI primitives (Sheet, Dialog, Tooltip)
  measuring layout during open/close, or Recharts' `ResponsiveContainer`.
  These reads are intentional and correct.
- 30 ms cumulative reflow is below the 50 ms perceptible-jank threshold.
- **Action:** none, unless a real interaction is reported as janky. In that
  case, profile the specific interaction with DevTools Performance tab to
  get an attributed stack trace.

---

## 3. What we *do* control in this repo

Things that genuinely affect SEO / performance and live in this codebase:

- `index.html` — `<title>`, `<meta name="description">`, Open Graph tags,
  canonical link, `<meta name="viewport">`. Keep title under 60 chars and
  description under 160 chars.
- Per-page SEO: each route should set a meaningful document title (e.g.
  via a small `useEffect` that writes `document.title`).
- `public/robots.txt` and (optionally) a sitemap.
- Image assets: prefer `.webp`/`.avif` over `.png`/`.jpg`, set explicit
  `width`/`height` to prevent layout shift, use `loading="lazy"` for
  below-the-fold images.
- Single `<h1>` per page, semantic landmark elements (`<main>`, `<nav>`,
  `<aside>`).
- Avoid importing large libraries (e.g. moment, lodash) when smaller
  alternatives exist.

---

## 4. Quick reproduction checklist

When re-running an audit after any change:

1. Publish the latest version (frontend changes require clicking
   **Update** in the publish dialog).
2. Open the published URL in a fresh Incognito window.
3. DevTools → Lighthouse → choose **Mobile**, **Performance + SEO +
   Accessibility + Best Practices**, **Navigation** mode.
4. Compare the new report against the previous one. Focus on metrics whose
   source is in this repo (LCP element identity, image sizes, render-blocking
   resources from `index.html`). Ignore items whose source URLs are
   `cdn.gpteng.co`, `~flock.js`, or hashed `assets/index-*.{js,css}`.
