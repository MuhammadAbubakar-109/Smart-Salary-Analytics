import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  ApiError,
  fetchHealth,
  predict,
  type Health,
  type SalaryFeatures,
} from "./api";
import { CITY_REGION, OPTIONS } from "./options";

type Key = keyof SalaryFeatures;

type Field =
  | { kind: "select"; key: Key; label: string }
  | { kind: "number"; key: Key; label: string; min: number; max: number; step: number };

const sel = (key: Key, label: string): Field => ({ kind: "select", key, label });
const num = (key: Key, label: string, min: number, max: number, step = 1): Field => ({
  kind: "number", key, label, min, max, step,
});

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Role",
    fields: [
      sel("Job_Title", "Job title"),
      sel("Job_Family", "Job family"),
      sel("Job_Level", "Level"),
      sel("Department", "Department"),
      sel("Industry", "Industry"),
    ],
  },
  {
    title: "Experience",
    fields: [
      num("Experience_Years", "Total experience (years)", 0, 40, 0.5),
      num("Industry_Experience_Years", "In this industry (years)", 0, 40, 0.5),
      num("Years_at_Company", "At this company (years)", 0, 40, 0.5),
      num("Years_in_Current_Role", "In current role (years)", 0, 40, 0.5),
    ],
  },
  {
    title: "Education and skills",
    fields: [
      sel("Education_Level", "Education"),
      sel("Field_of_Study", "Field of study"),
      num("Certifications_Count", "Certifications", 0, 20),
      num("Technical_Skills_Count", "Technical skills", 0, 30),
    ],
  },
  {
    title: "Management",
    fields: [
      sel("Management_Responsibility", "Manages people"),
      num("Team_Size_Managed", "Team size managed", 0, 500),
    ],
  },
  {
    title: "Employer",
    fields: [
      sel("Company_Type", "Company type"),
      sel("Company_Size", "Company size"),
      num("Employee_Count", "Employees at company", 1, 100000),
    ],
  },
  {
    title: "Work arrangement",
    fields: [
      sel("City", "City"),
      sel("Employment_Type", "Employment type"),
      sel("Remote_Work_Type", "Work location"),
      num("Working_Hours_Per_Week", "Hours per week", 0, 80),
    ],
  },
  {
    title: "Evaluation and economy",
    fields: [
      num("Performance_Rating", "Performance rating (1–5)", 0, 5, 0.1),
      num("Job_Grade", "Job grade", 0, 20),
      num("Inflation_Rate", "Inflation rate (%)", 0, 50, 0.1),
      num("Year", "Year", 2000, 2030),
    ],
  },
];

const pickFirst = (key: string) => OPTIONS[key][0];

export const INITIAL: SalaryFeatures = {
  Experience_Years: 5,
  Industry_Experience_Years: 3,
  Years_in_Current_Role: 2,
  Years_at_Company: 3,
  Certifications_Count: 1,
  Technical_Skills_Count: 5,
  Team_Size_Managed: 0,
  Employee_Count: 500,
  Working_Hours_Per_Week: 40,
  Performance_Rating: 3.5,
  Job_Grade: 5,
  Inflation_Rate: 9.8,
  Year: 2026,
  Job_Title: pickFirst("Job_Title"),
  Job_Family: pickFirst("Job_Family"),
  Job_Level: "Mid-level",
  Department: pickFirst("Department"),
  Industry: pickFirst("Industry"),
  Education_Level: "Bachelor's",
  Field_of_Study: pickFirst("Field_of_Study"),
  Management_Responsibility: "No",
  Company_Size: "Medium",
  Company_Type: "Private Limited",
  Country: "Pakistan",
  Region: CITY_REGION["Islamabad"],
  City: "Islamabad",
  Employment_Type: "Full-time",
  Remote_Work_Type: "On-site",
  Currency: "PKR",
};

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

const FORM_ID = "salary-form";

function SubmitButton({
  className,
  loading,
  disabled,
}: {
  className: string;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      form={FORM_ID}
      className={className}
      disabled={disabled}
      aria-busy={loading}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {loading ? "Estimating…" : "Estimate salary"}
    </button>
  );
}

