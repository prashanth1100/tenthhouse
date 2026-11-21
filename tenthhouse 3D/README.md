# Tenth House Studio — website

A fast, dependency-free static website for Tenth House Studio (Manikonda, Hyderabad).
Plain HTML, CSS and JavaScript — no frameworks, no build step required to view it.

## Run it locally

**Quickest:** double-click `index.html`. Everything works except the enquiry form,
which falls back to "Send on WhatsApp / Email instead" buttons (browsers can't run PHP from a file).

**Recommended (closer to the real site):**

```bash
cd tenthhouse
python3 -m http.server 8000
# open http://localhost:8000
```

**To test the enquiry form end-to-end** (needs PHP installed):

```bash
php -S localhost:8000
```

> Photos are loaded from the studio's current WordPress uploads
> (`tenthhousestudio.com/wp-content/uploads/…`), so you need an internet connection to see them.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: hero, intro, featured collections, services overview, founder, testimonials, booking CTA |
| `portfolio.html` | Filterable gallery (Newborn, Maternity, Children, Family, Couples, Solo, In The Box) with full-screen lightbox |
| `services.html` | All 15 services in 4 groups, each with sample work and an enquiry button |
| `studio.html` | Studio space rentals, podcasting, community library |
| `about.html` | Studio story, founder, approach, testimonials |
| `contact.html` | Enquiry form, phone/WhatsApp/email, map |
| `404.html` | Not-found page |

## Editing content

All text, services, testimonials and photos live in **`tools/build.py`** (the `CONTENT` section).
After editing, regenerate the pages:

```bash
python3 tools/build.py
```

Styles are in `assets/css/site.css` (colours, fonts and spacing are variables at the top).
Behaviour (menu, lightbox, filters, form) is in `assets/js/site.js`.

## Serving photos from this project (recommended before going live)

```bash
./tools/fetch-images.sh          # downloads every photo used into assets/photos/ (+ WebP if cwebp is installed)
# then in tools/build.py set:  IMG_BASE = "assets/photos/"
python3 tools/build.py           # pages now use local JPEGs, with WebP served first where available
```

For AVIF as well, convert the downloaded files (e.g. with `avifenc`) and extend the `<picture>` logic in `img()`.

## Deploy

1. Upload everything **except `tools/`** to the web root (any Apache/PHP host — the current WordPress host works).
2. `.htaccess` adds HTTPS + non-www redirects, **301 redirects from every old WordPress URL**, caching and security headers.
3. `contact.php` emails enquiries to `Tenthhouseportraits@gmail.com`. Change `FROM_EMAIL` to an address on your domain
   so mail isn't flagged as spam. Test one enquiry after deploying.
4. Submit `sitemap.xml` in Google Search Console.

**Shop, Blog and legal pages** are still linked in the footer to the current WordPress site.
Keep WordPress running for those paths (e.g. move it to a subfolder), or move that content before removing WordPress.

## Decisions taken (change any of them in `tools/build.py`)

- **Tech:** static HTML instead of WordPress + Elementor (109 requests / 53 scripts on the old homepage). Runs anywhere, no plugins to update.
- **Services:** kept every service on the current site, including **Maternity Portraits** and **In The Box Photography**, which weren't in the brief. Headshots are labelled **"Business Headshots"**, as in the brief.
- **Shop & Blog:** not rebuilt; linked from the footer.
- **Testimonials:** all four real testimonials from the current site, wording unchanged (emoji removed).
- **Look — white cinematic:** clean white base, near-black text, muted gold accent, one professional typeface (Manrope). Floating glass pill header; full-bleed split portfolio scenes with a second overlapping photo; Portraits as animated expanding photo panels; Events / Creative Production / Studio as a dark animated bento grid (pointer-following glow, rotating icon rings); sticky split "Why choose us"; dark premium footer with CTA, scrolling photo strip, contact icons, back-to-top and a gold wordmark.
- **Homepage:** a "Tenth House Studio presents" title card whose curtains split open → letterboxed hero slideshow with a running timecode and scene counter → full-screen portfolio "scenes" that stack as you scroll → services → director's note (founder) → Why choose us → featured projects on a film strip with sprocket holes → testimonials that fade in like subtitles → letterboxed final CTA → end-credits footer.
- **Conversion:** "Book a Session" in the header on every page, floating WhatsApp button, Book/Call bar on phones, Explore/Book on every service card, tap-to-call and email links, enquiry form pre-filled from the service clicked.
- **Motion** (`assets/js/anim.js`): title-card intro (first visit per session), hero slow-zoom crossfades, line-by-line heading reveals, photo reveals with gentle parallax, fade-up sections, quiet marquee, horizontal featured-projects gallery (swipe on phones), testimonial crossfade, page-transition wipe, header that turns solid on scroll and hides while scrolling down. No custom cursor. Only transform/opacity are animated; native scrolling is never hijacked; everything switches off for visitors who prefer reduced motion.

## What changed from the old site, and why

| Old site | New site | Why |
|---|---|---|
| First screen is a giant logo | First screen is a real photograph + one clear CTA | Photography sells the studio |
| No booking form; phone/email not clickable | Enquiry form, tap-to-call, WhatsApp links, sticky mobile booking bar | More enquiries, especially on phones |
| Homepage service names not clickable | Every service links to its section with sample work | Clear path from interest to enquiry |
| No lightbox; photos capped at 1024 px | Full-screen lightbox (keyboard, swipe, captions), responsive `srcset` up to 2048 px | Show the work properly |
| ~8 fonts, red/yellow one-offs | 2 fonts, one accent colour, consistent spacing scale | Calm, premium, consistent |
| No h1, no meta descriptions, no Open Graph, no schema; most photos had no alt text | One h1 per page, unique titles/descriptions, OG/Twitter cards, ProfessionalService JSON-LD, descriptive alt on every photo | SEO + accessibility |
| Typos ("POTRAITS", "BUSSINESS") | Fixed | Credibility |
| Hamburger overlapping content; sideways scroll on tablet | Full-screen mobile menu, no horizontal overflow at 360–1920 px | Mobile quality |

## QA done

Automated in headless Chrome across 360, 390, 430, 768, 1024, 1280, 1440 and 1920 px:
- no horizontal overflow on any page, no console errors, no broken internal links or anchors
- exactly one h1 per page, no skipped heading levels, no duplicate IDs, alt text and width/height on every image
- only the hero image loads eagerly with `fetchpriority="high"`; everything else is lazy
- portfolio filter, lightbox (open, ←/→, focus trap, Esc returns focus), mobile menu (Esc, aria-expanded) and form validation all tested
- no tap target under 44 px in the page content on a 390 px phone

**Still to do once it's live:** Lighthouse on Home/Portfolio/Contact, a real-device check on iOS Safari and Samsung Internet,
and one test enquiry through `contact.php`. These need the site on a real host with internet access.

## Missing assets (please supply)

Shown on the site as labelled `[MISSING: …]` placeholders:

1. **Business headshots:** 2–4 samples (4:5, min 1600 px wide)
2. **Birthday, Baby Shower, Housewarming events:** 1–2 photos each (4:5)
3. **Music video shoots / promotional reels:** stills or YouTube/Instagram links
4. **Podcast setup:** photos (3:2, min 2400 px)
5. **Studio space and community library:** photos (3:2, min 2400 px)
6. **Studio rental details:** what's included, hours, booking terms (and prices, only if you want them published)
7. **Podcast equipment list / session details**
8. **Short descriptions for events, music videos and reels:** the current site has none, so these use one plain line each
9. **Logo as SVG** (the icon is currently the 1376 px PNG)
10. **Instagram link** — the brief asks for Instagram in the footer/CTA, but the current site doesn't publish one. Add it to `STUDIO["instagram"]` in `tools/build.py` and rebuild; it then appears automatically. (A live Instagram feed also needs an Instagram API token or an embed widget.)
11. **More testimonials**, with permission
12. **Original full-resolution photos.** WordPress resized them to max 2560 px, which is fine, but originals let us export sharper WebP/AVIF.

## 3D layer

`assets/js/three-d.js` + `assets/css/three-d.css` add the 3D/premium motion: WebGL bokeh light field
in the hero, a 3D camera-aperture on page heroes and the 404 page, mouse-driven hero depth, 3D tilt
cards with glare, scroll-scrubbed 3D reveals, a cover-flow project reel, 3D testimonial flips,
an extruded footer word and a custom cursor. No libraries. Everything switches off for visitors
who prefer reduced motion. Both files are linked from `tools/build.py`, so rebuilding keeps them.
