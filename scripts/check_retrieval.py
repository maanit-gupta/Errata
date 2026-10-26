"""Dev check (P04 acceptance): match_vault on the hero draft returns the expected citations.

eval "$(scripts/local-supabase-env.sh)"
cd apps/worker && uv run python ../../scripts/check_retrieval.py
"""

from __future__ import annotations

import sys

import psycopg

from brandlens_worker import config
from brandlens_worker.embeddings import Embedder, to_pgvector
from brandlens_worker.settings import get_settings

HERO = (
    "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured "
    "annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!"
)
ORG = "00000000-0000-4000-8000-0000000000a1"
DIWALI = "20000000-0000-4000-8000-000000000001"
MUST = {"CL-03", "F-112", "E-19", "G-07"}


def main() -> int:
    s = get_settings()
    vec = Embedder(s.embedding_model, s.model_cache_dir).embed([HERO])[0]
    with psycopg.connect(s.database_url.get_secret_value()) as conn:
        rows = conn.execute(
            "select code, kind, round(similarity::numeric, 3) "
            "from public.match_vault(%s, %s, %s::extensions.vector, %s)",
            (ORG, DIWALI, to_pgvector(vec), config.TOPK),
        ).fetchall()
    for code, kind, sim in rows:
        print(f"  {code:<6} {kind:<5} {sim}")
    codes = {r[0] for r in rows}
    missing, bleed = MUST - codes, "E-11" in codes
    print(f"top-{config.TOPK}: missing={sorted(missing) or 'none'}, E-11 returned={bleed}")
    return 0 if not missing and not bleed else 1


if __name__ == "__main__":
    sys.exit(main())
