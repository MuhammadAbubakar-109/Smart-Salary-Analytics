
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { SalaryFeatures } from "./api";
import AnalysisPage from "./AnalysisPage";
import PredictPage, { INITIAL } from "./PredictPage";
import ThemeToggle from "./ThemeToggle";

type Page = "analysis" | "estimator";

const PAGE_TITLES: Record<Page, string> = {
  estimator: "Salary Estimator",
  analysis: "Linear Regression · Salary Estimator",
};

function getCurrentPage(): Page {
  if (typeof window === "undefined") {
    return "estimator";
  }

  return window.location.hash.startsWith("#/analysis")
    ? "analysis"
    : "estimator";
}

export default function App() {
  // Shared state keeps the prediction synchronized between pages.
  const [form, setForm] = useState<SalaryFeatures>(INITIAL);
  const [salary, setSalary] = useState<number | null>(null);
  const [page, setPage] = useState<Page>(getCurrentPage);

  const mainRef = useRef<HTMLElement>(null);

  // Synchronize the selected page with browser hash navigation.
  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getCurrentPage();

      setPage(nextPage);
      window.scrollTo({ top: 0, behavior: "auto" });

      // Focus the new page content for keyboard and screen-reader users.
      mainRef.current?.focus({ preventScroll: true });
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  // Update the browser tab title when the page changes.
  useEffect(() => {
    document.title = PAGE_TITLES[page];
  }, [page]);

  // Keep the skip link from changing the application's hash route.
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  const renderLink = (id: Page, href: string, label: string) => (
    <a
      key={id}
      href={href}
      aria-current={page === id ? "page" : undefined}
    >
      {label}
    </a>
  );

  return (
    <>
      <a className="skip-link" href="#main" onClick={skipToContent}>
        Skip to content
      </a>

      <nav className="topbar" aria-label="Main navigation">
        <div className="topbar-inner">
          <span className="brand">Salary Estimator</span>

          <div className="nav-links">
            {renderLink("estimator", "#/", "Estimator")}
            {renderLink("analysis", "#/analysis", "Linear Regression")}
          </div>

          <div className="topbar-spacer" />

          <ThemeToggle />
        </div>
      </nav>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        aria-label={PAGE_TITLES[page]}
      >
        {page === "analysis" ? (
          <AnalysisPage form={form} forestSalary={salary} />
        ) : (
          <PredictPage
            form={form}
            setForm={setForm}
            salary={salary}
            setSalary={setSalary}
          />
        )}
      </main>
    </>
  );
}
