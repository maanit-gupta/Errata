# PayWise demo kit (fictional)

Everything here is invented for the BrandLens demo. PayWise is not a real company.

| File | What it is |
|---|---|
| `guide.md` → `guide.pdf` | 4-page brand guide (voice, terminology, claims, visual, accessibility). Rebuild with `cd apps/worker && uv run python ../../scripts/build_fixture_pdf.py`. |
| `facts.csv` | Fact Vault import (SPEC §12 columns). Same values as `supabase/seed.sql`. |
| `glossary.csv` | Glossary import; `variants` are `\|`-separated. |
| `logos/` | Geometric wordmark: `paywise-primary`, `paywise-reversed` (Ink background), `paywise-mark`. SVG sources, PNGs rendered by the same script. |
| `creatives/` | 10 labelled 1080×1080 test creatives for the vision checks, plus `labels.json` (expected checks, logo box, alt text, every text element's colours). Rebuild with `cd apps/worker && uv run python ../../scripts/build_fixture_creatives.py`. |
