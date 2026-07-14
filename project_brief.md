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
  Fewer, stronger images beat comprehensive coverage. Target roughly 5–8 images per
  series and 4–5 series. Under 40 images total is a success, not a shortfall.
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
- **Captions and metadata come from the image, not from YAML.** Read IPTC/XMP
  `Title`, `Description`/`Caption`, and EXIF (camera, lens, focal length, aperture,
  shutter, ISO) at build time. The photographer captions in Lightroom; the site follows.
  A caption typed in two places will drift.
- Any per-image field may be overridden in an optional sidecar only if the EXIF route
  proves insufficient. Prefer not to need it.

---

## 4. Image pipeline — the part that actually matters

Amateur photo sites die by serving 12MB Lightroom exports. This is the single highest-
leverage area of the build. Requirements:

1. **Source images are committed at reasonable size.** Export from Lightroom at roughly
   2400–3000px on the long edge, quality ~85. Do not commit full-resolution TIFFs or RAWs.
   Do not commit anything over ~5MB.
2. **Multiple widths generated at build**, roughly: 400 / 800 / 1200 / 1600 / 2400.
   Serve via `srcset` with a correct `sizes` attribute.
3. **AVIF first, WebP second, JPEG fallback.** Use `<picture>`.
4. **Intrinsic `width` and `height` on every image.** Non-negotiable — prevents layout
   shift as photos load. CLS on a photo site is the most visible possible failure.
5. **Low-quality placeholder** (blurred, ~20px, inlined as a data URI or a solid color
   sampled from the image) shown while the full image loads.
6. **`loading="lazy"` and `decoding="async"` on everything below the fold.
   `loading="eager"` + `fetchpriority="high"` on the hero image only.**
7. **Strip GPS coordinates** from published EXIF. Keep camera/lens/exposure data if it
   is being displayed; strip location unconditionally.
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

**The photographs are the design.** The site's visual identity should be quiet enough
that the work is the only thing with a voice. This is a real constraint, not a licence
for a default: quiet is hard, and it means the type, spacing, and rhythm have to be
precise, because there is nothing else to hide behind.

Guidance for whoever implements this:

- **Type carries the whole personality.** Choose a display face and a body face
  deliberately. Set a real type scale. The type is the only non-photographic element
  with any expressive range — spend the boldness there, once.
- **Generous negative space.** Images need room to breathe. Crowding a photograph is
  the fastest way to make it look worse than it is.
- **Neutral, non-competing background.** The background must not tint the photographs.
  Avoid warm creams and colored washes; they shift the apparent color of every image on
  the page.
- **One signature element**, and only one. Something in how a series opens, how images
  are sequenced, or how the viewer moves between them. Everything else stays disciplined.
- **Motion, if any, is restrained.** A fade on image load. Nothing that announces itself.

Avoid these, which are the current defaults rather than choices, and read as
machine-generated: cream `#F4F1EA` backgrounds with a terracotta accent; near-black with
one acid-green accent; broadsheet layouts with hairline rules and `01 / 02 / 03` markers.
Numbered markers in particular are only appropriate if the numbers carry information the
viewer needs.

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
- [ ] Series names and their landing-page order.
- [ ] Show EXIF (camera/lens/settings) on each image, or not? Decide once and be consistent.
- [ ] Photographer's name / display name and about-page copy.