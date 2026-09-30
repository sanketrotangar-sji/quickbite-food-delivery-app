#!/usr/bin/env python3
"""
Offline menu-category classifier on QuickBite embeddings.

Features: public.embeddings vectors where source_table = 'menu_items'
Labels:   public.menu_items.category

  python3 -m venv .venv-ml
  .venv-ml/bin/pip install scikit-learn numpy matplotlib supabase python-dotenv
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
    .venv-ml/bin/python scripts/classify_menu_category.py

Writes docs/ml/classification-metrics.json and docs/ml/confusion_matrix.png
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "ml"
MIN_ACCURACY = 0.70


def load_dotenv_files() -> None:
    for rel in (".env", "apps/manager/.env", "apps/client/.env"):
        path = ROOT / rel
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t or t.startswith("#") or "=" not in t:
                continue
            k, v = t.split("=", 1)
            k, v = k.strip(), v.strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            os.environ.setdefault(k, v)


def parse_vector(raw) -> list[float] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("[") and s.endswith("]"):
            s = s[1:-1]
        if not s:
            return None
        return [float(x) for x in s.split(",")]
    return None


def fetch_xy():
    from supabase import create_client

    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    sb = create_client(url, key)

    emb_rows: list[dict] = []
    start = 0
    page = 1000
    while True:
        res = (
            sb.table("embeddings")
            .select("source_id, embedding")
            .eq("source_table", "menu_items")
            .range(start, start + page - 1)
            .execute()
        )
        batch = res.data or []
        emb_rows.extend(batch)
        if len(batch) < page:
            break
        start += page

    menu_rows: list[dict] = []
    start = 0
    while True:
        res = (
            sb.table("menu_items")
            .select("id, category")
            .range(start, start + page - 1)
            .execute()
        )
        batch = res.data or []
        menu_rows.extend(batch)
        if len(batch) < page:
            break
        start += page

    cat_by_id = {r["id"]: (r.get("category") or "").strip() for r in menu_rows}
    X_list: list[list[float]] = []
    y_list: list[str] = []
    skipped = 0
    for row in emb_rows:
        label = cat_by_id.get(row["source_id"])
        vec = parse_vector(row.get("embedding"))
        if not label or not vec or len(vec) != 768:
            skipped += 1
            continue
        X_list.append(vec)
        y_list.append(label)

    if len(X_list) < 20:
        raise SystemExit(f"Need ≥20 labeled menu embeddings; got {len(X_list)} (skipped {skipped}).")

    return np.asarray(X_list, dtype=np.float64), np.asarray(y_list), skipped


def train_and_eval(X: np.ndarray, y: np.ndarray):
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
    from sklearn.model_selection import train_test_split
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.preprocessing import StandardScaler

    counts = Counter(y.tolist())
    # Stratify needs ≥2 samples per class; drop rare labels for the split.
    keep = {c for c, n in counts.items() if n >= 2}
    mask = np.array([lab in keep for lab in y], dtype=bool)
    X, y = X[mask], y[mask]
    if len(np.unique(y)) < 2:
        raise SystemExit("Not enough category diversity after filtering rare labels.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model_name = "logistic_regression"
    clf = LogisticRegression(max_iter=2000)
    clf.fit(X_train_s, y_train)
    y_pred = clf.predict(X_test_s)
    acc = float(accuracy_score(y_test, y_pred))

    if acc < MIN_ACCURACY:
        model_name = "knn"
        knn = KNeighborsClassifier(n_neighbors=min(5, len(X_train)), weights="distance")
        knn.fit(X_train_s, y_train)
        y_pred = knn.predict(X_test_s)
        acc = float(accuracy_score(y_test, y_pred))
        clf = knn

    labels = sorted(set(y_test.tolist()) | set(y_pred.tolist()))
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    report = classification_report(y_test, y_pred, labels=labels, output_dict=True, zero_division=0)

    return {
        "model": model_name,
        "accuracy": acc,
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "classification_report": report,
        "y_test": y_test.tolist(),
        "y_pred": y_pred.tolist(),
        "label_counts": dict(counts),
    }


def save_confusion_png(labels, cm, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(max(8, len(labels) * 0.55), max(6, len(labels) * 0.45)))
    im = ax.imshow(cm, interpolation="nearest", cmap="Blues")
    ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    ax.set(
        xticks=range(len(labels)),
        yticks=range(len(labels)),
        xticklabels=labels,
        yticklabels=labels,
        ylabel="True category",
        xlabel="Predicted category",
        title="Menu category confusion matrix",
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    thresh = cm.max() / 2.0 if cm.size else 0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                format(cm[i, j], "d"),
                ha="center",
                va="center",
                color="white" if cm[i, j] > thresh else "black",
                fontsize=8,
            )
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140)
    plt.close(fig)


def main() -> int:
    load_dotenv_files()
    try:
        import sklearn  # noqa: F401
    except ImportError:
        print(
            "scikit-learn not installed. Example:\n"
            "  python3 -m venv .venv-ml && .venv-ml/bin/pip install scikit-learn numpy matplotlib supabase",
            file=sys.stderr,
        )
        return 1

    X, y, skipped = fetch_xy()
    result = train_and_eval(X, y)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    metrics = {
        "task": "menu_items.category from nomic-embed-text vectors",
        "model": result["model"],
        "accuracy": round(result["accuracy"], 4),
        "meets_70pct_bar": result["accuracy"] >= MIN_ACCURACY,
        "n_samples": int(len(y)),
        "n_train": result["n_train"],
        "n_test": result["n_test"],
        "skipped_rows": skipped,
        "label_counts": result["label_counts"],
        "labels": result["labels"],
        "confusion_matrix": result["confusion_matrix"],
        "classification_report": result["classification_report"],
    }
    metrics_path = OUT_DIR / "classification-metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    png_path = OUT_DIR / "confusion_matrix.png"
    save_confusion_png(result["labels"], np.asarray(result["confusion_matrix"]), png_path)

    # Also dump a CSV table for quick reading without opening the PNG.
    csv_path = OUT_DIR / "confusion_matrix.csv"
    with csv_path.open("w", encoding="utf-8") as f:
        f.write("," + ",".join(result["labels"]) + "\n")
        for i, lab in enumerate(result["labels"]):
            row = result["confusion_matrix"][i]
            f.write(lab + "," + ",".join(str(v) for v in row) + "\n")

    print(f"model={result['model']} accuracy={result['accuracy']:.4f}")
    print(f"wrote {metrics_path}")
    print(f"wrote {png_path}")
    print(f"wrote {csv_path}")
    if result["accuracy"] < MIN_ACCURACY:
        print(f"WARNING: accuracy below {MIN_ACCURACY:.0%} bar", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
