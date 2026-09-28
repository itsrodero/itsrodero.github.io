# TubeTools (tubetools.online)

Free browser-based tools and guides for YouTube creators, in English (`/en/`) and Spanish (site root).

The site is plain static HTML served by GitHub Pages. Every page is **generated** from a source file, so all pages share one design, one header/footer and correct SEO tags.

## Folder structure

| Path | What it is |
|---|---|
| `_src/en/*.html`, `_src/es/*.html` | **Edit these.** One file per page: a small header (front matter) + the page body. |
| `_tools/build.py` | The generator. Turns `_src` into the final pages. |
| `assets/css/site.css` | The only stylesheet for the whole site. |
| `assets/js/site.js` | Shared JavaScript (menu, helpers). |
| `assets/js/tools/*.js` | Code for each tool. |
| `assets/img/` | Logo, social images, author photo. |
| `*.html`, `en/*.html`, `sitemap.xml` | **Generated. Don't edit by hand** — changes will be overwritten. |
| `ads.txt`, `robots.txt`, `CNAME` | Hand-written config files. |

Folders starting with `_` are never published by GitHub Pages.

## Making a change

1. Edit or add a file in `_src/en/` and/or `_src/es/`.
2. Run the build (Python 3.8+, no extra packages):

   ```
   python _tools/build.py
   ```

3. Commit **both** the `_src` change and the regenerated `.html` files, then push.

## Adding a new guide

Copy an existing guide in `_src/en/` (for example `youtube-rpm-vs-cpm.html`) and change the header:

```
---
type: article
title: SEO title (the site name is added automatically)
description: 120–160 characters for search results
h1: The visible headline
lead: One or two sentences under the headline
alt: slug-of-the-spanish-version     # must point back from the Spanish file
category: thumbnails | ctr | titles | monetization | resources
order: 9                             # position inside its category
published: 2026-10-01
updated: 2026-10-01
nav: guides
related: slug-one, slug-two, slug-three
---
<p>Body HTML…</p>
```

- Link to other pages with `href="@slug"` (same language) or `href="@en:slug"`. The build stops if a link is broken.
- Use `<h2>` for sections: they build the table of contents automatically.
- Useful blocks: `<div class="callout callout-tip">`, `<div class="table-wrap"><table>…`, `<ol class="steps">`, `<div class="faq"><details>…`, `<div class="sources">`.
- Always cite official sources (YouTube Help, Google docs) at the end, and label estimates as estimates.

## Moving or deleting a page

Add the old URL to `REDIRECTS` in `_tools/build.py` so visitors and Google are sent to the new page.

## Ads and consent

- AdSense and Google Analytics tags are added to every page by the build (`ADSENSE_CLIENT`, `GA_ID` in `_tools/build.py`).
- Consent Mode defaults to "denied" in the EEA, UK and Switzerland until the visitor answers **Google's consent message**, which must be enabled in AdSense → Privacy & messaging.
- The footer link "Privacy settings" reopens that message.
