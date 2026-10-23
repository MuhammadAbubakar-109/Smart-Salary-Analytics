"""
test_api.py
───────────
End-to-end smoke tests for the Employee Salary Prediction API.

Prerequisites:
    1. python train.py          (model must exist)
    2. uvicorn main:app --reload (server must be running)
    3. python test_api.py       (run this file)
"""

import sys
import requests

# ═══════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT  = 10  # seconds

# Counters
_passed = 0
_failed = 0


# ═══════════════════════════════════════════════════════════
#  HELPER
# ═══════════════════════════════════════════════════════════

def check(
    label: str,
    method: str,
    path: str,
    expected_status: int = 200,
    **kwargs,
):
    """
    Send one request, print the result, update pass/fail counters.

    Parameters
    ----------
    label           : human-readable test name
    method          : "get" | "post" | "put" | "delete"
    path            : e.g. "/predict"
    expected_status : HTTP status code we expect
    **kwargs        : forwarded to requests (json=, params=, …)
    """
    global _passed, _failed

    url = f"{BASE_URL}{path}"

    try:
        response = getattr(requests, method)(
            url, timeout=TIMEOUT, **kwargs
        )
        status = response.status_code
        body   = response.json()
        ok     = status == expected_status

        icon = "✅" if ok else "❌"
        _passed += ok
        _failed += not ok

        print(f"  {icon}  {label:<32} {status}  {body}")

    except requests.ConnectionError:
        print(f"  ❌  {label:<32} ---  SERVER NOT REACHABLE")
        _failed += 1

    except Exception as exc:
        print(f"  ❌  {label:<32} ERR  {exc}")
        _failed += 1


# ═══════════════════════════════════════════════════════════
#  TEST SUITES
# ═══════════════════════════════════════════════════════════

def test_info_routes():
    """Basic liveness and health endpoints."""
    print("\n── Info Routes ──────────────────────────────────")
    check("GET  /",        "get", "/")
    check("GET  /health",  "get", "/health")


def test_user_routes():
    """User lookup stub."""
    print("\n── User Routes ──────────────────────────────────")
    check("GET  /users/1",   "get", "/users/1")
    check("GET  /users/99",  "get", "/users/99")
    check("GET  /users/-1",  "get", "/users/-1", expected_status=400)


def test_predict_valid():
    """Realistic salary predictions across career stages."""
    print("\n── Prediction (valid) ──────────────────────────")

    cases = [
        (
            "Intern / Junior",
            {
                "years_experience": 1,
                "education_level": 1,
                "job_level": 1,
                "performance_score": 58,
            },
        ),
        (
            "Mid-level",
            {
                "years_experience": 6,
                "education_level": 2,
                "job_level": 2,
                "performance_score": 76,
            },
        ),
        (
            "Senior",
            {
                "years_experience": 12,
                "education_level": 3,
                "job_level": 3,
                "performance_score": 88,
            },
        ),
        (
            "Lead / Executive",
            {
                "years_experience": 18,
                "education_level": 4,
                "job_level": 4,
                "performance_score": 95,
            },
        ),
    ]

    for title, payload in cases:
        check(f"POST /predict  ({title})", "post", "/predict", json=payload)


def test_predict_validation():
    """Inputs that should be rejected by Pydantic validators."""
    print("\n── Prediction (validation errors) ─────────────")

    bad_cases = [
        (
            "Missing field",
            {
                "years_experience": 5,
                "education_level": 2,
                # job_level missing
                "performance_score": 70,
            },
        ),
        (
            "Negative experience",
            {
                "years_experience": -3,
                "education_level": 2,
                "job_level": 2,
                "performance_score": 70,
            },
        ),
        (
            "Score out of range",
            {
                "years_experience": 5,
                "education_level": 2,
                "job_level": 2,
                "performance_score": 150,
            },
        ),
        (
            "Wrong type",
            {
                "years_experience": "five",
                "education_level": 2,
                "job_level": 2,
                "performance_score": 70,
            },
        ),
    ]

    for title, payload in bad_cases:
        check(
            f"POST /predict  ({title})",
            "post",
            "/predict",
            expected_status=422,
            json=payload,
        )


# ═══════════════════════════════════════════════════════════
#  RUNNER
# ═══════════════════════════════════════════════════════════

def main():
    print("=" * 55)
    print("  EMPLOYEE SALARY API — TEST SUITE")
    print("=" * 55)

    test_info_routes()
    test_user_routes()
    test_predict_valid()
    test_predict_validation()

    # ── summary ─────────────────────────────────────────
    total = _passed + _failed
    print("\n" + "=" * 55)
    print(f"  RESULTS:  {_passed}/{total} passed", end="")
    if _failed:
        print(f"  |  {_failed} FAILED")
    else:
        print("  🎉  ALL PASSED")
    print("=" * 55 + "\n")

    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()