interface Props {
  form: SalaryFeatures;
  setForm: Dispatch<SetStateAction<SalaryFeatures>>;
  salary: number | null;
  setSalary: Dispatch<SetStateAction<number | null>>;
}

export default function PredictPage({ form, setForm, salary, setSalary }: Props) {
  const [health, setHealth] = useState<Health | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resultTick, setResultTick] = useState(0);

  const resultRef = useRef<HTMLElement>(null);

  // Check the API. Aborted on unmount so a cancelled request is never
  // mistaken for "API offline" (React StrictMode mounts effects twice).
  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then((result) => {
        setHealth(result);
        setApiDown(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setApiDown(true);
      });

    return () => controller.abort();
  }, [healthAttempt]);

  // On single-column layouts the result sits above the form, so bring it
  // into view after each successful estimate.
  useEffect(() => {
    if (resultTick === 0) return;
    if (!window.matchMedia("(max-width: 960px)").matches) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    resultRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [resultTick]);

  function setValue(key: Key, raw: string, isNumber: boolean) {
    setForm((f) => {
      const next = { ...f, [key]: isNumber ? (raw === "" ? NaN : Number(raw)) : raw };
      if (key === "City") next.Region = CITY_REGION[raw] ?? f.Region;
      return next;
    });

    // Clear the server message for a field once the user edits it.
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await predict(form);
      setSalary(res.predicted_salary);
      setResultTick((tick) => tick + 1);
    } catch (err) {
      setSalary(null);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const status = apiDown ? "down" : health?.model_loaded ? "up" : "wait";
  const statusText = {
    up: `Model ready · ${health?.features_expected} features`,
    down: "API offline",
    wait: "Connecting…",
  }[status];

  const submitDisabled = loading || apiDown;

  return (
    <div className="shell">
      <form id={FORM_ID} className="form" onSubmit={onSubmit}>
        <header>
          <h1>What should this job pay?</h1>
          <p>Describe the employee and role. The model estimates a monthly salary in Pakistani rupees.</p>
        </header>

        {GROUPS.map((g) => (
          <fieldset key={g.title}>
            <legend>{g.title}</legend>
            <div className="grid">
              {g.fields.map((f) => {
                const fieldError = fieldErrors[f.key];
                const errorId = `${f.key}-error`;

                return (
                  <label key={f.key}>
                    <span>{f.label}</span>
                    {f.kind === "select" ? (
                      <select
                        value={form[f.key] as string}
                        onChange={(e) => setValue(f.key, e.target.value, false)}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? errorId : undefined}
                      >
                        {OPTIONS[f.key].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        inputMode="decimal"
                        required
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={Number.isNaN(form[f.key]) ? "" : (form[f.key] as number)}
                        onChange={(e) => setValue(f.key, e.target.value, true)}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? errorId : undefined}
                      />
                    )}
                    {fieldError && (
                      <small className="field-error" id={errorId}>
                        {fieldError}
                      </small>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <SubmitButton
          className="submit mobile-only"
          loading={loading}
          disabled={submitDisabled}
        />
      </form>

      <aside className="result" ref={resultRef} aria-label="Salary estimate">
        <div className={`status ${status}`} role="status">
          <i aria-hidden="true" /> {statusText}
        </div>

        {apiDown && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setApiDown(false);
              setHealthAttempt((n) => n + 1);
            }}
          >
            Retry connection
          </button>
        )}

        <div
          className={`estimate${loading && salary !== null ? " is-loading" : ""}`}
          aria-live="polite"
          aria-busy={loading}
        >
          {salary !== null ? (
            <div className="figure">
              <p className="label">Estimated monthly salary</p>
              <p className="amount">
                <small>PKR</small>
                {pkr.format(salary)}
              </p>
              <p className="annual">≈ PKR {pkr.format(salary * 12)} per year</p>
              <p className="meta">
                {form.Job_Title} · {form.Job_Level} · {form.City}
              </p>
              <a className="link" href="#/analysis">Compare with linear regression →</a>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty">
                Fill in the details and select <b>Estimate salary</b> to see a prediction.
              </p>
            </div>
          )}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <SubmitButton
          className="submit desktop-only"
          loading={loading}
          disabled={submitDisabled}
        />
      </aside>
    </div>
  );
}