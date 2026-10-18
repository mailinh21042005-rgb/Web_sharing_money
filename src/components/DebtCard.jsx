function DebtCard() {
  return (
    <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Tóm tắt công nợ
          </h2>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Những khoản cần được cân bằng
          </p>
        </div>

        <span className="text-lg">
          ✨
        </span>
      </div>

      <div className="mt-6 space-y-5">
        {/* Nọc */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pink)] font-semibold text-[var(--danger)]">
              N
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Nọc
              </p>

              <p className="text-xs text-[var(--text-muted)]">
                Nợ bạn
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-[var(--success)]">
            +₫85.000
          </p>
        </div>

        {/* Nhi */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--yellow)] font-semibold text-[var(--warning)]">
              N
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Nhi
              </p>

              <p className="text-xs text-[var(--text-muted)]">
                Bạn nợ
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-[var(--danger)]">
            -₫40.000
          </p>
        </div>

        {/* Ka */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] font-semibold text-[var(--primary)]">
              K
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Ka
              </p>

              <p className="text-xs text-[var(--text-muted)]">
                Đã cân bằng
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-[var(--text-muted)]">
            ₫0
          </p>
        </div>
      </div>

      <button className="mt-7 w-full rounded-full bg-[var(--button-primary)] py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]">
        Xem chi tiết
      </button>
    </div>
  );
}

export default DebtCard;