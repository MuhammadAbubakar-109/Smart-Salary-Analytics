
"""
train.py
────────
Employee Salary Prediction — Training Pipeline

Reads:
    data/employee_salary_dataset_10000.csv

Saves:
    artifacts/model.pkl
        Full artifact dictionary, including the trained pipeline,
        feature metadata, metrics, and actual test-set predictions.

    artifacts/model_metrics.json
        Model metrics, baseline metrics, and dataset statistics.

    artifacts/evaluation_data.json
        Actual and predicted salaries from the held-out test set.

Usage:
    python train.py
"""

from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# ═══════════════════════════════════════════════════════════
#  1. CONFIGURATION — edit these to match your project
# ═══════════════════════════════════════════════════════════


OUTPUT_DIR = BASE_DIR / "artifacts"
MODEL_PATH = OUTPUT_DIR / "model.joblib"
METRICS_PATH = OUTPUT_DIR / "model_metrics.json"
EVALUATION_PATH = OUTPUT_DIR / "evaluation_data.json"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


TARGET = "Monthly_Salary"

EXCLUDED_COLUMNS = [
    "Employee_ID",
    "Local_Median_Salary",
    "Job_Evaluation_Score",
]

TEST_SIZE = 0.20
RANDOM_STATE = 42
MINIMUM_ROWS = 10
N_ESTIMATORS = 200


# ═══════════════════════════════════════════════════════════
#  2. LOAD & CLEAN
# ═══════════════════════════════════════════════════════════

def load_data() -> pd.DataFrame:
    """Read CSV, coerce target, and drop invalid rows."""

    if not DATASET_PATH.is_file():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH)

    if TARGET not in df.columns:
        raise ValueError(
            f"Target '{TARGET}' not in CSV. "
            f"Available columns: {list(df.columns)}"
        )

    df[TARGET] = pd.to_numeric(
        df[TARGET],
        errors="coerce",
    )

    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=[TARGET])
    df = df[df[TARGET] > 0]
    df = df.drop_duplicates().reset_index(drop=True)

    if len(df) < MINIMUM_ROWS:
        raise ValueError(
            f"Only {len(df)} usable rows "
            f"(need >= {MINIMUM_ROWS})."
        )

    print(
        f"Loaded {len(df):,} rows x "
        f"{len(df.columns)} columns"
    )

    return df


# ═══════════════════════════════════════════════════════════
#  3. FEATURE PREPARATION
# ═══════════════════════════════════════════════════════════

def prepare_features(df: pd.DataFrame):
    """Split X/y and detect numeric vs categorical columns."""

    drop = [
        TARGET,
        *[
            c for c in EXCLUDED_COLUMNS
            if c in df.columns
        ],
    ]

    X = df.drop(columns=drop).copy()
    y = df[TARGET].copy()

    if X.empty:
        raise ValueError(
            "No features remain after exclusions."
        )

    numeric_cols = X.select_dtypes(
        include=np.number
    ).columns.tolist()

    categorical_cols = [
        c for c in X.columns
        if c not in numeric_cols
    ]

    # Normalize categorical values to strings while
    # preserving missing values for imputation.
    for col in categorical_cols:
        X[col] = X[col].apply(
            lambda value: (
                str(value)
                if pd.notna(value)
                else np.nan
            )
        )

    print(
        f"Numeric features ({len(numeric_cols)}): "
        f"{numeric_cols}"
    )

    print(
        f"Categorical features ({len(categorical_cols)}): "
        f"{categorical_cols}"
    )

    return X, y, numeric_cols, categorical_cols


# ═══════════════════════════════════════════════════════════
#  4. PREPROCESSING PIPELINE
# ═══════════════════════════════════════════════════════════

def build_preprocessor(numeric_cols, categorical_cols):
    """
    Numeric:
        Median imputation + standardization.

    Categorical:
        Most-frequent imputation + one-hot encoding.
    """

    transformers = []

    if numeric_cols:
        transformers.append((
            "num",
            Pipeline([
                (
                    "imputer",
                    SimpleImputer(strategy="median"),
                ),
                (
                    "scaler",
                    StandardScaler(),
                ),
            ]),
            numeric_cols,
        ))

    if categorical_cols:
        transformers.append((
            "cat",
            Pipeline([
                (
                    "imputer",
                    SimpleImputer(
                        strategy="most_frequent"
                    ),
                ),
                (
                    "encoder",
                    OneHotEncoder(
                        handle_unknown="ignore"
                    ),
                ),
            ]),
            categorical_cols,
        ))

    return ColumnTransformer(
        transformers,
        remainder="drop",
    )


# ═══════════════════════════════════════════════════════════
#  5. EVALUATION
# ═══════════════════════════════════════════════════════════

def evaluate(y_true, y_pred) -> dict:
    """Return MAE, RMSE, and R² rounded for readability."""

    return {
        "mae": round(
            float(
                mean_absolute_error(y_true, y_pred)
            ),
            2,
        ),
        "rmse": round(
            float(
                np.sqrt(
                    mean_squared_error(y_true, y_pred)
                )
            ),
            2,
        ),
        "r2": round(
            float(
                r2_score(y_true, y_pred)
            ),
            4,
        ),
    }


