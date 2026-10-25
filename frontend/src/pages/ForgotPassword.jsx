import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" }
    );
    return () => {
      window.recaptchaVerifier?.clear();
      delete window.recaptchaVerifier;
    };
  }, []);

  // Kiểm tra SĐT và gửi OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.trim().length !== 10) return setError("Số điện thoại không hợp lệ!");
    setError("");
    setIsLoading(true);

    try {
      // Kiểm tra sđt tồn tại chưa
      const checkRes = await fetch("http://localhost:5000/api/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dienthoai: phone }),
      });
      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.error || "Lỗi hệ thống");
        setIsLoading(false);
        return;
      }

      // Có thì gửi SMS
      const formattedPhone = phone.startsWith("0") ? `+84${phone.slice(1)}` : phone;
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      
      setConfirmationResult(confirmation);
      setStep(2);
    } catch (err) {
      setError("Lỗi gửi SMS. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  // Xác thực OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError("Mã OTP phải gồm 6 số!");
    setError("");
    setIsLoading(true);

    try {
      await confirmationResult.confirm(otp);
      setStep(3); 
    } catch {
      setError("Mã OTP không chính xác hoặc đã hết hạn!");
    } finally {
      setIsLoading(false);
    }
  };

  // Đổi mật khẩu
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{9,}$/;
    if (!passwordRegex.test(newPassword)) {
      return setError("Mật khẩu phải có tối thiểu 9 ký tự, bao gồm chữ cái và số!");
    }
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dienthoai: phone, newPassword }),
      });

      if (response.ok) {
        alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
        navigate("/login");
      } else {
        setError("Lỗi cập nhật mật khẩu.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
      <div id="recaptcha-container" />
      <div className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--text)]">Quên mật khẩu</h2>
        
        {error && <div className="mb-4 rounded-xl bg-red-100 p-3 text-center text-sm text-red-600">{error}</div>}

        {step === 1 && (
          <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)]">Nhập số điện thoại đăng ký để nhận mã khôi phục.</p>
            <input type="text" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            <button type="submit" disabled={isLoading} className="mt-2 rounded-full bg-[var(--button-primary)] py-3 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]">
              {isLoading ? "Đang xử lý..." : "Gửi mã OTP"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)]">Nhập mã 6 số vừa được gửi đến <b>{phone}</b></p>
            <input type="text" placeholder="******" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required className="w-full rounded-xl border-2 border-[var(--border)] bg-transparent px-4 py-3 text-center text-2xl tracking-[0.3em] text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            <button type="submit" disabled={isLoading} className="mt-2 rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700">
              {isLoading ? "Đang xác thực..." : "Xác nhận OTP"}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)]">Tạo mật khẩu mới cho tài khoản của bạn.</p>
            <input type="password" placeholder="Mật khẩu mới" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            <button type="submit" disabled={isLoading} className="mt-2 rounded-full bg-[var(--button-primary)] py-3 text-sm font-semibold text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]">
              {isLoading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-[var(--primary)] hover:underline">Quay lại Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;