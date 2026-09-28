#!/usr/bin/env python3
"""
TubeTools static site builder.

Usage (from the repository root):
    python _tools/build.py

Reads every page in _src/en and _src/es, wraps it in the shared layout
(header, footer, SEO tags, structured data) and writes plain HTML files:
    _src/es/<slug>.html  ->  /<slug>.html      (Spanish, site root)
    _src/en/<slug>.html  ->  /en/<slug>.html   (English)
It also writes sitemap.xml and the redirect pages listed in REDIRECTS.

No third-party packages are needed (Python 3.8+).
"""
import datetime
import hashlib
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src')

SITE_URL = 'https://tubetools.online'
SITE_NAME = 'TubeTools'
ADSENSE_CLIENT = 'ca-pub-8621886093597255'
GA_ID = 'G-MKM07L3RLR'
SITE_VERIFICATION = 'VL9NkPgXLuB5ytJr-X7bzO4QmTEgRIn7TCK3vDmgAtw'
CONTACT_EMAIL = 'contacto@tubetools.online'
AUTHOR_NAME = 'Daniel'
LANGS = ('en', 'es')

# Old URLs that were merged into other pages. Each gets a tiny redirect page.
REDIRECTS = {
    # English
    '/en/science-of-high-ctr-thumbnails.html': '/en/guide-thumbnails-ctr.html',
    '/en/viral-thumbnail-formula-small-channels.html': '/en/guide-thumbnails-ctr.html',
    '/en/initial-ctr-video-lifespan-youtube.html': '/en/ctr-vs-watch-time-youtube-growth.html',
    '/en/mobile-first-thumbnail-design-youtube.html': '/en/youtube-thumbnail-size-format-guide.html',
    '/en/negativity-bias-youtube-thumbnails.html': '/en/youtube-video-titles-that-get-clicks.html',
    '/en/how-ctr-affects-youtube-ad-revenue.html': '/en/youtube-rpm-vs-cpm.html',
    '/en/best-youtube-niches-adsense.html': '/en/youtube-cpm-by-niche.html',
    '/en/ctr-score-calculator.html': '/en/thumbnail-checklist.html',
    '/en/sitemap.html': '/en/sitemap-page.html',
    # Spanish
    '/ciencia-del-alto-ctr-en-youtube.html': '/guia-miniaturas-ctr.html',
    '/formula-viral-miniaturas-canales-pequenos.html': '/guia-miniaturas-ctr.html',
    '/ctr-inicial-y-alcance-youtube.html': '/ctr-vs-retencion-crecimiento-youtube.html',
    '/diseno-mobile-first-miniaturas-youtube.html': '/tamano-formato-miniatura-youtube-2026.html',
    '/sesgo-negatividad-miniaturas-youtube.html': '/titulos-youtube-que-generan-clics.html',
    '/como-el-ctr-afecta-tus-ingresos-youtube.html': '/rpm-vs-cpm-youtube.html',
    '/mejores-nichos-youtube-adsense.html': '/cpm-youtube-por-nicho.html',
    '/calculadora-puntuacion-ctr.html': '/checklist-miniaturas.html',
    # Old duplicate uploads ("file (1).html")
    '/errores-miniatura-que-matan-tu-ctr (1).html': '/errores-miniatura-que-matan-tu-ctr.html',
    '/ctr-inicial-y-alcance-youtube (1).html': '/ctr-vs-retencion-crecimiento-youtube.html',
    '/ctr-vs-retencion-crecimiento-youtube (1).html': '/ctr-vs-retencion-crecimiento-youtube.html',
    '/en/blog (1).html': '/en/blog.html',
}

# EEA + UK + Switzerland: consent is denied by default until the
# Google-certified CMP (AdSense > Privacy & messaging) collects it.
CONSENT_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
    'GB', 'CH',
]

