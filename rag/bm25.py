"""Okapi BM25 (k1=1.5, b=0.75) over a small in-memory corpus."""
from __future__ import annotations

import math
import re
from collections import Counter

_WORD = re.compile(r"\w+", re.UNICODE)
STOPWORDS = frozenset("a an and are as at be by for from has have in is it its of on or that the this to was were will with".split())


def tokenize(text: str) -> list[str]:
    return [w for w in (m.group(0).lower() for m in _WORD.finditer(text)) if w not in STOPWORDS]


class BM25:
    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.docs = [Counter(tokenize(d)) for d in docs]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avgdl = (sum(self.lengths) / len(self.lengths)) if self.lengths else 0.0
        df: Counter[str] = Counter()
        for d in self.docs:
            df.update(d.keys())
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def score(self, query_terms: list[str], i: int) -> float:
        d, dl = self.docs[i], self.lengths[i]
        s = 0.0
        for t in query_terms:
            tf = d.get(t, 0)
            if not tf:
                continue
            denom = tf + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1))
            s += self.idf.get(t, 0.0) * tf * (self.k1 + 1) / denom
        return s

    def scores(self, query: str) -> list[tuple[int, float]]:
        terms = tokenize(query)
        return [(i, self.score(terms, i)) for i in range(len(self.docs))]
