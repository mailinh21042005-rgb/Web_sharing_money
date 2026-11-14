import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    hodem: "",
    tenlot: "",
    ten: "",
    username: "",
    email: "",
    dienthoai: "",
    password: "",
  });
  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "dienthoai") {
      value = value.replace(/\D/g, "");
    }
    setFormData((currentFormData) => ({
      ...currentFormData,
      [e.target.name]: value,
    }));
  };

  const passwordIsValid = /^(?=.*[A-Za-z])(?=.*\d).{9,}$/.test(
    formData.password,
  );
  const registerFormIsValid =
    formData.hodem.trim() !== "" &&
    formData.hodem.length <= 20 &&
    formData.tenlot.trim() !== "" &&
    formData.tenlot.length <= 20 &&
    formData.ten.trim() !== "" &&
    formData.ten.length <= 10 &&
    formData.username.trim() !== "" &&
    formData.username.length <= 50 &&
    formData.email.trim() !== "" &&
    formData.dienthoai.length === 10 &&
    passwordIsValid;

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    if (!registerFormIsValid) {
      setError("Vui lòng điền đầy đủ và chính xác tất cả thông tin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const checkRes = await fetch("https://web-sharing-money.onrender.com/api/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          dienthoai: formData.dienthoai,
        }),
      });
      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.error || "Dữ liệu đã tồn tại.");
        return;
      }

      const response = await fetch("https://web-sharing-money.onrender.com/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (response.ok) {
        alert("Đăng ký thành công! Đang chuyển hướng về trang Đăng nhập...");
        navigate("/login");
      } else {
        setError(data.error || "Tài khoản đã tồn tại hoặc lỗi hệ thống.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12">
      <div className="w-full max-w-lg rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl text-[var(--primary-text)]">
            ✦
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">
            Tạo tài khoản mới
          </h2>
        </div>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-xl bg-red-100 p-3 text-center text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                Họ
              </label>
              <input
                type="text"
                name="hodem"
                maxLength={20}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                Tên lót
              </label>
              <input
                type="text"
                name="tenlot"
                maxLength={20}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                Tên
              </label>
              <input
                type="text"
                name="ten"
                maxLength={10}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">
              Tên đăng nhập
            </label>
            <input
              type="text"
              name="username"
              maxLength={50}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                Email
              </label>
              <input
                type="text"
                name="email"
                maxLength={50}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                Số điện thoại
              </label>
              <input
                type="text"
                name="dienthoai"
                value={formData.dienthoai}
                inputMode="numeric"
                maxLength={10}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">
              Mật khẩu
            </label>
            <input
              type="password"
              name="password"
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={!registerFormIsValid || isSubmitting}
            className="mt-4 rounded-full bg-[var(--button-primary)] py-3.5 text-sm font-semibold text-[var(--button-primary-text)] transition enabled:hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </div>

    </div>
  );
}

export default Register;