T = {
    'en': {
        'locale': 'en_US',
        'skip': 'Skip to content',
        'menu': 'Menu',
        'home': 'Home',
        'tools': 'Tools',
        'all_tools': 'All tools',
        'guides': 'Guides',
        'glossary': 'Glossary',
        'about': 'About',
        'contact': 'Contact',
        'privacy': 'Privacy Policy',
        'terms': 'Terms of Use',
        'sitemap': 'Sitemap',
        'cookie_settings': 'Privacy settings',
        'other_lang_name': 'Español',
        'other_lang_label': 'Leer en español',
        'updated': 'Updated',
        'published': 'Published',
        'by': 'By',
        'min_read': 'min read',
        'toc': 'On this page',
        'related': 'Keep reading',
        'written_by': 'Written by',
        'author_role': 'Creator of TubeTools',
        'author_bio': 'Daniel builds and runs TubeTools. Guides are researched and drafted with the help of AI tools, '
                      'checked against YouTube\'s official documentation and updated when the rules change.',
        'author_more': 'How we write our guides',
        'footer_tagline': 'Free, privacy-friendly tools and plain-English guides for YouTube creators.',
        'footer_guides': 'Popular guides',
        'footer_company': 'TubeTools',
        'footer_note': 'TubeTools is an independent project and is not affiliated with, endorsed by, or sponsored by YouTube or Google.',
        'rights': 'All rights reserved.',
        'read_guide': 'Read guide',
        'open_tool': 'Open tool',
        'cat': {
            'thumbnails': 'Thumbnail design',
            'ctr': 'CTR & the algorithm',
            'titles': 'Titles',
            'growth': 'Channel growth & SEO',
            'monetization': 'Monetization',
            'resources': 'Creator resources',
        },
        'cat_intro': {
            'thumbnails': 'Design thumbnails that are readable, honest and easy to click.',
            'ctr': 'Understand the metrics YouTube shows you and what actually moves them.',
            'titles': 'Write titles that earn the click and keep the promise.',
            'growth': 'Set up, optimize and grow your channel with YouTube\'s own rules in mind.',
            'monetization': 'How YouTube pays creators, and what drives your RPM.',
            'resources': 'Tools and reference material worth bookmarking.',
        },
        '404_title': 'Page not found',
        'redirect_text': 'This page has moved to',
        'sitemap_pages': 'Pages',
    },
    'es': {
        'locale': 'es_ES',
        'skip': 'Saltar al contenido',
        'menu': 'Menú',
        'home': 'Inicio',
        'tools': 'Herramientas',
        'all_tools': 'Todas las herramientas',
        'guides': 'Guías',
        'glossary': 'Glosario',
        'about': 'Sobre TubeTools',
        'contact': 'Contacto',
        'privacy': 'Política de privacidad',
        'terms': 'Términos de uso',
        'sitemap': 'Mapa del sitio',
        'cookie_settings': 'Configurar privacidad',
        'other_lang_name': 'English',
        'other_lang_label': 'Read in English',
        'updated': 'Actualizado',
        'published': 'Publicado',
        'by': 'Por',
        'min_read': 'min de lectura',
        'toc': 'En esta página',
        'related': 'Sigue leyendo',
        'written_by': 'Escrito por',
        'author_role': 'Creador de TubeTools',
        'author_bio': 'Daniel desarrolla y gestiona TubeTools. Las guías se investigan y redactan con ayuda de herramientas de IA, '
                      'se contrastan con la documentación oficial de YouTube y se actualizan cuando cambian las normas.',
        'author_more': 'Cómo escribimos nuestras guías',
        'footer_tagline': 'Herramientas gratuitas y respetuosas con tu privacidad, y guías claras para creadores de YouTube.',
        'footer_guides': 'Guías populares',
        'footer_company': 'TubeTools',
        'footer_note': 'TubeTools es un proyecto independiente y no está afiliado, respaldado ni patrocinado por YouTube ni por Google.',
        'rights': 'Todos los derechos reservados.',
        'read_guide': 'Leer guía',
        'open_tool': 'Abrir herramienta',
        'cat': {
            'thumbnails': 'Diseño de miniaturas',
            'ctr': 'CTR y algoritmo',
            'titles': 'Títulos',
            'growth': 'Crecimiento y SEO del canal',
            'monetization': 'Monetización',
            'resources': 'Recursos para creadores',
        },
        'cat_intro': {
            'thumbnails': 'Miniaturas legibles, honestas y fáciles de pulsar.',
            'ctr': 'Qué significan las métricas de YouTube y qué las mueve de verdad.',
            'titles': 'Títulos que se ganan el clic y cumplen lo que prometen.',
            'growth': 'Configura, optimiza y haz crecer tu canal siguiendo las normas de YouTube.',
            'monetization': 'Cómo paga YouTube a los creadores y de qué depende tu RPM.',
            'resources': 'Herramientas y material de consulta que merece la pena guardar.',
        },
        '404_title': 'Página no encontrada',
        'redirect_text': 'Esta página se ha trasladado a',
        'sitemap_pages': 'Páginas',
    },
}
CATEGORY_ORDER = ['growth', 'thumbnails', 'ctr', 'titles', 'monetization', 'resources']

ICONS = {
    'download': '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    'scan': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="9" r="1.5"/>',
    'eye': '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'type': '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
    'calc': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    'check': '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'banner': '<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="6" y="9.5" width="12" height="5" rx="1"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    'book':'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    'arrow': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
    'chevron': '<path d="m6 9 6 6 6-6"/>',
    'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
}


def icon(name, cls='icon'):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


LOGO = ('<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#d32f2f"/>'
        '<path d="M9 9h14v4.5h-4.75V24h-4.5V13.5H9z" fill="#fff"/></svg>')


# ---------------------------------------------------------------- helpers

def esc(s):
    return html.escape(str(s), quote=True)


def page_url(lang, slug):
    prefix = '' if lang == 'es' else '/en'
    if slug == 'index':
        return prefix + '/'
    return f'{prefix}/{slug}.html'


def out_path(lang, slug):
    parts = [ROOT] + ([] if lang == 'es' else ['en']) + [f'{slug}.html']
    return os.path.join(*parts)


