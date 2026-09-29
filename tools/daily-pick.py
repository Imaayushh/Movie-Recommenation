#!/usr/bin/env python3
"""
Filmphile — "Today's pick" generator (Python).

Picks the single featured title that shows up in the "Today's pick" container
on the Personalised picks page. It is deterministic per calendar day, so the
pick is stable for everyone all day and rolls over to a new title the next day.

Where Python fits:
  - The content graph the pick is based on is the scikit-learn TF-IDF cosine
    similarity model written by tools/build-recs.py (similarity.json).
  - This script consumes that model together with the live community ratings
    (store.json) and the curated IMDb charts (toplists.json), then uses the
    standard-library hash seeding to rotate today's hero through the titles
    the community rates highest AND that sit in well-connected similarity
    neighbourhoods (a title almost nobody rated, or with no similar content
    ever, can not be the pick of the day).

The Node server serves the result at /api/daily-pick. If this script has not
been run (or its date is stale it uses a tiny in-server fallback), so the
feature never breaks.

Usage:
    python tools/daily-pick.py                  # against http://localhost:3000
    API_BASE=http://localhost:3000/api python tools/daily-pick.py
"""

import hashlib
import json
import os
import sys
import urllib.request

# Windows consoles default to cp1252, which cannot print '\u2605' (★). Force UTF-8.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, ValueError):
    pass

API_BASE = os.environ.get('API_BASE', 'http://localhost:3000/api')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'server-data')
OUT_FILE = os.path.join(DATA_DIR, 'daily-pick.json')
TIMEOUT_MS = 20000

KINDS = [('movies', 'movie'), ('series', 'series'), ('tv', 'tv'), ('anime', 'anime')]

MIN_RATINGS = 4     # a title needs at least this many community reviews to qualify
MIN_AVG = 3.0       # ...and an average at least this high
POOL_SIZE = 60      # rotate through this many ranked candidates


def fetch(path):
    req = urllib.request.Request(API_BASE + path, headers={'accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=TIMEOUT_MS) as res:
        return json.loads(res.read().decode('utf-8'))


def load_json(name, fallback):
    path = os.path.join(DATA_DIR, name)
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            return json.load(fh)
    except (IOError, ValueError):
        return fallback


def today_key():
    return __import__('datetime').date.today().isoformat()


def day_seed(date_key):
    """Stable 64-bit hash of the date -> same pick all day, different tomorrow."""
    digest = hashlib.md5(date_key.encode('utf-8')).digest()
    return int.from_bytes(digest[:8], 'big')


def norm_title(value):
    return ' '.join(
        (str(value or '').lower().replace('-', ' ').replace('_', ' '))
        .split()
    ).replace('the ', '', 1) if value else ''


def imdb_score_for(entry, toplists):
    key = norm_title(entry.get('moviename'))
    for bucket in ('imdbMovies', 'imdbSeries', 'imdbTv', 'imdbAnime'):
        for row in toplists.get(bucket, []):
            if norm_title(row.get('title')) == key and str(row.get('year')) == str(entry.get('year')):
                return row.get('score')
    return None


def main():
    print('Pulling catalog from', API_BASE, '...')
    catalogs = {}
    for sub, _kind in KINDS:
        catalogs[sub] = fetch('/' + sub)

    sim = load_json('similarity.json', {})
    store = load_json('store.json', {'ratings': []})
    toplists = load_json('toplists.json', {})

    date_key = today_key()
    seed = day_seed(date_key)

    # Aggregate community ratings per catalog id.
    from collections import defaultdict
    sums = defaultdict(float)
    counts = defaultdict(int)
    for r in store.get('ratings', []):
        movie_id = str(r.get('movieId'))
        value = r.get('rating') or 0
        if value > 0:
            sums[movie_id] += value
            counts[movie_id] += 1

    candidates = []
    for sub, kind in KINDS:
        bucket = sim.get(kind, {}) if isinstance(sim, dict) else {}
        for entry in catalogs[sub]:
            key = str(entry.get('id'))
            count = counts.get(key, 0)
            avg = sums.get(key, 0) / count if count else 0.0
            if count < MIN_RATINGS or avg < MIN_AVG:
                continue
            reach = len(bucket.get(key, []))          # scikit-learn neighbours
            if reach < 2:
                continue
            popularity = min(count, 50) / 50.0        # 0..1
            score = avg * 10 + popularity * 5 + min(reach, 10) * 0.4
            candidates.append({
                'kind': kind,
                'id': entry.get('id'),
                'title': entry.get('moviename'),
                'year': entry.get('year'),
                'category': entry.get('category'),
                'avg': round(avg, 2),
                'count': count,
                'reach': reach,
                'score': round(score, 2),
                'imdb': imdb_score_for(entry, toplists)
            })

    if not candidates:
        sys.stderr.write('No qualifying titles yet — seed bot ratings first (node tools/build-bots.js).\n')
        raise SystemExit(1)

    candidates.sort(key=lambda c: (-c['score'], -c['count'], c['title']))
    pool = candidates[:POOL_SIZE]

    pick = pool[seed % len(pool)]
    peers = [n.get('title') for n in (bucket_for(sim, pick['kind']).get(str(pick['id']), [])[:3])] \
        if isinstance(sim, dict) else []

    row = {
        'date': date_key,
        'kind': pick['kind'],
        'catalogId': pick['id'],
        'title': pick['title'],
        'year': pick['year'],
        'category': pick['category'],
        'communityAvg': pick['avg'],
        'ratingCount': pick['count'],
        'imdbScore': pick['imdb'],
        'reason': 'Python daily pick \u2014 a community favourite ranked by the scikit-learn similarity graph'
                  + (('; similar to ' + ', '.join(peers)) if peers else '')
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = OUT_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(row, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, OUT_FILE)

    print('Today\u2019s pick (' + date_key + '): ' + pick['title'] +
          '  [' + pick['kind'] + ']  \u2605 ' + str(pick['avg']) +
          ' from ' + str(pick['count']) + ' ratings, ' + str(pick['reach']) + ' similar titles')
    print('wrote', os.path.relpath(OUT_FILE))


def bucket_for(sim, kind):
    if not isinstance(sim, dict):
        return {}
    return sim.get(kind, {})


if __name__ == '__main__':
    main()