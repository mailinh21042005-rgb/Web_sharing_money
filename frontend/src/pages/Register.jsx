import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
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

  // Khởi tạo reCAPTCHA
  useEffect(() => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" },
    );

    return () => {
      window.recaptchaVerifier?.clear();
      delete window.recaptchaVerifier;
    };
  }, []);

  // Countdown
  useEffect(() => {
    let timer;
    if (showOtpModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, countdown]);

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

  // Gửi SMS OTP
  const handleSendOTP = async (event) => {
    event?.preventDefault();
    setError("");
    if (!registerFormIsValid) {
      setError("Vui lòng điền đầy đủ và chính xác tất cả thông tin.");
      return;
    }

    const phone = formData.dienthoai.trim();
    setError("");
    setSuccess("");
    setIsSending(true);

    try {
      // 1. Gọi API kiểm tra trùng lặp trước
      const checkRes = await fetch("http://localhost:5000/api/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          dienthoai: formData.dienthoai,
        }),
      });
      const checkData = await checkRes.json();

      // Nếu tồn tại thì không cho tạo
      if (!checkRes.ok) {
        setError(checkData.error || "Dữ liệu đã tồn tại.");
        return;
      }

      // Gửi SMS
      const formattedPhone = phone.startsWith("0") ? `+84${phone.slice(1)}` : phone;
      const appVerifier = window.recaptchaVerifier;

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);

      setOtp("");
      setCountdown(60);
      setShowOtpModal(true);
      setSuccess("Mã OTP đã được gửi đến số điện thoại của bạn!");
    } catch {
      setError("Không thể gửi mã. Vui lòng kiểm tra lại số điện thoại.");
    } finally {
      setIsSending(false);
    }
  };

  // Lưu vào database
  const handleVerifyOTP = async () => {
    if (!confirmationResult) {
      setError("Vui lòng yêu cầu gửi mã OTP trước!");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số!");
      return;
    }
    setError("");
    setIsVerifying(true);

    try {
      // Xác thực OTP với Firebase
      await confirmationResult.confirm(otp);
      const response = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (response.ok) {
        alert("Đăng ký thành công! Đang chuyển hướng về trang Đăng nhập...");
        setShowOtpModal(false);
        navigate("/login");
      } else {
        setError(data.error || "Tài khoản đã tồn tại hoặc lỗi hệ thống.");
      }
    } catch {
      setError("Mã OTP không chính xác hoặc đã hết hạn!");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-12">
      <div id="recaptcha-container" />
      <div className="w-full max-w-lg rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl text-[var(--primary-text)]">
            ✦
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">
            Tạo tài khoản mới
          </h2>
        </div>
        <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
          {error && !showOtpModal && (
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
            disabled={!registerFormIsValid || isSending}
            className="mt-4 rounded-full bg-[var(--button-primary)] py-3.5 text-sm font-semibold text-[var(--button-primary-text)] transition enabled:hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Đang xử lý..." : "Đăng ký"}
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

      {/* Modal / Popup OTP */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm rounded-[24px] bg-[var(--surface)] p-8 shadow-2xl">
            <h3 className="mb-2 text-center text-xl font-bold text-[var(--text)]">
              Xác thực số điện thoại
            </h3>
            <p className="mb-6 text-center text-sm text-[var(--text-muted)]">
              Nhập mã gồm 6 chữ số vừa được gửi đến <br />
              <span className="font-semibold text-[var(--text)]">
                {formData.dienthoai}
              </span>
            </p>

            {success && (
              <div className="mb-4 rounded-xl bg-green-100 p-3 text-center text-sm text-green-700">
                {success}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl bg-red-100 p-3 text-center text-sm text-red-600">
                {error}
              </div>
            )}

            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="******"
              maxLength={6}
              className="mb-6 w-full rounded-xl border-2 border-[var(--border)] focus:border-[var(--primary)] bg-transparent px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-[var(--text)] outline-none transition-colors"
            />

            <button
              onClick={handleVerifyOTP}
              disabled={isVerifying}
              className="mb-4 w-full rounded-full bg-green-600 py-3.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              {isVerifying ? "Đang xác thực..." : "Xác nhận"}
            </button>

            <div className="text-center text-sm">
              {countdown > 0 ? (
                <span className="text-[var(--text-muted)]">
                  Bạn có thể yêu cầu gửi lại mã sau{" "}
                  <strong className="text-[var(--text)]">{countdown}s</strong>
                </span>
              ) : (
                <button
                  onClick={handleSendOTP}
                  disabled={isSending}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  {isSending ? "Đang gửi..." : "Gửi lại mã OTP"}
                </button>
              )}
            </div>

            <button
              onClick={() => setShowOtpModal(false)}
              className="mt-6 w-full text-center text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
            >
              Hủy và chỉnh sửa thông tin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;