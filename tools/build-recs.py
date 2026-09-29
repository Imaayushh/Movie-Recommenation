#!/usr/bin/env python3
"""
Filmphile — content similarity precompute.

Builds `server-data/similarity.json` from the live catalog. For every movie,
web series, TV show and anime title it builds a text document (title + genre + year +
language + synopsis + director + leads) and scores every other title in the
same catalog with TF-IDF cosine similarity (scikit-learn). The output is a
static snapshot the frontend reads at runtime — no Python needed to serve.

This is the Python counterpart of tools/collect-enrichment.js: it talks to a
running Filmphile server (default http://localhost:3000) and writes one JSON
file into server-data/.

Usage:
    python tools/build-recs.py                 # against http://localhost:3000
    API_BASE=http://localhost:3000/api python tools/build-recs.py
"""

import json
import os
import sys
import urllib.request

API_BASE = os.environ.get('API_BASE', 'http://localhost:3000/api')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server-data')
OUT_FILE = os.path.join(DATA_DIR, 'similarity.json')

TOP_NEIGHBOURS = 10      # keep this many neighbours per title
MIN_SCORE = 0.02         # drop near-zero cosine pairs
TIMEOUT_MS = 20000

KINDS = [('movies', 'movie'), ('series', 'web series'), ('tv', 'TV show'), ('anime', 'anime')]


def fetch(path):
    req = urllib.request.Request(API_BASE + path, headers={'accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=TIMEOUT_MS) as res:
        return json.loads(res.read().decode('utf-8'))


def text_for(item, category_label, kind_label):
    parts = []
    parts.append(str(item.get('moviename') or ''))
    if category_label:
        parts.append(category_label)
    if item.get('year'):
        parts.append(str(item['year']))
    if item.get('language'):
        parts.append(str(item['language']))
    if item.get('synopsis'):
        parts.append(str(item['synopsis']))
    if item.get('director'):
        parts.append(str(item['director']))
    leads = item.get('leads')
    if leads:
        parts.append(' '.join(str(x) for x in leads))
    text = ' '.join(parts)
    return text or (kind_label + ' ' + str(item.get('id') or ''))


def build_kind(kind, kind_label, categories):
    items = fetch('/' + kind)
    if not items:
        return {}

    cat_label = {int(c['id']): c['label'] for c in categories}
    docs = []
    for item in items:
        label = cat_label.get(int(item.get('category', -1)))
        docs.append(text_for(item, label, kind_label))

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError as err:
        sys.stderr.write('scikit-learn is required: pip install scikit-learn\n')
        raise SystemExit(1)

    vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2), max_features=5000)
    matrix = vectorizer.fit_transform(docs)
    sim = cosine_similarity(matrix)

    out = {}
    for i, item in enumerate(items):
        neighbours = []
        for j in range(len(items)):
            if i == j:
                continue
            score = float(sim[i][j])
            if score < MIN_SCORE:
                continue
            neighbours.append({
                'id': items[j].get('id'),
                'title': items[j].get('moviename'),
                'score': round(score, 4),
                'category': items[j].get('category'),
                'year': items[j].get('year')
            })
        neighbours.sort(key=lambda n: n['score'], reverse=True)
        out[str(item.get('id'))] = neighbours[:TOP_NEIGHBOURS]
    return out


def main():
    categories = fetch('/categories')

    result = {'model': 'tfidf-cosine', 'movies': {}, 'series': {}, 'tv': {}, 'anime': {}}
    for kind, kind_label in KINDS:
        result[kind] = build_kind(kind, kind_label, categories)
        count = len(result[kind])
        links = sum(len(v) for v in result[kind].values())
        print('{:<8} {:<5} items, {:>6} similarity links'.format(kind, count, links))

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=1)
    print('wrote', os.path.relpath(OUT_FILE))


if __name__ == '__main__':
    main()