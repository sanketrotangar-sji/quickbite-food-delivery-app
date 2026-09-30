# Menu category classifier (offline)

Standalone sklearn experiment on QuickBite menu embeddings.

| Input | `embeddings.embedding` where `source_table = 'menu_items'` (768-d nomic-embed-text) |
| Output label | `menu_items.category` |
| Split | 80/20 stratified |
| Models tried | Logistic regression first; k-NN if accuracy &lt; 70% |

## Artifacts

| File | Contents |
|------|----------|
| `classification-metrics.json` | Accuracy, model name, confusion matrix, per-class report |
| `confusion_matrix.png` | Heatmap |
| `confusion_matrix.csv` | Same matrix as CSV |

## Re-run

```bash
python3 -m venv .venv-ml
.venv-ml/bin/pip install scikit-learn numpy matplotlib supabase
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  .venv-ml/bin/python scripts/classify_menu_category.py
# or: npm run ml:classify-menu  (uses system/venv python3 on PATH)
```

Manager auto-suggest UI is intentionally out of scope (Part 3).
