import { useLocation, useNavigate } from "react-router-dom";

function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;

    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  if (location.pathname === "/") {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4 lg:px-10">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] transition hover:opacity-80"
      >
        ← Quay lại
      </button>
    </div>
  );
}

export default BackButton;