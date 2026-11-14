import { useEffect, useState } from "react";

const API_URL = "https://web-sharing-money.onrender.com/api/users/profile";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const emptyProfile = {
  ten: "",
  soDienThoai: "",
  diaChi: "",
  isDiaChiPublic: false,
  soTaiKhoan: "",
  isSoTaiKhoanPublic: false,
  nganHang: "",
  isNganHangPublic: false,
  avatar: "",
};

function Profile() {
  const [formData, setFormData] = useState(emptyProfile);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(API_URL, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Không thể tải thông tin cá nhân.");
        }

        setFormData({ ...emptyProfile, ...data });
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(loadError.message || "Không thể tải thông tin cá nhân.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const avatarUrl = formData.avatar;
    if (!avatarUrl.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(avatarUrl);
  }, [formData.avatar]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
    setSuccess("");
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một tệp hình ảnh.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Ảnh đại diện không được vượt quá 2 MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setFormData((current) => ({
      ...current,
      avatar: URL.createObjectURL(file),
    }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const body = new FormData();
      body.append("ten", formData.ten.trim());
      body.append("soDienThoai", formData.soDienThoai.trim());
      body.append("diaChi", formData.diaChi.trim());
      body.append("isDiaChiPublic", String(formData.isDiaChiPublic));
      body.append("soTaiKhoan", formData.soTaiKhoan.trim());
      body.append("isSoTaiKhoanPublic", String(formData.isSoTaiKhoanPublic));
      body.append("nganHang", formData.nganHang.trim());
      body.append("isNganHangPublic", String(formData.isNganHangPublic));
      if (avatarFile) body.append("avatar", avatarFile);

      const response = await fetch(API_URL, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể lưu thông tin cá nhân.");
      }

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          ten: formData.ten.trim(),
          dienthoai: formData.soDienThoai.trim(),
        }),
      );
      if (data.avatar) {
        setFormData((current) => ({ ...current, avatar: data.avatar }));
      }
      setAvatarFile(null);
      setSuccess("Đã lưu thông tin cá nhân.");
    } catch (saveError) {
      setError(saveError.message || "Không thể lưu thông tin cá nhân.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]";
  const checkbox = (name, checked, label) => (
    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={handleChange}
      />
      {label}
    </label>
  );

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md">
      <h2 className="mb-6 text-2xl font-bold text-[var(--text)]">
        Thông tin cá nhân
      </h2>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700">
          {success}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Đang tải thông tin...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-soft)] text-3xl text-[var(--text-muted)]">
              {formData.avatar ? (
                <img
                  src={formData.avatar}
                  alt="Ảnh đại diện"
                  className="h-full w-full object-cover"
                />
              ) : (
                "👤"
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)]">
                Ảnh đại diện
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="mt-2 block max-w-full text-sm text-[var(--text)]"
                  disabled={isSaving}
                />
              </label>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Tối đa 2 MB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text)]">
              Tên
              <input
                type="text"
                name="ten"
                value={formData.ten}
                onChange={handleChange}
                maxLength={10}
                required
                className={inputClass}
                disabled={isSaving}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--text)]">
              Số điện thoại
              <input
                type="tel"
                name="soDienThoai"
                value={formData.soDienThoai}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
                required
                className={inputClass}
                disabled={isSaving}
              />
            </label>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="diaChi"
                className="text-sm font-medium text-[var(--text)]"
              >
                Địa chỉ
              </label>
              {checkbox("isDiaChiPublic", formData.isDiaChiPublic, "Công khai")}
            </div>
            <input
              id="diaChi"
              type="text"
              name="diaChi"
              value={formData.diaChi}
              onChange={handleChange}
              maxLength={255}
              className={inputClass}
              placeholder="Ví dụ: TP.HCM"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--border)] p-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="nganHang"
                  className="text-sm font-medium text-[var(--text)]"
                >
                  Ngân hàng/Momo
                </label>
                {checkbox(
                  "isNganHangPublic",
                  formData.isNganHangPublic,
                  "Công khai",
                )}
              </div>
              <input
                id="nganHang"
                type="text"
                name="nganHang"
                value={formData.nganHang}
                onChange={handleChange}
                maxLength={100}
                className={inputClass}
                placeholder="Ví dụ: Vietcombank"
                disabled={isSaving}
              />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="soTaiKhoan"
                  className="text-sm font-medium text-[var(--text)]"
                >
                  Số tài khoản
                </label>
                {checkbox(
                  "isSoTaiKhoanPublic",
                  formData.isSoTaiKhoanPublic,
                  "Công khai",
                )}
              </div>
              <input
                id="soTaiKhoan"
                type="text"
                name="soTaiKhoan"
                value={formData.soTaiKhoan}
                onChange={handleChange}
                maxLength={50}
                className={inputClass}
                disabled={isSaving}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-md bg-[var(--primary)] py-2 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}
    </div>
  );
}

export default Profile;