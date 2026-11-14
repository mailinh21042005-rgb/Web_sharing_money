import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

const API_URL = "https://web-sharing-money.onrender.com/api/users/profile";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      
const emptyProfile = {
  username: "",
  hoVaTen: "",
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
  const [previewAvatar, setPreviewAvatar] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(API_URL, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        
        if (!response.ok) throw new Error("Không thể tải thông tin cá nhân.");
        const data = await response.json();

        const fullNames = [data.hodem, data.tenlot, data.ten].filter(Boolean).join(" ");
        
        setFormData({
          ...emptyProfile,
          ...data,
          hoVaTen: fullNames || data.ten || ""
        });
        if (data.avatar) setPreviewAvatar(data.avatar);

      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    loadProfile();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!previewAvatar.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(previewAvatar);
  }, [previewAvatar]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleUploadClick = () => {
    if (!isEditing) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Ảnh đại diện tối đa 2MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewAvatar(objectUrl);
    setError("");
  };

  const handleToggleEdit = (e) => {
    e.preventDefault();
    if (isEditing) {
      handleSubmit(e);
    } else {
      setIsEditing(true);
      setSuccess("");
    }
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Vui lòng đăng nhập lại để lưu thông tin.");
      const body = new FormData();
      
      body.append("hoVaTen", formData.hoVaTen.trim());
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

      if (!response.ok) throw new Error(data.error || "Không thể lưu thông tin.");

      const nameParts = formData.hoVaTen.trim().split(/\s+/);
      const shortName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({
        ...user,
        ten: shortName,
        dienthoai: formData.soDienThoai.trim(),
      }));

      if (data.avatar) setPreviewAvatar(data.avatar);
      setAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Đã lưu thông tin cá nhân thành công.");
      setIsEditing(false);

    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitial = () => {
    const parts = formData.hoVaTen.trim().split(/\s+/);
    if (parts.length > 0 && parts[parts.length - 1]) {
      return parts[parts.length - 1].charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[var(--text)]">
          Thông tin cá nhân
        </h2>
        <Link
          to="/"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Về trang chủ
        </Link>
      </div>

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
        <form
          onSubmit={(event) => {
            if (isEditing) handleSubmit(event);
            else event.preventDefault();
          }}
          className="space-y-6"
        >
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={!isEditing || isSaving}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-soft)] text-3xl text-[var(--text-muted)] disabled:cursor-default"
              aria-label={isEditing ? "Chọn ảnh đại diện" : "Ảnh đại diện"}
            >
              {(previewAvatar || formData.avatar) ? (
                <img
                  src={previewAvatar || formData.avatar}
                  alt="Ảnh đại diện"
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitial()
              )}
            </button>
            <div>
              <p className="font-medium text-[var(--text)]">
                {formData.username || "Tài khoản"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {isEditing
                  ? "Nhấn vào ảnh để thay đổi (tối đa 2 MB)."
                  : "Ảnh đại diện"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                onChange={handleAvatarChange}
                disabled={!isEditing || isSaving}
                className="hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text)]">
              Họ và tên
              <input
                type="text"
                name="hoVaTen"
                value={formData.hoVaTen}
                onChange={handleChange}
                maxLength={60}
                required
                disabled={!isEditing || isSaving}
                className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] disabled:opacity-70"
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
                disabled={!isEditing || isSaving}
                className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] disabled:opacity-70"
              />
            </label>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="diaChi" className="text-sm font-medium text-[var(--text)]">
                Địa chỉ
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  name="isDiaChiPublic"
                  checked={formData.isDiaChiPublic}
                  onChange={handleChange}
                  disabled={!isEditing || isSaving}
                />
                Công khai
              </label>
            </div>
            <input
              id="diaChi"
              type="text"
              name="diaChi"
              value={formData.diaChi}
              onChange={handleChange}
              maxLength={255}
              disabled={!isEditing || isSaving}
              className="block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] disabled:opacity-70"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 rounded-lg border border-[var(--border)] p-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="nganHang" className="text-sm font-medium text-[var(--text)]">
                  Ngân hàng/Momo
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="isNganHangPublic"
                    checked={formData.isNganHangPublic}
                    onChange={handleChange}
                    disabled={!isEditing || isSaving}
                  />
                  Công khai
                </label>
              </div>
              <input
                id="nganHang"
                type="text"
                name="nganHang"
                value={formData.nganHang}
                onChange={handleChange}
                maxLength={100}
                disabled={!isEditing || isSaving}
                className="block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] disabled:opacity-70"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="soTaiKhoan" className="text-sm font-medium text-[var(--text)]">
                  Số tài khoản
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="isSoTaiKhoanPublic"
                    checked={formData.isSoTaiKhoanPublic}
                    onChange={handleChange}
                    disabled={!isEditing || isSaving}
                  />
                  Công khai
                </label>
              </div>
              <input
                id="soTaiKhoan"
                type="text"
                name="soTaiKhoan"
                value={formData.soTaiKhoan}
                onChange={handleChange}
                maxLength={50}
                disabled={!isEditing || isSaving}
                className="block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] disabled:opacity-70"
              />
            </div>
          </div>

          <button
            type={isEditing ? "submit" : "button"}
            onClick={isEditing ? undefined : handleToggleEdit}
            disabled={isSaving}
            className="w-full rounded-md bg-[var(--primary)] py-2 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Đang lưu..."
              : isEditing
                ? "Lưu thay đổi"
                : "Chỉnh sửa"}
          </button>
        </form>
      )}
    </div>
  );
}

export default Profile;