def parse_page(path):
    raw = open(path, encoding='utf-8').read()
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n', raw, re.S)
    if not m:
        sys.exit(f'Missing front matter in {path}')
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        k, _, v = line.partition(':')
        meta[k.strip()] = v.strip()
    return meta, raw[m.end():]


def fmt_date(d, lang):
    dt = datetime.date.fromisoformat(d)
    if lang == 'en':
        return dt.strftime('%B %-d, %Y') if os.name != 'nt' else dt.strftime('%B %#d, %Y')
    months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
              'septiembre', 'octubre', 'noviembre', 'diciembre']
    return f'{dt.day} de {months[dt.month - 1]} de {dt.year}'


def strip_tags(s):
    return re.sub(r'<[^>]+>', ' ', s)


def reading_time(body):
    words = len(re.findall(r'\w+', strip_tags(re.sub(r'<(script|style)[\s\S]*?</\1>', '', body))))
    return max(1, round(words / 220)), words


def slugify(text):
    text = strip_tags(text).lower()
    table = str.maketrans('áéíóúüñ', 'aeiouun')
    text = text.translate(table)
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text[:60] or 'section'


def cover_rel(page):
    return f'assets/img/covers/{page["lang"]}-{page["slug"]}.jpg'


def cover_url(page):
    """Absolute URL of the page's cover image if it exists, else None."""
    rel = cover_rel(page)
    return f'{SITE_URL}/{rel}' if os.path.exists(os.path.join(ROOT, rel)) else None


def inline_css():
    css = open(os.path.join(ROOT, 'assets', 'css', 'site.css'), encoding='utf-8').read()
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s*\n\s*', '', css)
    css = re.sub(r'\s{2,}', ' ', css)
    return css


def asset_version():
    h = hashlib.md5()
    for rel in ('assets/css/site.css', 'assets/js/site.js'):
        p = os.path.join(ROOT, rel)
        if os.path.exists(p):
            h.update(open(p, 'rb').read())
    tools_dir = os.path.join(ROOT, 'assets', 'js', 'tools')
    if os.path.isdir(tools_dir):
        for f in sorted(os.listdir(tools_dir)):
            h.update(open(os.path.join(tools_dir, f), 'rb').read())
    return h.hexdigest()[:8]


# ---------------------------------------------------------------- load

def load_pages():
    pages = {}
    stub_dir = os.environ.get('TT_STUB_DIR')  # development only: placeholder pages
    for lang in LANGS:
        d = os.path.join(SRC, lang)
        files = [(d, f) for f in sorted(os.listdir(d))]
        if stub_dir:
            have = {f for _, f in files}
            sd = os.path.join(stub_dir, lang)
            files += [(sd, f) for f in sorted(os.listdir(sd)) if f not in have]
        for d, f in files:
            if not f.endswith('.html'):
                continue
            slug = f[:-5]
            meta, body = parse_page(os.path.join(d, f))
            meta.setdefault('type', 'page')
            pages[(lang, slug)] = {
                'lang': lang, 'slug': slug, 'meta': meta, 'body': body,
                'url': page_url(lang, slug), 'out': out_path(lang, slug),
            }
    return pages


def resolve_links(body, lang, pages, where):
    """Turn href="@slug" / href="@en:slug#frag" into real URLs and check they exist."""
    def repl(m):
        target = m.group(1)
        frag = ''
        if '#' in target:
            target, frag = target.split('#', 1)
            frag = '#' + frag
        tlang = lang
        if ':' in target:
            tlang, target = target.split(':', 1)
        if (tlang, target) not in pages:
            sys.exit(f'Broken internal link @{m.group(1)} in {where}')
        return f'href="{pages[(tlang, target)]["url"]}{frag}"'
    return re.sub(r'href="@([^"]+)"', repl, body)


def add_heading_ids(body):
    toc = []
    used = set()

    def repl(m):
        level, attrs, inner = m.group(1), m.group(2) or '', m.group(3)
        idm = re.search(r'id="([^"]+)"', attrs)
        if idm:
            hid = idm.group(1)
        else:
            hid = slugify(inner)
            base, n = hid, 2
            while hid in used:
                hid = f'{base}-{n}'
                n += 1
            attrs = f'{attrs} id="{hid}"'
        used.add(hid)
        if level == '2' and 'data-notoc' not in attrs:
            toc.append((hid, strip_tags(inner).strip()))
        return f'<h{level}{attrs}>{inner}</h{level}>'
    body = re.sub(r'<h([23])((?:\s[^>]*)?)>(.*?)</h\1>', repl, body, flags=re.S)
    return body, toc


# ---------------------------------------------------------------- blocks

def tool_pages(pages, lang):
    tools = [p for p in pages.values() if p['lang'] == lang and p['meta'].get('tool_order')]
    return sorted(tools, key=lambda p: int(p['meta']['tool_order']))


def article_pages(pages, lang):
    arts = [p for p in pages.values() if p['lang'] == lang and p['meta']['type'] == 'article']
    return sorted(arts, key=lambda p: (CATEGORY_ORDER.index(p['meta']['category']), int(p['meta'].get('order', 50))))