# ═══════════════════════════════════════════════════════════
#  6. TRAIN → EVALUATE → SAVE
# ═══════════════════════════════════════════════════════════

def train():
    print("\n" + "=" * 55)
    print("  EMPLOYEE SALARY PREDICTION — TRAINING")
    print("=" * 55 + "\n")

    # ── Load and prepare data ────────────────────────────
    df = load_data()

    X, y, num_cols, cat_cols = prepare_features(df)

    # Split before fitting the pipeline.
    # The test data is not used to train the model.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
    )

    print(
        f"\nTrain rows: {len(X_train):,} | "
        f"Test rows: {len(X_test):,}"
    )

    # ── Build pipeline ───────────────────────────────────
    preprocessor = build_preprocessor(
        num_cols,
        cat_cols,
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        (
            "regressor",
            RandomForestRegressor(
                n_estimators=N_ESTIMATORS,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        ),
    ])

    print("\nTraining model...")

    # Fit only on training data.
    pipeline.fit(X_train, y_train)

    # ── Evaluate on held-out test data ───────────────────
    preds = pipeline.predict(X_test)

    model_metrics = evaluate(
        y_test,
        preds,
    )

    # Actual and predicted values for every test sample.
    # These are the real values used by the evaluation chart.
    evaluation_points = [
        {
            "actual": float(actual),
            "predicted": float(predicted),
        }
        for actual, predicted in zip(
            y_test.to_numpy(),
            preds,
        )
    ]

    # ── Baseline comparison ──────────────────────────────
    baseline = np.full(
        len(y_test),
        y_train.median(),
    )

    baseline_metrics = evaluate(
        y_test,
        baseline,
    )

    # ── Feature importances ──────────────────────────────
    rf = pipeline.named_steps["regressor"]

    feat_names = (
        pipeline.named_steps["preprocessor"]
        .get_feature_names_out()
    )

    top5 = sorted(
        zip(
            feat_names,
            rf.feature_importances_,
        ),
        key=lambda item: item[1],
        reverse=True,
    )[:5]

    feature_importances = [
        {
            "feature": str(name),
            "importance": float(importance),
        }
        for name, importance in top5
    ]

    # ── Build artifact dictionary ────────────────────────
    artifact = {
        "pipeline": pipeline,
        "feature_cols": X.columns.tolist(),
        "numeric_cols": num_cols,
        "categorical_cols": cat_cols,
        "target": TARGET,
        "metrics": model_metrics,
        "baseline_metrics": baseline_metrics,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "test_size": TEST_SIZE,
        "random_state": RANDOM_STATE,
        "evaluation_points": evaluation_points,
        "feature_importances": feature_importances,
    }

    # ── Build metrics report ─────────────────────────────
    full_metrics = {
        "model": "RandomForestRegressor",
        "target": TARGET,
        "n_rows": int(len(df)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "n_features": int(X.shape[1]),
        "test_size": TEST_SIZE,
        "random_state": RANDOM_STATE,
        **{
            f"model_{key}": value
            for key, value in model_metrics.items()
        },
        **{
            f"baseline_{key}": value
            for key, value in baseline_metrics.items()
        },
    }

    # ── Build evaluation JSON ────────────────────────────
    evaluation_data = {
        "target": TARGET,
        "n_test": int(len(y_test)),
        "metrics": model_metrics,
        "points": evaluation_points,
    }

    # ── Save all artifacts ───────────────────────────────
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        artifact,
        MODEL_PATH,
    )

    METRICS_PATH.write_text(
        json.dumps(
            full_metrics,
            indent=2,
        ),
        encoding="utf-8",
    )

    EVALUATION_PATH.write_text(
        json.dumps(
            evaluation_data,
            indent=2,
        ),
        encoding="utf-8",
    )

    # ── Report results ───────────────────────────────────
    print("\n" + "=" * 55)
    print("  RESULTS")
    print("=" * 55)

    print(
        f"\nModel    → MAE {model_metrics['mae']:>10,.2f}  "
        f"RMSE {model_metrics['rmse']:>10,.2f}  "
        f"R² {model_metrics['r2']:.4f}"
    )

    print(
        f"Baseline → MAE {baseline_metrics['mae']:>10,.2f}  "
        f"RMSE {baseline_metrics['rmse']:>10,.2f}  "
        f"R² {baseline_metrics['r2']:.4f}"
    )

    print("\nTop 5 features:")

    for name, importance in top5:
        bar = "█" * int(importance * 40)

        print(
            f"    {name:<35} "
            f"{importance:.4f}  {bar}"
        )

    print(f"\nModel      → {MODEL_PATH}")
    print(f"Metrics    → {METRICS_PATH}")
    print(f"Evaluation → {EVALUATION_PATH}")

    print("\nTraining complete.\n")

    return artifact


# ═══════════════════════════════════════════════════════════
#  7. ENTRY POINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    train()
