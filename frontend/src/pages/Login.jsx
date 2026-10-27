import { useState } from "react";
import { Link } from "react-router-dom";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        alert("Đăng nhập thành công!");
        window.location.href = "/"; 
      } else {
        setError(data.error); 
      }
    } catch {
      setError("Không tìm thấy tài khoản!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl text-[var(--primary-text)]">
            ✦
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Chào mừng trở lại</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Đăng nhập để quản lý chi tiêu</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-xl bg-red-100 p-3 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="Nhập username..."
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <div className="mt-2 text-right">
              <Link to="/forgot-password" className="text-sm font-medium text-[var(--primary)] hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || isSubmitting}
            className="mt-2 rounded-full bg-[var(--button-primary)] py-3.5 text-sm font-semibold text-[var(--button-primary-text)] transition enabled:hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          Đăng ký ngay
        </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;