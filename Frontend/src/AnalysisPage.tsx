import { useEffect, useMemo, useState } from "react";
import {
  fetchEvaluation,
  predictLinear,
  type Evaluation,
  type SalaryFeatures,
} from "./api";

const pkr = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type Point = Evaluation["points"][number];

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatPkr = (value: number): string =>
  isNum(value) ? `PKR ${pkr.format(value)}` : "N/A";

/** Min and max without spreading (spreading huge arrays can overflow the stack). */
function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }

  if (min > max) [min, max] = [max, min];

  // Avoid a zero-width chart domain.
  if (min === max) {
    const padding = Math.abs(min) * 0.1 || 1;
    min -= padding;
    max += padding;
  }

  const raw = (max - min) / Math.max(count, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));

  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * magnitude)
      .find((candidate) => candidate >= raw) ?? raw;

  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const numberOfTicks = Math.min(
    100,
    Math.max(2, Math.round((last - first) / step) + 1),
  );

  return Array.from(
    { length: numberOfTicks },
    (_, index) => first + index * step,
  );
}

/** Ordinary least squares: predicted = slope * actual + intercept. */
function fitLine(points: Point[]) {
  if (points.length === 0) {
    return { slope: 1, intercept: 0 };
  }

  const n = points.length;
  const meanActual = points.reduce((sum, p) => sum + p.actual, 0) / n;
  const meanPredicted = points.reduce((sum, p) => sum + p.predicted, 0) / n;

  let covariance = 0;
  let variance = 0;

  for (const point of points) {
    covariance +=
      (point.actual - meanActual) * (point.predicted - meanPredicted);
    variance += (point.actual - meanActual) ** 2;
  }

  const slope = variance > 0 ? covariance / variance : 0;
  const intercept = meanPredicted - slope * meanActual;

  return { slope, intercept };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function Chart({
  data,
  marker,
}: {
  data: Evaluation;
  marker: number | null;
}) {
  const points = useMemo(
    () =>
      data.points.filter(
        (point) => isNum(point.actual) && isNum(point.predicted),
      ),
    [data.points],
  );

  const chart = useMemo(() => {
    const values = points.flatMap((point) => [point.actual, point.predicted]);

    if (marker !== null && isNum(marker)) {
      values.push(marker);
    }

    if (values.length === 0) values.push(0, 1);

    let [min, max] = extent(values);

    // Include zero-width domains safely.
    if (min === max) {
      const pad = Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad;
    }

    const pad = (max - min) * 0.04;
    min -= pad;
    max += pad;

    const ticks = niceTicks(min, max, 5);
    const domainMin = ticks[0];
    const domainMax = ticks[ticks.length - 1];
    const domainSize = domainMax - domainMin || 1;

    // Responsive SVG viewBox coordinates.
    const W = 760;
    const H = 500;
    const M = { t: 28, r: 28, b: 82, l: 88 };

    const x = (value: number) =>
      M.l + ((value - domainMin) / domainSize) * (W - M.l - M.r);

    const y = (value: number) =>
      H - M.b - ((value - domainMin) / domainSize) * (H - M.t - M.b);

    return {
      W,
      H,
      M,
      ticks,
      domainMin,
      domainMax,
      x,
      y,
      fit: fitLine(points),
    };
  }, [points, marker]);

  const { W, H, M, ticks, domainMin, domainMax, x, y, fit } = chart;

  const trendY = (value: number) =>
    Math.min(Math.max(fit.slope * value + fit.intercept, domainMin), domainMax);

  const validMarker = marker !== null && isNum(marker) ? marker : null;

  const r2Text = isNum(data.metrics.r2)
    ? data.metrics.r2.toFixed(3)
    : "unavailable";

  return (
    <div className="chart-wrap">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Actual versus predicted monthly salary for ${points.length} test employees. R squared ${r2Text}.`}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={M.l}
              x2={W - M.r}
              y1={y(tick)}
              y2={y(tick)}
            />

            <line
              className="grid-line"
              x1={x(tick)}
              x2={x(tick)}
              y1={M.t}
              y2={H - M.b}
            />

            <text
              className="tick"
              x={M.l - 12}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {compact.format(tick)}
            </text>

            <text
              className="tick"
              x={x(tick)}
              y={H - M.b + 22}
              textAnchor="middle"
            >
              {compact.format(tick)}
            </text>
          </g>
        ))}

        <line className="axis-line" x1={M.l} y1={M.t} x2={M.l} y2={H - M.b} />

        <line
          className="axis-line"
          x1={M.l}
          y1={H - M.b}
          x2={W - M.r}
          y2={H - M.b}
        />

        <text
          className="axis-title"
          x={(M.l + W - M.r) / 2}
          y={H - 24}
          textAnchor="middle"
        >
          Actual monthly salary
        </text>

        <text
          className="axis-title"
          transform={`translate(23 ${(M.t + H - M.b) / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          Predicted monthly salary
        </text>

        {/* Perfect predictions: actual equals predicted. */}
        <line
          className="ideal"
          x1={x(domainMin)}
          y1={y(domainMin)}
          x2={x(domainMax)}
          y2={y(domainMax)}
        />

        {points.map((point, index) => (
          <circle
            key={`${point.actual}-${point.predicted}-${index}`}
            className="pt"
            cx={x(point.actual)}
            cy={y(point.predicted)}
            r={points.length > 1000 ? 2 : 3.5}
          >
            <title>
              {`Actual ${pkr.format(point.actual)} · Predicted ${pkr.format(point.predicted)}`}
            </title>
          </circle>
        ))}

        {points.length > 1 && (
          <line
            className="trend"
            x1={x(domainMin)}
            y1={y(trendY(domainMin))}
            x2={x(domainMax)}
            y2={y(trendY(domainMax))}
          />
        )}

        {validMarker !== null &&
          validMarker >= domainMin &&
          validMarker <= domainMax && (
            <g>
              <line
                className="marker"
                x1={M.l}
                x2={W - M.r}
                y1={y(validMarker)}
                y2={y(validMarker)}
              />

              <text
                className="marker-label"
                x={W - M.r - 6}
                y={y(validMarker) - 8}
                textAnchor="end"
              >
                Current prediction
              </text>
            </g>
          )}
      </svg>
    </div>
  );
}

interface Props {
  form: SalaryFeatures;
  forestSalary: number | null;
}

export default function AnalysisPage({ form, forestSalary }: Props) {
  const [data, setData] = useState<Evaluation | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [linear, setLinear] = useState<number | null>(null);
  const [linearError, setLinearError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingLinear, setLoadingLinear] = useState(true);

  // Bumped by the "Try again" buttons to re-run a failed request.
  const [dataAttempt, setDataAttempt] = useState(0);
  const [linearAttempt, setLinearAttempt] = useState(0);

  // Load the evaluation dataset when this page mounts (or on retry).
  useEffect(() => {
    let cancelled = false;

    setLoadingData(true);
    setDataError(null);

    fetchEvaluation()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setDataError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setData(null);
          setDataError(errorMessage(error, "Unable to load evaluation data."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataAttempt]);

  // Recalculate the linear regression estimate whenever the inputs change.
  useEffect(() => {
    let cancelled = false;

    setLinear(null);
    setLinearError(null);
    setLoadingLinear(true);

    predictLinear(form)
      .then((result) => {
        if (!isNum(result.predicted_salary)) {
          throw new Error("The model returned an invalid salary estimate.");
        }

        if (!cancelled) {
          setLinear(result.predicted_salary);
          setLinearError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLinear(null);
          setLinearError(
            errorMessage(
              error,
              "Unable to calculate the linear regression prediction.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLinear(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form, linearAttempt]);

  return (
    <main className="page" id="main">
      <header>
        <h1>Linear regression: actual vs predicted</h1>
        <p>
          Each dot represents an employee in the test dataset that was held out
          from model training. The closer the dots are to the diagonal, the
          closer the predictions are to the actual salaries.
        </p>
      </header>

      <div className="analysis">
        <section
          className="panel"
          aria-label="Model evaluation chart"
          aria-busy={loadingData}
        >
          {data ? (
            <>
              <Chart data={data} marker={linear} />

              <ul className="legend">
                <li>
                  <i className="sw pt" aria-hidden="true" />
                  Employees ({data.points.length} of {data.n_test} shown)
                </li>

                <li>
                  <i className="sw ideal" aria-hidden="true" />
                  Perfect prediction
                </li>

                <li>
                  <i className="sw trend" aria-hidden="true" />
                  Fitted trend of predictions
                </li>

                {linear !== null && (
                  <li>
                    <i className="sw marker" aria-hidden="true" />
                    Your predicted value
                  </li>
                )}
              </ul>

              <dl className="metrics">
                <div>
                  <dt>R²</dt>
                  <dd>
                    {isNum(data.metrics.r2) ? data.metrics.r2.toFixed(3) : "N/A"}
                  </dd>
                </div>

                <div>
                  <dt>Mean absolute error</dt>
                  <dd>{formatPkr(data.metrics.mae)}</dd>
                </div>

                <div>
                  <dt>RMSE</dt>
                  <dd>{formatPkr(data.metrics.rmse)}</dd>
                </div>

                <div>
                  <dt>Test employees</dt>
                  <dd>{pkr.format(data.n_test)}</dd>
                </div>
              </dl>
            </>
          ) : dataError ? (
            <div className="state-block">
              <p className="error" role="alert">
                {dataError}
              </p>
              {/* Retries the request in place, so the Estimator form inputs
                  held in the parent are not lost (a page reload would lose them). */}
              <button
                type="button"
                className="ghost"
                onClick={() => setDataAttempt((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="empty" role="status">
              {loadingData
                ? "Loading evaluation chart…"
                : "No evaluation data available."}
            </p>
          )}
        </section>

        <aside className="result card" aria-live="polite">
          <p className="label">Predicted monthly salary</p>

          {linear !== null ? (
            <>
              <p className="amount">
                <small>PKR · linear regression</small>
                {pkr.format(linear)}
              </p>

              <p className="annual">≈ PKR {pkr.format(linear * 12)} per year</p>

              {forestSalary !== null && isNum(forestSalary) && (
                <p className="meta">
                  Random forest (Estimator page): PKR {pkr.format(forestSalary)}
                </p>
              )}

              <p className="empty">
                Based on the inputs currently in the Estimator form.{" "}
                <a className="link" href="#/">
                  Change inputs
                </a>
              </p>
            </>
          ) : linearError ? (
            <div className="state-block">
              <p className="error" role="alert">
                {linearError}
              </p>
              <button
                type="button"
                className="ghost"
                onClick={() => setLinearAttempt((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="empty" role="status">
              {loadingLinear
                ? "Calculating linear regression estimate…"
                : "No prediction available."}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}