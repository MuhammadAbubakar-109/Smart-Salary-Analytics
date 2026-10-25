"""
Employee Salary Prediction API
==============================
Predict monthly salaries and view model evaluation results.

Run:   python main.py
Docs:  http://127.0.0.1:8000/docs
"""

from contextlib import asynccontextmanager
from pathlib import Path
import json
import logging
import math

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────
# 1. CONFIG
# ──────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"

MODEL_PATH = ARTIFACT_DIR / "model.joblib"
EVALUATION_PATH = ARTIFACT_DIR / "evaluation_data.json"

# Frontends allowed to call this API (React / Vite dev servers)
ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("salary-api")


# ──────────────────────────────────────────────────────────────
# 2. APP STATE  (filled once at startup)
# ──────────────────────────────────────────────────────────────

state = {
    "pipeline": None,
    "feature_cols": [],
    "points": [],
    "metrics": {},
    "n_test": 0,
}


# ──────────────────────────────────────────────────────────────
# 3. REQUEST SCHEMA
# ──────────────────────────────────────────────────────────────

class SalaryFeatures(BaseModel):
    """Employee details used to predict salary (all fields have defaults)."""

    # Experience
    Experience_Years: float = Field(default=5, ge=0)
    Industry_Experience_Years: float = Field(default=4, ge=0)
    Years_in_Current_Role: float = Field(default=2, ge=0)
    Years_at_Company: float = Field(default=3, ge=0)

    # Skills & responsibility
    Certifications_Count: float = Field(default=3, ge=0)
    Technical_Skills_Count: float = Field(default=8, ge=0)
    Team_Size_Managed: float = Field(default=0, ge=0)
    Employee_Count: float = Field(default=500, ge=0)

    # Work profile
    Working_Hours_Per_Week: float = Field(default=40, ge=0, le=80)
    Performance_Rating: float = Field(default=4, ge=0, le=5)
    Job_Grade: float = Field(default=3, ge=0)

    # Economy
    Inflation_Rate: float = Field(default=5.0)
    Year: int = Field(default=2026, ge=2000, le=2030)

    # Job details
    Job_Title: str = "Software Engineer"
    Job_Family: str = "Information Technology"
    Job_Level: str = "Mid-Level"
    Department: str = "Engineering"
    Industry: str = "Information Technology"

    # Education
    Education_Level: str = "Bachelor"
    Field_of_Study: str = "Computer Science"
    Management_Responsibility: str = "Individual Contributor"

    # Company
    Company_Size: str = "Medium"
    Company_Type: str = "Private"

    # Location
    Country: str = "Pakistan"
    Region: str = "Punjab"
    City: str = "Lahore"

    # Employment
    Employment_Type: str = "Full-Time"
    Remote_Work_Type: str = "Hybrid"
    Currency: str = "PKR"

    # Benchmarks
    Job_Evaluation_Score: float = Field(default=70.0, ge=0)
    Local_Median_Salary: float = Field(default=150000.0, ge=0)


# ──────────────────────────────────────────────────────────────
# 4. RESPONSE SCHEMAS
# ──────────────────────────────────────────────────────────────

class SalaryResponse(BaseModel):
    predicted_salary: float
    currency: str


class EvaluationPoint(BaseModel):
    actual: float
    predicted: float


class EvaluationMetrics(BaseModel):
    r2: float
    mae: float
    rmse: float


class EvaluationResponse(BaseModel):
    points: list[EvaluationPoint]
    n_test: int
    metrics: EvaluationMetrics


# ──────────────────────────────────────────────────────────────
# 5. STARTUP: LOAD & VALIDATE ARTIFACTS
# ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model and evaluation data once, then clean up on shutdown."""

    # Required files
    for path in (MODEL_PATH, EVALUATION_PATH):
        if not path.is_file():
            raise RuntimeError(f"File not found: {path}. Run the training script first.")

    # Model artifact
    artifact = joblib.load(MODEL_PATH)
    for key in ("pipeline", "feature_cols"):
        if key not in artifact:
            raise RuntimeError(f"Model artifact missing key: {key}")

    cols = artifact["feature_cols"]
    if not cols or not all(isinstance(c, str) for c in cols) or len(set(cols)) != len(cols):
        raise RuntimeError("Invalid feature_cols in model artifact.")

    # Evaluation data
    evaluation = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    for key in ("points", "n_test", "metrics"):
        if key not in evaluation:
            raise RuntimeError(f"Evaluation file missing key: {key}")

    metrics = {k: float(evaluation["metrics"][k]) for k in ("mae", "rmse", "r2")}
    if not all(math.isfinite(v) for v in metrics.values()):
        raise RuntimeError("Evaluation metrics must be finite numbers.")

    # Save to state only after everything is valid
    state.update(
        pipeline=artifact["pipeline"],
        feature_cols=cols,
        points=evaluation["points"],
        metrics=metrics,
        n_test=int(evaluation["n_test"]),
    )
    logger.info("Model loaded | features=%d | test_samples=%d", len(cols), state["n_test"])

    yield

    state.update(pipeline=None, feature_cols=[], points=[], metrics={}, n_test=0)
    logger.info("Model unloaded")


# ──────────────────────────────────────────────────────────────
# 6. APP SETUP
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Employee Salary Prediction API",
    description="Predict employee monthly salaries and evaluate model performance.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────
# 7. ROUTES
# ──────────────────────────────────────────────────────────────

@app.get("/", tags=["General"], summary="Home")
def home():
    """Confirm the backend is running."""
    return {"message": "Backend is running!"}


@app.get("/health", tags=["General"], summary="Health check")
def health_check():
    """Report whether the model and evaluation data are loaded."""
    loaded = state["pipeline"] is not None
    return {
        "status": "healthy" if loaded else "unavailable",
        "model_loaded": loaded,
        "features_expected": len(state["feature_cols"]),
        "evaluation_loaded": bool(state["points"]),
        "n_test": state["n_test"],
    }


@app.post(
    "/predict",
    response_model=SalaryResponse,
    tags=["Prediction"],
    summary="Predict monthly salary",
)
def predict_salary(features: SalaryFeatures):
    """Return the predicted monthly salary for one employee."""
    if state["pipeline"] is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    input_data = features.model_dump()
    cols = state["feature_cols"]

    # Every feature the model was trained on must exist in the schema
    missing = [c for c in cols if c not in input_data]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"API schema is missing model features: {missing}",
        )

    # Build one row in the exact training column order
    input_df = pd.DataFrame([{c: input_data[c] for c in cols}], columns=cols)

    try:
        prediction = float(state["pipeline"].predict(input_df)[0])
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=f"Prediction failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Unexpected prediction error")
        raise HTTPException(status_code=500, detail="Unexpected prediction error.") from exc

    if not math.isfinite(prediction) or prediction < 0:
        raise HTTPException(status_code=500, detail="Model produced an invalid salary.")

    return {
        "predicted_salary": round(prediction, 2),
        "currency": features.Currency.strip().upper(),
    }


@app.get(
    "/evaluate",
    response_model=EvaluationResponse,
    tags=["Evaluation"],
    summary="Model evaluation results",
)
def get_evaluation():
    """Return test-set predictions and metrics (R², MAE, RMSE)."""
    if not state["points"]:
        raise HTTPException(status_code=503, detail="Evaluation data is not loaded.")

    return {
        "points": state["points"],
        "n_test": state["n_test"],
        "metrics": state["metrics"],
    }


# ──────────────────────────────────────────────────────────────
# 8. RUN SERVER  (file must be named main.py)
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