def tools_grid(pages, lang, exclude=None):
    t = T[lang]
    cards = []
    for p in tool_pages(pages, lang):
        if exclude and p['slug'] == exclude:
            continue
        m = p['meta']
        cards.append(
            f'<a class="tool-tile" href="{p["url"]}">'
            f'<span class="tool-tile-icon">{icon(m.get("icon", "check"))}</span>'
            f'<span class="tool-tile-title">{esc(m["card_title"])}</span>'
            f'<span class="tool-tile-desc">{esc(m["card_desc"])}</span>'
            f'<span class="tool-tile-cta">{t["open_tool"]} {icon("arrow", "icon icon-sm")}</span></a>')
    return '<div class="tool-grid">' + ''.join(cards) + '</div>'


def article_card(p, lang):
    t = T[lang]
    m = p['meta']
    cov = cover_url(p)
    img = (f'<img class="guide-card-img" src="/{cover_rel(p)}" alt="" width="1200" height="630" loading="lazy" decoding="async">'
           if cov else '')
    return (f'<a class="guide-card{" has-img" if cov else ""}" href="{p["url"]}">{img}'
            f'<span class="guide-card-cat">{esc(t["cat"][m["category"]])}</span>'
            f'<span class="guide-card-title">{esc(m.get("card_title", m["h1"]))}</span>'
            f'<span class="guide-card-desc">{esc(m.get("card_desc", m["description"]))}</span>'
            f'<span class="guide-card-cta">{t["read_guide"]} {icon("arrow", "icon icon-sm")}</span></a>')


def guides_by_category(pages, lang):
    t = T[lang]
    out = []
    arts = article_pages(pages, lang)
    for cat in CATEGORY_ORDER:
        items = [p for p in arts if p['meta']['category'] == cat]
        if not items:
            continue
        out.append(f'<section class="guide-group" id="cat-{cat}"><h2>{esc(t["cat"][cat])}</h2>'
                   f'<p class="section-lead">{esc(t["cat_intro"][cat])}</p>'
                   f'<div class="guide-grid">{"".join(article_card(p, lang) for p in items)}</div></section>')
    return ''.join(out)


def featured_guides(pages, lang):
    arts = [p for p in article_pages(pages, lang) if p['meta'].get('featured')]
    arts.sort(key=lambda p: int(p['meta']['featured']))
    return '<div class="guide-grid">' + ''.join(article_card(p, lang) for p in arts) + '</div>'


def sitemap_block(pages, lang):
    t = T[lang]
    tools = ''.join(f'<li><a href="{p["url"]}">{esc(p["meta"]["card_title"])}</a></li>' for p in tool_pages(pages, lang))
    groups = []
    for cat in CATEGORY_ORDER:
        items = [p for p in article_pages(pages, lang) if p['meta']['category'] == cat]
        if items:
            lis = ''.join(f'<li><a href="{p["url"]}">{esc(p["meta"]["h1"])}</a></li>' for p in items)
            groups.append(f'<h3>{esc(t["cat"][cat])}</h3><ul>{lis}</ul>')
    others = [p for p in pages.values() if p['lang'] == lang and p['meta']['type'] in ('page', 'hub')
              and not p['meta'].get('noindex')]
    others.sort(key=lambda p: p['meta']['h1'])
    other_lis = ''.join(f'<li><a href="{p["url"]}">{esc(p["meta"]["h1"])}</a></li>' for p in others)
    return (f'<div class="sitemap-cols"><div><h2>{t["tools"]}</h2><ul>{tools}</ul>'
            f'<h2>{t["sitemap_pages"]}</h2><ul>{other_lis}</ul></div>'
            f'<div><h2>{t["guides"]}</h2>{"".join(groups)}</div></div>')


def expand_placeholders(body, page, pages):
    lang = page['lang']
    body = body.replace('[[tools_grid]]', tools_grid(pages, lang))
    body = body.replace('[[tools_grid_other]]', tools_grid(pages, lang, exclude=page['slug']))
    body = body.replace('[[guides_by_category]]', guides_by_category(pages, lang))
    body = body.replace('[[featured_guides]]', featured_guides(pages, lang))
    body = body.replace('[[sitemap]]', sitemap_block(pages, lang))
    body = body.replace('[[email]]', f'<a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>')
    return body


# ---------------------------------------------------------------- layout

def alt_page(page, pages):
    other = 'es' if page['lang'] == 'en' else 'en'
    alt = page['meta'].get('alt')
    if alt and (other, alt) in pages:
        return pages[(other, alt)]
    return None


