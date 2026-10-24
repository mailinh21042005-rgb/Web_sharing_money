import ThemeToggle from "./ThemeToggle";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function Navbar() {
  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  });
  const navigate = useNavigate();

  const userName = user?.ten || "";
  const isLoggedIn = Boolean(user);

  // Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  // Avatar mặc định
  const avatarLetter = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <nav className="flex items-center justify-between px-6 py-5 lg:px-10">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 transition hover:opacity-80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-lg text-[var(--primary-text)]">
            ✦
          </div>

          <span className="text-xl font-semibold tracking-tight text-[var(--primary)]">
            Share Money
          </span>
        </div>
      </Link>

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

        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--avatar-background)] font-semibold text-[var(--avatar-text)]">
              {avatarLetter}
            </div>
            <span className="hidden text-sm font-medium text-[var(--text)] sm:block">
              {userName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 shadow-md transition hover:bg-red-100"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-sm font-medium text-[var(--text)] transition hover:opacity-80"
            >
              Đăng ký
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-text)] transition hover:opacity-80"
            >
              Đăng nhập
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;