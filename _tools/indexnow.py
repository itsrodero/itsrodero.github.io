"""Tell Bing (and the other IndexNow engines) about new or changed pages.

    python _tools/indexnow.py                 # every URL in sitemap.xml
    python _tools/indexnow.py en/glossary.html glosario.html

The key file <KEY>.txt at the site root proves we own the host.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

HOST = 'tubetools.online'
KEY = '7afeee78b3f1dbbdbdecc38840ebc52e'
ROOT = Path(__file__).resolve().parent.parent


def urls_from_args(args):
    if not args:
        return re.findall(r'<loc>([^<]+)</loc>', (ROOT / 'sitemap.xml').read_text(encoding='utf-8'))
    return [a if a.startswith('https://') else f'https://{HOST}/{a.lstrip("/")}' for a in args]


def main():
    urls = urls_from_args(sys.argv[1:])
    body = json.dumps({
        'host': HOST,
        'key': KEY,
        'keyLocation': f'https://{HOST}/{KEY}.txt',
        'urlList': urls,
    }).encode()
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body,
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f'{r.status} — {len(urls)} URLs submitted')
    except urllib.error.HTTPError as e:
        print(f'{e.code} {e.reason} — {e.read().decode(errors="replace")[:300]}')
        sys.exit(1)


if __name__ == '__main__':
    main()
