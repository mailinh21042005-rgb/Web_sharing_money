import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    hodem: "", tenlot: "", ten: "", username: "", email: "", dienthoai: "", password: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Đăng ký thành công! Đang chuyển hướng về trang Đăng nhập...");
        navigate("/login");
      } else {
        setError(data.error || "Đã xảy ra lỗi khi đăng ký.");
      }
    } catch (err) {
      setError("Không thể kết nối đến máy chủ!");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12">
      <div className="w-full max-w-lg rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl text-[var(--primary-text)]">
            ✦
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Tạo tài khoản mới</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Điền thông tin để tham gia Share Money</p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-xl bg-red-100 p-3 text-sm text-center text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Họ</label>
              <input type="text" name="hodem" value={formData.hodem} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Tên lót</label>
              <input type="text" name="tenlot" value={formData.tenlot} onChange={handleChange} className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Tên</label>
              <input type="text" name="ten" value={formData.ten} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Tên đăng nhập</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Số điện thoại</label>
              <input type="text" name="dienthoai" value={formData.dienthoai} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Mật khẩu</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-2.5 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
          </div>

          <button type="submit" className="mt-4 rounded-full bg-[var(--button-primary)] py-3.5 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]">
            Đăng ký tài khoản
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Đã có tài khoản? <Link to="/login" className="font-semibold text-[var(--primary)] hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;