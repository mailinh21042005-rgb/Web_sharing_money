import { useEffect, useState } from "react";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((prev) => !prev)}
      aria-label={
        isDark
          ? "Chuyển sang chế độ sáng"
          : "Chuyển sang chế độ tối"
      }
      className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--button-secondary)] text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

export default ThemeToggle;