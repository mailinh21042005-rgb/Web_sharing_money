import { Link } from "react-router-dom";

function ForgotPassword() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">
          Quên mật khẩu
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Tính năng khôi phục mật khẩu hiện tạm thời không khả dụng.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Quay lại Đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
