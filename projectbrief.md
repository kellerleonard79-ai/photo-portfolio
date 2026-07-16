# Photography Portfolio — Project Brief

> Drop this at the repo root. It is the spec of record. When implementation and this
> document disagree, update this document as part of the same commit.

---

## 1. What this site is for

A personal photography portfolio. One job, stated plainly:

**A skeptic opens this link on their phone and, within about eight seconds, concludes
that the photographer is good.**

Everything below follows from that sentence. It is not a client-acquisition funnel, not
a blog, not a print shop, not a social network. If a feature does not serve the eight
seconds, it does not ship.

**Audience:** someone who arrived via a link sent in conversation. They are not browsing.
They did not search for this. They will look at two or three images and leave.

**Consequences of the above:**

- The weakest photo on the site sets the ceiling on the impression, not the best one.
  Fewer, stronger images beat comprehensive coverage. Nine series, 5–10 images each.
- **Series order on the landing page is a ranking, not an arrangement.** Nobody scrolls
  to the ninth series. Positions 1–3 are effectively the whole site; 7–9 are for people
  already convinced. Order strongest-first, and hold back any series that isn't as good
  as the top three — a series can always be added later in a single commit.
- The first screen carries almost the entire burden. One image, large, immediate.
- Phone-first is literal, not aspirational. Assume a phone held in one hand. Design at
  mobile width first and let the desktop layout be the adaptation.
- Range is the argument. The work spans several genres, and the fact that it is *all*
  good is the rebuttal to a doubter. The series structure should make that breadth
  legible fast.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro** (latest stable) | Static output, zero client JS by default, first-class build-time image optimization via `sharp`. |
| Content | **Astro content collections**, one folder per series | Filesystem *is* the CMS. No database, no admin UI, no auth. |
| Images | **Astro `<Image>` / `<Picture>`** (sharp) | Responsive widths + AVIF/WebP generated at build. No image CDN needed at this scale. |
| Styling | Plain CSS with custom properties, or a single small CSS file | The site is ~5 pages. A utility framework is more machinery than the problem needs. |
| Hosting | **Cloudflare Pages**, connected to GitHub | Git-push deploys, unmetered static bandwidth, global CDN, free. |
| Repo | **GitHub**, public or private — either works with Cloudflare | — |

### Explicit non-goals

Do not build, and do not suggest building: a CMS or admin panel, user accounts, a
comments system, analytics beyond a single privacy-preserving snippet (optional), a
newsletter signup, e-commerce, a lightbox library with 40 config options, infinite
scroll, a loading spinner, right-click blocking or any other "image protection" theater.

---

## 3. Content model

```
src/content/series/
  <series-slug>/
    index.md            # series frontmatter (schema below)
    01-<name>.jpg       # numeric prefix defines display order
    02-<name>.jpg
    03-<name>.jpg
```

### Series frontmatter schema

```yaml
title: "Series Title"
slug: "series-slug"          # optional; defaults to folder name
order: 1                     # position on the landing page
cover: "02-name.jpg"         # which image represents the series
blurb: "One or two sentences. Optional."
```

### Rules

- **Ordering is by filename prefix.** Sequencing a series is an editorial act — the order
  a viewer walks through the images *is* part of the work. Renaming a file reorders the
  set. No `order:` field per image.
- **Captions and alt text are written by hand** in the series `index.md`. The source
  photos do not carry IPTC captions, and all EXIF is stripped at import (see §4), so
  there is no metadata to read at build time. Alt text is required on every image and
  must describe the photograph, not label it.
- **No EXIF is displayed anywhere on the site.** Decided, not deferred. The audience is
  not photographers, exposure settings mean nothing to them, and the source photos have
  inconsistent metadata across nine different origins.

---

## 4. Image pipeline — the part that actually matters

Amateur photo sites die by serving 12MB Lightroom exports. This is the single highest-
leverage area of the build. Requirements:

0. **Photos enter the repo only via `scripts/import-photos.js`.** Never drag originals in
   by hand. The script resizes to 2400px long edge, converts to JPEG at quality 85, bakes
   EXIF orientation into the pixels, and strips all metadata. Originals stay outside the
   repo and are never committed.
1. **Source images are committed at reasonable size** — 2400px long edge, quality ~85.
   No RAWs, no TIFFs, nothing over ~5MB.
2. **Multiple widths generated at build**, roughly: 400 / 800 / 1200 / 1600 / 2400.
   Serve via `srcset` with a correct `sizes` attribute.
3. **AVIF first, WebP second, JPEG fallback.** Use `<picture>`.
4. **Intrinsic `width` and `height` on every image.** Non-negotiable — prevents layout
   shift as photos load. CLS on a photo site is the most visible possible failure.
5. **Low-quality placeholder** (blurred, ~20px, inlined as a data URI or a solid color
   sampled from the image) shown while the full image loads.
6. **`loading="lazy"` and `decoding="async"` on everything below the fold.
   `loading="eager"` + `fetchpriority="high"` on the hero image only.**
