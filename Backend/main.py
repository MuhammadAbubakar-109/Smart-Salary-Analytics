
"""
main.py
-------
Employee Salary Prediction API

Features:
    - Health and information routes
    - User management (stub)
    - ML salary prediction (29 features)
    - Model evaluation using saved test-set predictions

Requires:
    artifacts/model.pkl

Run:
    uvicorn main:app --reload
"""

from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
#  1. CONFIGURATION
# ═══════════════════════════════════════════════════════════

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "artifacts" / "model.pkl"


# ═══════════════════════════════════════════════════════════
#  2. GLOBAL STATE
# ═══════════════════════════════════════════════════════════

pipeline = None
feature_cols = None
evaluation_points = None
evaluation_metrics = None
n_test = 0


# ═══════════════════════════════════════════════════════════
#  3. SCHEMAS — SALARY FEATURES (29 FEATURES)
# ═══════════════════════════════════════════════════════════

class SalaryFeatures(BaseModel):
    """All 29 features expected by the salary prediction model."""

    # ── Numeric (13) ─────────────────────────────────────

    Experience_Years: float = Field(
        ..., ge=0, examples=[5]
    )
    Industry_Experience_Years: float = Field(
        ..., ge=0, examples=[3]
    )
    Years_in_Current_Role: float = Field(
        ..., ge=0, examples=[2]
    )
    Years_at_Company: float = Field(
        ..., ge=0, examples=[3]
    )
    Certifications_Count: float = Field(
        ..., ge=0, examples=[2]
    )
    Technical_Skills_Count: float = Field(
        ..., ge=0, examples=[5]
    )
    Team_Size_Managed: float = Field(
        ..., ge=0, examples=[0]
    )
    Employee_Count: float = Field(
        ..., ge=0, examples=[500]
    )
    Working_Hours_Per_Week: float = Field(
        ..., ge=0, le=80, examples=[40]
    )
    Performance_Rating: float = Field(
        ..., ge=0, le=5, examples=[4.0]
    )
    Job_Grade: float = Field(
        ..., ge=0, examples=[7]
    )
    Inflation_Rate: float = Field(
        ..., examples=[3.2]
    )
    Year: float = Field(
        ..., ge=2000, le=2030, examples=[2024]
    )

    # ── Categorical (16) ─────────────────────────────────

    Job_Title: str = Field(
        ..., examples=["Software Engineer"]
    )
    Job_Family: str = Field(
        ..., examples=["Engineering"]
    )
    Job_Level: str = Field(
        ..., examples=["Mid"]
    )
    Department: str = Field(
        ..., examples=["IT"]
    )
    Industry: str = Field(
        ..., examples=["Technology"]
    )
    Education_Level: str = Field(
        ..., examples=["Bachelor"]
    )
    Field_of_Study: str = Field(
        ..., examples=["Computer Science"]
    )
    Management_Responsibility: str = Field(
        ..., examples=["No"]
    )
    Company_Size: str = Field(
        ..., examples=["Large"]
    )
    Company_Type: str = Field(
        ..., examples=["Private"]
    )
    Country: str = Field(
        ..., examples=["United States"]
    )
    Region: str = Field(
        ..., examples=["North America"]
    )
    City: str = Field(
        ..., examples=["New York"]
    )
    Employment_Type: str = Field(
        ..., examples=["Full-Time"]
    )
    Remote_Work_Type: str = Field(
        ..., examples=["Hybrid"]
    )
    Currency: str = Field(
        ..., examples=["USD"]
    )


# ═══════════════════════════════════════════════════════════
#  4. SCHEMAS — API RESPONSES
# ═══════════════════════════════════════════════════════════

class SalaryResponse(BaseModel):
    predicted_salary: float
    currency: str = "USD"


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


class UserResponse(BaseModel):
    user_id: int
    name: str
    message: str


