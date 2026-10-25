
import json
import joblib
import numpy as np
import pandas as pd

from pathlib import Path

from sklearn.model_selection import train_test_split

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from sklearn.linear_model import LinearRegression

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

# 1. File paths
BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = (
    BASE_DIR / "data" / "employee_salary_dataset_10000.csv"
)
OUTPUT_DIR = BASE_DIR / "artifacts"

MODEL_PATH = OUTPUT_DIR / "model.joblib"
METRICS_PATH = OUTPUT_DIR / "model_metrics.json"
EVALUATION_PATH = OUTPUT_DIR / "evaluation_data.json"

TARGET = "Monthly_Salary"

# 2. Load data
df = pd.read_csv(DATASET_PATH)

if TARGET not in df.columns:
    raise ValueError(f"Target column '{TARGET}' not found.")

# 3. Clean target and remove identifier
df = df.drop(columns=["Employee_ID"], errors="ignore")
df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
df = df.dropna(subset=[TARGET])
df = df[df[TARGET] > 0].copy()

# 4. Split features and target
X = df.drop(columns=[TARGET])
y = df[TARGET].astype(float)

# 5. Identify feature types
numeric_cols = X.select_dtypes(
    include=["number"]
).columns.tolist()

categorical_cols = X.select_dtypes(
    include=["object", "category", "string"]
).columns.tolist()

# Reject unsupported feature types
other_cols = [
    c for c in X.columns
    if c not in numeric_cols + categorical_cols
]

if other_cols:
    raise ValueError(
        f"Unsupported feature columns: {other_cols}"
    )

# 6. Preprocessing
numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
])

categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore")),
])

preprocessor = ColumnTransformer([
    ("numeric", numeric_pipeline, numeric_cols),
    ("categorical", categorical_pipeline, categorical_cols),
])

# 7. Linear Regression model with important parameters
model = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", LinearRegression(
        fit_intercept=True,
        copy_X=True,
        positive=False,
        n_jobs=-1,
    )),
])

# 8. Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
)

# 9. Train and predict
model.fit(X_train, y_train)
predictions = model.predict(X_test)

# 10. Calculate evaluation metrics
mae = float(mean_absolute_error(y_test, predictions))

rmse = float(
    np.sqrt(mean_squared_error(y_test, predictions))
)

r2 = float(r2_score(y_test, predictions))

metrics = {
    "model": "LinearRegression",
    "target": TARGET,
    "currency": "PKR",
    "mae": mae,
    "rmse": rmse,
    "r2": r2,
    "n_rows": int(len(df)),
    "n_train": int(len(X_train)),
    "n_test": int(len(X_test)),
    "n_features": int(X.shape[1]),
}


# 11. Print metrics
print("\nLinear Regression Metrics")
print(f"MAE:  PKR {mae:,.2f}")
print(f"RMSE: PKR {rmse:,.2f}")
print(f"R2:   {r2:.4f}")


# 12. Feature coefficients
feature_names = (
    model.named_steps["preprocessor"]
    .get_feature_names_out()
)

coefficients = (
    model.named_steps["regressor"].coef_
)

# Top 5 features by absolute coefficient
top5_indices = np.argsort(np.abs(coefficients))[::-1][:5]

feature_coefficients = [
    {
        "feature": str(feature_names[i]),
        "coefficient": float(coefficients[i]),
    }
    for i in top5_indices
]

print("\nTop 5 Features by Absolute Coefficient:")
for item in feature_coefficients:
    print(
        f"{item['feature']}: "
        f"{item['coefficient']:.4f}"
    )


# 13. Prepare output directory
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# 14. Save model artifact
artifact = {
    "pipeline": model,
    "feature_cols": X.columns.tolist(),
    "numeric_cols": numeric_cols,
    "categorical_cols": categorical_cols,
    "target": TARGET,
    "metrics": metrics,
    "feature_coefficients": feature_coefficients,
}

joblib.dump(artifact, MODEL_PATH)


# 15. Save metrics JSON
full_metrics = {
    "model": "LinearRegression",
    "target": TARGET,
    "currency": "PKR",
    "n_rows": int(len(df)),
    "n_train": int(len(X_train)),
    "n_test": int(len(X_test)),
    "n_features": int(X.shape[1]),
    "test_size": 0.20,
    "random_state": 42,
    "mae": float(mae),
    "rmse": float(rmse),
    "r2": float(r2),
}

with open(METRICS_PATH, "w", encoding="utf-8") as f:
    json.dump(full_metrics, f, indent=2)


# 16. Save evaluation data JSON
evaluation_data = {
    "target": TARGET,
    "n_test": int(len(y_test)),
    "metrics": {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
    },
    "points": [
        {
            "actual": float(actual),
            "predicted": float(predicted),
        }
        for actual, predicted in zip(y_test, predictions)
    ],
}

with open(EVALUATION_PATH, "w", encoding="utf-8") as f:
    json.dump(evaluation_data, f, indent=2)


# 17. Final output
print("\nSaved files:")
print("Model:", MODEL_PATH)
print("Metrics:", METRICS_PATH)
print("Evaluation:", EVALUATION_PATH)

print("\nLinear Regression training complete!")