7. **Strip all metadata wholesale**, not just the GPS IFD. Location data can also live in
   XMP and in maker notes, so a targeted GPS strip can silently leave coordinates behind.
   Removing everything is correct by construction. Rotation must be baked into the pixels
   *before* stripping, or every rotated photo will display sideways.
8. Build time should stay under ~2 minutes at this image count. If it creeps up, cache
   the sharp output rather than reaching for an image CDN.

---

## 5. Pages

| Route | Contents |
|---|---|
| `/` | Hero image, full-bleed. Then the series, one representative image each, with the title. Nothing else above the fold. |
| `/series/[slug]` | The series, in sequence. Title and blurb. Images at generous size. |
| `/about` | Short. A paragraph, a portrait, the gear list only if it earns its place. |
| `/contact` | An email address. A `mailto:` link is a complete implementation. No form. |

Also: `sitemap.xml`, `robots.txt`, Open Graph tags with a per-page image (the link will
be pasted into chat apps — the preview card *is* the first impression as often as the
site is), a favicon.

---

## 6. Design direction

**The photographs are the design.** The visual identity stays quiet so the work is the
only thing with a voice. Quiet is a real constraint, not a licence for a default: with
nothing else to hide behind, the type, spacing, and rhythm have to be precise.

### Header

The site header is the **photographer's name** ("Keller Leonard"), not the word
"Photography." The name claims the work; a category label wastes the slot. It sits on the
hero image, top-left, in the display face.

### Type

Self-hosted at build time via Fontsource — no external font requests, no layout shift.

- **Display (name, series titles): Fraunces**, weight 500, with its optical-size axis
  used at large sizes. Editorial and considered — it signals a curated body of work,
  which is the site's whole argument.
- **UI / labels / body: Inter**, weights 400 and 500.
- Set a real type scale (e.g. 1.25 ratio). Sentence case for labels. Do not use system
  fonts anywhere.

### Color

A cool near-black ground with a single restrained blue accent. Neutral-cool, not warm —
a warm ground fights the blue and tints the photographs.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0F1114` | Page ground |
| `--surface` | `#16191D` | Lifted panels, if any |
| `--text` | `#ECEEF1` | Primary text |
| `--text-muted` | `#9AA0A8` | Secondary text, series blurbs |
| `--text-faint` | `#666C74` | Captions, fine print |
| `--accent` | `#6EA3CF` | Steel blue — hover, active series, links |
| `--accent-bright` | `#8FBCE0` | Accent hover/focus state |

The accent appears **only** on interaction (hover, focus), the active series, and links.
It is never a background fill or a slab of color. Overused, it stops meaning anything.
The blue deliberately echoes the Blue Angels trim, sky, and water in the work.

### Gallery layout (series pages)

- **Justified rows.** Images scale to a shared per-row height and pack edge-to-edge to
  fill the container width, like justified text. Aspect ratios are preserved exactly —
  never cropped. Sequence order (numeric filename prefixes) is preserved: rows read
  left-to-right, top-to-bottom.
- Read intrinsic width/height from `astro:assets`; set `aspect-ratio` on every frame so
  CLS stays ~0. No client-side JavaScript for layout.
- Target row height ~340–420px on desktop. Below ~600px viewport, collapse to a single
  full-width column — big, immersive, one frame at a time is the correct phone view.
- Handle the final partial row so its images don't stretch to absurd widths.

### One signature element

A single image per series may be promoted to **full-bleed** (spanning the full container
width, breaking the row rhythm) via a `layout: full` flag in the series `index.md`. Used
sparingly — once or twice per series, on the strongest frame. This is the *only*
signature flourish; everything else stays disciplined.

### Motion

Restrained. A fade on image load, nothing more. Respect `prefers-reduced-motion`.

### Avoid

Templated defaults that read as machine-generated: cream backgrounds, broadsheet layouts
with hairline rules, and decorative `01 / 02 / 03` markers. Numbered markers are for
information the viewer needs, not ornament.

---

## 7. Quality floor

Ship nothing that fails these:

- Lighthouse performance ≥ 90 on mobile, throttled.
- Cumulative Layout Shift ≈ 0.
- Largest Contentful Paint (the hero image) under 2.5s on a simulated 4G connection.
- Fully usable on a 375px-wide viewport.
- Keyboard navigable, with a visible focus indicator.
- `prefers-reduced-motion` respected.
- Every image has meaningful `alt` text. Not "photo" — describe the image.
- Works with JavaScript disabled. (An Astro static build should get this for free. If it
  doesn't, something has gone wrong.)

---

## 8. Deploy

- `main` branch is production. Every push to `main` deploys.
- Pull request branches get Cloudflare preview URLs automatically. Use them.
- Build command: `npm run build`. Output directory: `dist`.
- Custom domain attached in the Cloudflare dashboard, with SSL provisioned automatically.

---

## 9. Open questions

- [ ] Domain name. Short. Sayable out loud without spelling it.
- [ ] The nine series, ranked strongest-first. Which is the hero image?
- [ ] Photographer's name / display name and about-page copy.
- [x] ~~Show EXIF?~~ **No.** Stripped at import, not displayed. Settled.