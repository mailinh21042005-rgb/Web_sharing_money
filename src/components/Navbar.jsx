import ThemeToggle from "./ThemeToggle";

function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-5 lg:px-10">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-lg text-[var(--primary-text)]">
          ✦
        </div>

        <span className="text-xl font-semibold tracking-tight text-[var(--primary)]">
          Share Money
        </span>
      </div>

      {/* Navigation */}
      <div className="hidden items-center gap-8 md:flex">
        <a
          href="#"
          className="text-sm font-semibold text-[var(--primary)] transition hover:opacity-80"
        >
          Tổng quan
        </a>

        <a
          href="#"
          className="text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)]"
        >
          Nhóm của tôi
        </a>

        <a
          href="#"
          className="text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)]"
        >
          Lịch sử
        </a>
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--avatar-background)] font-semibold text-[var(--avatar-text)]">
          L
        </div>

        <span className="hidden text-sm font-medium text-[var(--text)] sm:block">
          Linh
        </span>
      </div>
    </nav>
  );
}

export default Navbar;