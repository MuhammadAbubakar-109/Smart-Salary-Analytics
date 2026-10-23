
import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "salary-estimator-theme";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function getInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const appliedTheme = document.documentElement.dataset.theme;

    if (isTheme(appliedTheme)) {
      return appliedTheme;
    }
  }

  if (typeof window !== "undefined") {
    try {
      const savedTheme = window.localStorage.getItem(STORAGE_KEY);

      if (isTheme(savedTheme)) {
        return savedTheme;
      }
    } catch {
      // Local storage may be unavailable.
    }
  }

  return "light";
}

function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme switching still works without local storage.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  }, []);

  const isDark = theme === "dark";
  const label = isDark
    ? "Switch to light theme"
    : "Switch to dark theme";

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l-1.41 1.41M17.66 6.34l-1.41 1.41" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        )}
      </svg>
    </button>
  );
}