# ═══════════════════════════════════════════════════════════
#  5. LIFESPAN — LOAD MODEL AND EVALUATION DATA
# ═══════════════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, feature_cols
    global evaluation_points, evaluation_metrics, n_test

    try:
        if not MODEL_PATH.is_file():
            print(f"Model file missing: {MODEL_PATH}")
            yield
            return

        artifact = joblib.load(MODEL_PATH)

        required_keys = [
            "pipeline",
            "feature_cols",
            "metrics",
            "evaluation_points",
            "n_test",
        ]
        missing_keys = [
            key for key in required_keys
            if key not in artifact
        ]

        if missing_keys:
            print(f"Model artifact missing keys: {missing_keys}")
            yield
            return

        pipeline = artifact["pipeline"]
        feature_cols = artifact["feature_cols"]
        evaluation_points = artifact["evaluation_points"]
        evaluation_metrics = artifact["metrics"]
        n_test = int(artifact["n_test"])

        print(f"Model loaded: {len(feature_cols)} features")
        yield

    except Exception as exc:
        print(f"Model initialization failed: {type(exc).__name__}: {exc}")
        yield

    finally:
        pipeline = None
        feature_cols = None
        evaluation_points = None
        evaluation_metrics = None
        n_test = 0



# ═══════════════════════════════════════════════════════════
#  6. APP
# ═══════════════════════════════════════════════════════════

app = FastAPI(
    title="Employee Salary Prediction API",
    description=(
        "Backend API for employee salary prediction, "
        "model evaluation, and user management."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ═══════════════════════════════════════════════════════════
#  7. ROUTES — INFO
# ═══════════════════════════════════════════════════════════

@app.get("/", tags=["Info"])
def home():
    """Check that the API is running."""

    return {
        "message": "Backend is running!"
    }


@app.get("/health", tags=["Info"])
def health_check():
    """Return API and model status."""

    return {
        "status": "healthy",
        "model_loaded": pipeline is not None,
        "features_expected": (
            len(feature_cols)
            if feature_cols is not None
            else 0
        ),
        "evaluation_loaded": evaluation_points is not None,
        "n_test": n_test,
    }


# ═══════════════════════════════════════════════════════════
#  8. ROUTES — USERS (STUB)
# ═══════════════════════════════════════════════════════════

@app.get(
    "/users/{user_id}",
    response_model=UserResponse,
    tags=["Users"],
)
def get_user(user_id: int):
    """Example user endpoint; replace with a real user service."""

    if user_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="user_id must be positive",
        )

    return UserResponse(
        user_id=user_id,
        name="Test User",
        message="User fetched successfully",
    )


# ═══════════════════════════════════════════════════════════
#  9. ROUTES — SALARY PREDICTION
# ═══════════════════════════════════════════════════════════

@app.post(
    "/predict",
    response_model=SalaryResponse,
    tags=["Prediction"],
)
def predict_salary(features: SalaryFeatures):
    """Predict monthly salary from employee features."""

    if pipeline is None or feature_cols is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded",
        )

    # Convert the validated request into a DataFrame.
    input_data = features.model_dump()

    # Use exactly the feature columns and order from training.
    missing_features = [
        col for col in feature_cols
        if col not in input_data
    ]

    if missing_features:
        raise HTTPException(
            status_code=422,
            detail=(
                "Required model features are missing: "
                f"{missing_features}"
            ),
        )

    input_df = pd.DataFrame(
        [input_data],
        columns=feature_cols,
    )

    try:
        prediction = float(
            pipeline.predict(input_df)[0]
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not process prediction input: {exc}",
        ) from exc

    # Return the requested currency label.
    # Note: this labels the result; it does not perform FX conversion.
    return SalaryResponse(
        predicted_salary=round(prediction, 2),
        currency=features.Currency,
    )


# ═══════════════════════════════════════════════════════════
#  10. ROUTES — MODEL EVALUATION
# ═══════════════════════════════════════════════════════════

@app.get(
    "/evaluate",
    response_model=EvaluationResponse,
    tags=["Evaluation"],
)
def get_evaluation():
    """
    Return the actual vs. predicted values and metrics
    saved from the held-out test set during training.
    No synthetic evaluation points are generated here.
    """

    if (
        evaluation_points is None
        or evaluation_metrics is None
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Evaluation data is not loaded. "
                "Run train.py and restart the API."
            ),
        )

    points = [
        EvaluationPoint(**point)
        for point in evaluation_points
    ]

    metrics = EvaluationMetrics(
        **evaluation_metrics
    )

    return EvaluationResponse(
        points=points,
        n_test=n_test,
        metrics=metrics,
    )


# ═══════════════════════════════════════════════════════════
#  11. ENTRY POINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