def head_html(page, pages, ver, title_full, canonical):
    m = page['meta']
    lang = page['lang']
    t = T[lang]
    alt = alt_page(page, pages)
    noindex = m.get('noindex') == 'true'
    lines = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f'<title>{esc(title_full)}</title>',
        f'<meta name="description" content="{esc(m["description"])}">',
    ]
    if noindex:
        lines.append('<meta name="robots" content="noindex, follow">')
    else:
        lines.append(f'<link rel="canonical" href="{canonical}">')
        if alt:
            en_p = page if lang == 'en' else alt
            es_p = page if lang == 'es' else alt
            lines.append(f'<link rel="alternate" hreflang="en" href="{SITE_URL}{en_p["url"]}">')
            lines.append(f'<link rel="alternate" hreflang="es" href="{SITE_URL}{es_p["url"]}">')
            lines.append(f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}{en_p["url"]}">')
    og_img = cover_url(page) or f'{SITE_URL}/assets/img/og-{lang}.png'
    lines += [
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
        '<meta name="theme-color" content="#ffffff">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        f'<meta property="og:locale" content="{t["locale"]}">',
        f'<meta property="og:type" content="{"article" if m["type"] == "article" else "website"}">',
        f'<meta property="og:title" content="{esc(m.get("og_title", m["h1"]))}">',
        f'<meta property="og:description" content="{esc(m["description"])}">',
        f'<meta property="og:url" content="{canonical}">',
        f'<meta property="og:image" content="{og_img}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if m['type'] == 'home':
        lines.append(f'<meta name="google-site-verification" content="{SITE_VERIFICATION}">')
    regions = json.dumps(CONSENT_REGIONS)
    ads = m.get('ads', 'true') != 'false'
    if ads:
        lines.append('<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>')
        lines.append('<link rel="preconnect" href="https://fundingchoicesmessages.google.com" crossorigin>')
    lines.append('<link rel="dns-prefetch" href="https://www.googletagmanager.com">')
    lines += [
        '<script>'
        'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
        "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',"
        f"analytics_storage:'denied',region:{regions},wait_for_update:500}});"
        "gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',"
        "analytics_storage:'granted'});"
        "gtag('js',new Date());gtag('config','" + GA_ID + "');"
        # Analytics loads after the page has rendered so it doesn't compete with the content.
        "addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');"
        "s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=" + GA_ID + "';document.head.appendChild(s);},1200);});"
        '</script>',
    ]
    if ads:
        lines.append(f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>')
    lines.append(f'<style>{CSS}</style>')
    return '\n'.join(lines)


def structured_data(page, pages, canonical, toc_words):
    m = page['meta']
    lang = page['lang']
    t = T[lang]
    home = page_url(lang, 'index')
    blocks = []
    publisher = {'@type': 'Organization', 'name': SITE_NAME, 'url': SITE_URL + '/',
                 'logo': {'@type': 'ImageObject', 'url': f'{SITE_URL}/assets/img/logo-512.png'}}
    if m['type'] == 'home':
        blocks.append({'@context': 'https://schema.org', '@type': 'WebSite', 'name': SITE_NAME,
                       'url': SITE_URL + home, 'inLanguage': lang, 'publisher': publisher})
    if m.get('tool_order'):
        blocks.append({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': m['card_title'],
                       'url': canonical, 'description': m['description'], 'applicationCategory': 'MultimediaApplication',
                       'operatingSystem': 'Any', 'browserRequirements': 'Requires JavaScript',
                       'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'inLanguage': lang})
    if m['type'] == 'article':
        about = pages.get((lang, 'about'))
        blocks.append({
            '@context': 'https://schema.org', '@type': 'Article', 'headline': m['h1'],
            'description': m['description'], 'inLanguage': lang,
            'datePublished': m['published'], 'dateModified': m.get('updated', m['published']),
            'author': {'@type': 'Person', 'name': AUTHOR_NAME, 'url': SITE_URL + about['url'] if about else SITE_URL},
            'publisher': publisher, 'image': cover_url(page) or f'{SITE_URL}/assets/img/og-{lang}.png',
            'mainEntityOfPage': canonical, 'wordCount': toc_words,
        })
    if m['type'] != 'home':
        crumbs = breadcrumb_items(page, pages)
        blocks.append({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': name, 'item': SITE_URL + url}
            for i, (name, url) in enumerate(crumbs)]})
    return '\n'.join(f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>' for b in blocks)


def breadcrumb_items(page, pages):
    lang = page['lang']
    t = T[lang]
    m = page['meta']
    items = [(t['home'], page_url(lang, 'index'))]
    if m['type'] == 'article':
        blog = pages[(lang, 'blog')]
        items.append((t['guides'], blog['url']))
    items.append((m.get('crumb', m['h1']), page['url']))
    return items


def breadcrumbs_html(page, pages):
    items = breadcrumb_items(page, pages)
    parts = []
    for i, (name, url) in enumerate(items):
        if i == len(items) - 1:
            parts.append(f'<li aria-current="page">{esc(name)}</li>')
        else:
            parts.append(f'<li><a href="{url}">{esc(name)}</a></li>')
    return f'<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>{"".join(parts)}</ol></nav>'


def header_html(page, pages):
    lang = page['lang']
    t = T[lang]
    m = page['meta']
    active = m.get('nav', '')
    alt = alt_page(page, pages)
    other = 'es' if lang == 'en' else 'en'
    alt_url = alt['url'] if alt else page_url(other, 'index')
    tool_links = ''.join(
        f'<a href="{p["url"]}" class="dd-item">{icon(p["meta"].get("icon", "check"))}'
        f'<span><strong>{esc(p["meta"]["card_title"])}</strong><small>{esc(p["meta"]["card_short"])}</small></span></a>'
        for p in tool_pages(pages, lang))

    def cls(key):
        return ' class="is-active"' if key == active else ''
    return f'''<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="{page_url(lang, 'index')}">{LOGO}<span>Tube<b>Tools</b></span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav">{icon('menu')}<span class="sr-only">{t['menu']}</span></button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <div class="nav-dd">
        <button class="nav-dd-btn{' is-active' if active == 'tools' else ''}" aria-expanded="false">{t['tools']} {icon('chevron', 'icon icon-sm')}</button>
        <div class="nav-dd-panel">{tool_links}</div>
      </div>
      <a href="{pages[(lang, 'blog')]['url']}"{cls('guides')}>{t['guides']}</a>
      <a href="{pages[(lang, 'glossary' if lang == 'en' else 'glosario')]['url']}"{cls('glossary')}>{t['glossary']}</a>
      <a href="{pages[(lang, 'about')]['url']}"{cls('about')}>{t['about']}</a>
      <a class="lang-switch" href="{alt_url}" hreflang="{other}" lang="{other}" title="{t['other_lang_label']}">{icon('globe', 'icon icon-sm')} {t['other_lang_name']}</a>
    </nav>
  </div>
</header>'''


FOOTER_GUIDES = {
    'en': ['guide-thumbnails-ctr', 'youtube-ctr-guide-for-beginners', 'youtube-monetization-requirements',
           'youtube-rpm-vs-cpm', 'youtube-cpm-by-niche', 'youtube-thumbnail-size-format-guide'],
    'es': ['guia-miniaturas-ctr', 'guia-ctr-youtube-para-principiantes', 'requisitos-monetizacion-youtube',
           'rpm-vs-cpm-youtube', 'cpm-youtube-por-nicho', 'tamano-formato-miniatura-youtube-2026'],
}
LEGAL_SLUGS = {
    'en': {'about': 'about', 'contact': 'contact', 'privacy': 'privacy', 'terms': 'terms', 'sitemap': 'sitemap-page'},
    'es': {'about': 'about', 'contact': 'contacto', 'privacy': 'privacidad', 'terms': 'terminos', 'sitemap': 'mapa-sitio'},
}


def footer_html(page, pages):
    lang = page['lang']
    t = T[lang]
    year = datetime.date.today().year
    tools = ''.join(f'<li><a href="{p["url"]}">{esc(p["meta"]["card_title"])}</a></li>' for p in tool_pages(pages, lang))
    guides = ''.join(f'<li><a href="{pages[(lang, s)]["url"]}">{esc(pages[(lang, s)]["meta"].get("crumb", pages[(lang, s)]["meta"]["h1"]))}</a></li>'
                     for s in FOOTER_GUIDES[lang] if (lang, s) in pages)
    ls = LEGAL_SLUGS[lang]
    company = ''.join(f'<li><a href="{pages[(lang, ls[k])]["url"]}">{t[k if k != "about" else "about"]}</a></li>'
                      for k in ('about', 'contact', 'privacy', 'terms', 'sitemap') if (lang, ls[k]) in pages)
    company += f'<li><a href="{pages[(lang, ls["privacy"])]["url"]}#cookies" class="js-privacy-settings">{t["cookie_settings"]}</a></li>'
    return f'''<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="logo logo-invert" href="{page_url(lang, 'index')}">{LOGO}<span>Tube<b>Tools</b></span></a>
      <p>{t['footer_tagline']}</p>
    </div>
    <div><h2 class="footer-h">{t['tools']}</h2><ul>{tools}</ul></div>
    <div><h2 class="footer-h">{t['footer_guides']}</h2><ul>{guides}</ul></div>
    <div><h2 class="footer-h">{t['footer_company']}</h2><ul>{company}</ul></div>
  </div>
  <div class="container footer-bottom">
    <p>&copy; {year} TubeTools &middot; tubetools.online. {t['rights']}</p>
    <p>{t['footer_note']}</p>
  </div>
</footer>'''


def author_box(page, pages):
    lang = page['lang']
    t = T[lang]
    about = pages[(lang, 'about')]
    return f'''<aside class="author-box">
  <img src="/assets/img/daniel.jpg" alt="Daniel" width="64" height="64" loading="lazy">
  <div>
    <p class="author-name">{t['written_by']} <a href="{about['url']}">Daniel</a> &middot; <span>{t['author_role']}</span></p>
    <p>{t['author_bio']} <a href="{about['url']}#editorial">{t['author_more']}</a>.</p>
  </div>
</aside>'''


def related_html(page, pages):
    lang = page['lang']
    t = T[lang]
    slugs = [s.strip() for s in page['meta'].get('related', '').split(',') if s.strip()]
    cards = []
    for s in slugs:
        if (lang, s) not in pages:
            sys.exit(f'Unknown related slug {s} in {page["slug"]} ({lang})')
        p = pages[(lang, s)]
        if p['meta']['type'] == 'article':
            cards.append(article_card(p, lang))
        else:
            m = p['meta']
            cards.append(f'<a class="guide-card guide-card-tool" href="{p["url"]}"><span class="guide-card-cat">{t["tools"]}</span>'
                         f'<span class="guide-card-title">{esc(m.get("card_title", m["h1"]))}</span>'
                         f'<span class="guide-card-desc">{esc(m.get("card_desc", m["description"]))}</span>'
                         f'<span class="guide-card-cta">{t["open_tool"]} {icon("arrow", "icon icon-sm")}</span></a>')
    if not cards:
        return ''
    return f'<section class="related"><h2 data-notoc>{t["related"]}</h2><div class="guide-grid">{"".join(cards)}</div></section>'


def render(page, pages, ver):
    m = page['meta']
    lang = page['lang']
    t = T[lang]
    kind = m['type']
    body = resolve_links(page['body'], lang, pages, f'{lang}/{page["slug"]}')
    body = expand_placeholders(body, page, pages)
    body, toc = add_heading_ids(body)
    minutes, words = reading_time(body)
    canonical = SITE_URL + page['url']
    title_full = m['title'] if m.get('title_exact') == 'true' else f'{m["title"]} | {SITE_NAME}'

    if kind == 'article':
        toc_html = ''
        if toc and m.get('toc', 'true') != 'false':
            toc_html = (f'<details class="toc toc-inline" open><summary>{t["toc"]}</summary><ol>'
                        + ''.join(f'<li><a href="#{hid}">{esc(txt)}</a></li>' for hid, txt in toc) + '</ol></details>')
        dates = f'{t["updated"]} <time datetime="{m["updated"]}">{fmt_date(m["updated"], lang)}</time>'
        side_toc = ''
        if toc and m.get('toc', 'true') != 'false':
            side_toc = (f'<nav class="toc-side" aria-label="{t["toc"]}"><p class="toc-side-title">{t["toc"]}</p><ol>'
                        + ''.join(f'<li><a href="#{hid}">{esc(txt)}</a></li>' for hid, txt in toc) + '</ol></nav>')
        promo = ''
        for s in [x.strip() for x in m.get('related', '').split(',') if x.strip()]:
            rp = pages.get((lang, s))
            if rp and rp['meta'].get('tool_order'):
                rm = rp['meta']
                promo = (f'<a class="side-tool" href="{rp["url"]}"><span class="tool-tile-icon">{icon(rm.get("icon", "check"))}</span>'
                         f'<strong>{esc(rm["card_title"])}</strong><small>{esc(rm["card_short"])}</small>'
                         f'<span class="tool-tile-cta">{t["open_tool"]} {icon("arrow", "icon icon-sm")}</span></a>')
                break
        main = f'''<main id="main" class="article-main">
  <div class="container article-layout">
    <article class="article">
      {breadcrumbs_html(page, pages)}
      <header class="article-header">
        <p class="eyebrow">{esc(t['cat'][m['category']])}</p>
        <h1>{m['h1']}</h1>
        <p class="lead">{m['lead']}</p>
        <p class="article-meta">{t['by']} <a href="{pages[(lang, 'about')]['url']}">Daniel</a> &middot; {dates} &middot; {minutes} {t['min_read']}</p>
      </header>
      {toc_html}
      <div class="prose">
{body}
      </div>
      {author_box(page, pages)}
      {related_html(page, pages)}
    </article>
    <aside class="article-aside"><div class="aside-sticky">{side_toc}{promo}</div></aside>
  </div>
</main>'''
    elif kind in ('tool', 'home'):
        crumbs = '' if kind == 'home' else breadcrumbs_html(page, pages)
        main = f'''<main id="main" class="tool-main">
  <section class="tool-hero">
    <div class="container">
      {crumbs}
      <h1>{m['h1']}</h1>
      <p class="lead">{m['lead']}</p>
    </div>
  </section>
{body}
</main>'''
    else:  # page, hub, legal, 404
        crumbs = '' if kind == '404' else breadcrumbs_html(page, pages)
        width = 'narrow' if m.get('width', 'narrow') == 'narrow' else ''
        main = f'''<main id="main" class="page-main">
  <div class="container {width}">
    {crumbs}
    <header class="page-header">
      <h1>{m['h1']}</h1>
      {f'<p class="lead">{m["lead"]}</p>' if m.get('lead') else ''}
    </header>
    <div class="{'prose' if m.get('prose', 'true') == 'true' else ''}">
{body}
    </div>
  </div>
</main>'''

    scripts = [f'<script src="/assets/js/site.js?v={ver}" defer></script>']
    if m.get('script'):
        for s in m['script'].split(','):
            scripts.append(f'<script src="/assets/js/tools/{s.strip()}.js?v={ver}" defer></script>')
    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
{head_html(page, pages, ver, title_full, canonical)}
{structured_data(page, pages, canonical, words)}
</head>
<body class="page-{kind}">
<a class="skip-link" href="#main">{t['skip']}</a>
{header_html(page, pages)}
{main}
{footer_html(page, pages)}
{chr(10).join(scripts)}
</body>
</html>
'''


def redirect_html(old, new):
    lang = 'en' if old.startswith('/en/') else 'es'
    t = T[lang]
    target = SITE_URL + new
    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<title>{esc(t['redirect_text'])} {esc(new)}</title>
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url={new}">
<script>location.replace({json.dumps(new)} + location.hash);</script>
</head>
<body>
<p>{esc(t['redirect_text'])} <a href="{new}">{target}</a>.</p>
</body>
</html>
'''


def sitemap_xml(pages):
    urls = []
    for (lang, slug), p in sorted(pages.items(), key=lambda kv: (kv[0][0] != 'en', kv[1]['url'])):
        m = p['meta']
        if m.get('noindex') == 'true':
            continue
        lastmod = m.get('updated') or m.get('published') or datetime.date.today().isoformat()
        alt = alt_page(p, pages)
        links = ''
        if alt:
            en_p = p if lang == 'en' else alt
            es_p = p if lang == 'es' else alt
            links = (f'\n    <xhtml:link rel="alternate" hreflang="en" href="{SITE_URL}{en_p["url"]}"/>'
                     f'\n    <xhtml:link rel="alternate" hreflang="es" href="{SITE_URL}{es_p["url"]}"/>'
                     f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE_URL}{en_p["url"]}"/>')
        urls.append(f'  <url>\n    <loc>{SITE_URL}{p["url"]}</loc>\n    <lastmod>{lastmod}</lastmod>{links}\n  </url>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + '\n'.join(urls) + '\n</urlset>\n')


def check_required(pages):
    required = {'h1', 'title', 'description'}
    for (lang, slug), p in pages.items():
        missing = required - set(p['meta'])
        if p['meta']['type'] == 'article':
            missing |= {'category', 'published', 'updated', 'lead'} - set(p['meta'])
        if p['meta'].get('tool_order'):
            missing |= {'card_title', 'card_desc', 'card_short'} - set(p['meta'])
        if missing:
            sys.exit(f'{lang}/{slug} is missing: {", ".join(sorted(missing))}')
        alt = p['meta'].get('alt')
        other = 'es' if lang == 'en' else 'en'
        if alt and (other, alt) not in pages:
            sys.exit(f'{lang}/{slug}: alt page {other}/{alt} does not exist')
        if alt and pages[(other, alt)]['meta'].get('alt') != slug:
            sys.exit(f'{lang}/{slug}: alt page {other}/{alt} does not point back')
        tl = len(p['meta']['title']) + len(SITE_NAME) + 3
        if tl > 70 and p['meta'].get('title_exact') != 'true':
            print(f'  note: long <title> ({tl} chars) on {lang}/{slug}')
        dl = len(p['meta']['description'])
        if not 70 <= dl <= 165:
            print(f'  note: description length {dl} on {lang}/{slug}')


CSS = ''


def write_cover_jobs(pages):
    jobs = []
    for p in pages.values():
        if p['meta']['type'] == 'article':
            jobs.append({'out': cover_rel(p), 'title': strip_tags(p['meta']['h1']).replace('&amp;', '&'),
                         'label': T[p['lang']]['cat'][p['meta']['category']], 'category': p['meta']['category']})
    jobs.sort(key=lambda j: j['out'])
    with open(os.path.join(ROOT, '_tools', 'covers.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    missing = [j['out'] for j in jobs if not os.path.exists(os.path.join(ROOT, j['out']))]
    if missing:
        print(f'  note: {len(missing)} guide cover(s) missing — run: node _tools/covers.mjs')


def main():
    global CSS
    pages = load_pages()
    check_required(pages)
    CSS = inline_css()
    write_cover_jobs(pages)
    ver = asset_version()
    written = set()
    for page in pages.values():
        html_out = render(page, pages, ver)
        os.makedirs(os.path.dirname(page['out']), exist_ok=True)
        with open(page['out'], 'w', encoding='utf-8', newline='\n') as f:
            f.write(html_out)
        written.add(os.path.relpath(page['out'], ROOT).replace(os.sep, '/'))
    for old, new in REDIRECTS.items():
        path = os.path.join(ROOT, *old.strip('/').split('/'))
        rel = old.strip('/')
        if rel in written:
            sys.exit(f'Redirect {old} collides with a real page')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(redirect_html(old, new))
        written.add(rel)
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(sitemap_xml(pages))
    # 404 page for GitHub Pages must live at /404.html
    stale = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if not d.startswith(('.', '_')) and d != 'assets']
        for f in fn:
            if f.endswith('.html'):
                rel = os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, '/')
                if rel not in written:
                    stale.append(rel)
    print(f'Built {len(pages)} pages + {len(REDIRECTS)} redirects (assets v={ver}).')
    if stale:
        print('HTML files not produced by the build (delete them if they are old):')
        for s in sorted(stale):
            print('  ', s)


if __name__ == '__main__':
    main()
