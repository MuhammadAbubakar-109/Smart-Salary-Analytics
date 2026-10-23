/**
 * Salary Prediction API client
 * Types mirror the Pydantic models in `main.py`.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface NumericFeatures {
  Experience_Years: number;
  Industry_Experience_Years: number;
  Years_in_Current_Role: number;
  Years_at_Company: number;
  Certifications_Count: number;
  Technical_Skills_Count: number;
  Team_Size_Managed: number;
  Employee_Count: number;
  Working_Hours_Per_Week: number;
  Performance_Rating: number;
  Job_Grade: number;
  Inflation_Rate: number;
  Year: number;
}

export interface CategoricalFeatures {
  Job_Title: string;
  Job_Family: string;
  Job_Level: string;
  Department: string;
  Industry: string;
  Education_Level: string;
  Field_of_Study: string;
  Management_Responsibility: string;
  Company_Size: string;
  Company_Type: string;
  Country: string;
  Region: string;
  City: string;
  Employment_Type: string;
  Remote_Work_Type: string;
  Currency: string;
}

export type SalaryFeatures = NumericFeatures & CategoricalFeatures;

export interface SalaryResponse {
  predicted_salary: number;
  currency: string;
}

export interface Health {
  status: string;
  model_loaded: boolean;
  features_expected: number;
}

export interface EvaluationPoint {
  actual: number;
  predicted: number;
}

export interface Evaluation {
  points: EvaluationPoint[];
  n_test: number;
  metrics: {
    r2: number;
    mae: number;
    rmse: number;
  };
}

/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */

const BASE_URL: string = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const DEFAULT_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "validation"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Field-level messages keyed by feature name (validation errors only). */
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    kind: ApiErrorKind,
    options: { status?: number; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

interface ValidationItem {
  loc?: unknown;
  msg?: unknown;
}

function isValidationItem(item: unknown): item is ValidationItem {
  return typeof item === "object" && item !== null;
}

/** Parses FastAPI's error body into a readable message + per-field map. */
function parseErrorBody(body: unknown, status: number): ApiError {
  const fallback = `Request failed (${status})`;
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    const parts: string[] = [];

    for (const item of detail) {
      if (!isValidationItem(item)) continue;

      const msg = typeof item.msg === "string" ? item.msg : "Invalid value";
      const field = Array.isArray(item.loc)
        ? item.loc.slice(1).join(".")
        : "";

      // Keep the first message per field so the form shows one clear error.
      if (field && !(field in fieldErrors)) fieldErrors[field] = msg;
      parts.push(field ? `${field}: ${msg}` : msg);
    }

    return new ApiError(parts.join("; ") || fallback, "validation", {
      status,
      fieldErrors,
    });
  }

  if (typeof detail === "string") {
    return new ApiError(detail, status >= 500 ? "server" : "unknown", {
      status,
    });
  }

  return new ApiError(fallback, status >= 500 ? "server" : "unknown", {
    status,
  });
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/* -------------------------------------------------------------------------- */
/*  Core request helper                                                        */
/* -------------------------------------------------------------------------- */

interface RequestOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  /** Optional caller-provided signal (e.g. to cancel on component unmount). */
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, headers, ...init } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Forward caller cancellation. If the caller's signal is already aborted,
  // an "abort" listener would never fire, so cancel immediately.
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      throw parseErrorBody(body, res.status);
    }

    // A successful status with an unreadable body is a server problem,
    // not a network problem, so report it accurately.
    try {
      return (await res.json()) as T;
    } catch (parseError) {
      if (isAbortError(parseError)) throw parseError;
      throw new ApiError(
        "The server returned an unreadable response.",
        "server",
        { status: res.status },
      );
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;

    if (isAbortError(err)) {
      if (timedOut) {
        throw new ApiError(
          "The request timed out. Please try again.",
          "timeout",
        );
      }
      throw err; // cancelled by the caller; let them handle it silently
    }

    throw new ApiError(
      "Can't reach the API. Start it with: uvicorn main:app --reload",
      "network",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const fetchHealth = (signal?: AbortSignal) =>
  request<Health>("/health", { signal });

export const predict = (features: SalaryFeatures, signal?: AbortSignal) =>
  request<SalaryResponse>("/predict", {
    method: "POST",
    body: JSON.stringify(features),
    signal,
  });

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Formats a prediction, e.g. "$85,400" or "PKR 1,200,000". Falls back gracefully. */
export function formatSalary({
  predicted_salary,
  currency,
}: SalaryResponse): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(predicted_salary);
  } catch {
    return `${currency} ${Math.round(predicted_salary).toLocaleString()}`;
  }
}

/* -------------------------------------------------------------------------- */
/*  Model evaluation and actual-vs-predicted chart                            */
/* -------------------------------------------------------------------------- */

/**
 * Fetch actual-vs-predicted values from the held-out test set.
 * Matches GET /evaluate in main.py.
 */
export const fetchEvaluation = (signal?: AbortSignal) =>
  request<Evaluation>("/evaluate", { signal });

/**
 * Predict salary using the model currently exposed by main.py.
 * Matches POST /predict in main.py.
 *
 * NOTE: This is the standard model, not a separate linear regression model.
 */
export const predictLinear = (
  features: SalaryFeatures,
  signal?: AbortSignal,
) =>
  request<SalaryResponse>("/predict", {
    method: "POST",
    body: JSON.stringify(features),
    signal,
  });