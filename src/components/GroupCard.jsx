function GroupCard({ icon, name, transactions, amount, members }) {
  return (
    <div className="group-card rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--icon-background)] text-2xl text-[var(--icon-color)]">
            {icon}
          </div>

          <div>
            <h3 className="font-semibold text-[var(--text)]">
              {name}
            </h3>

            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {transactions} giao dịch
            </p>
          </div>
        </div>

        <span className="text-sm text-[var(--text-soft)]">
          →
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            Tổng chi tiêu
          </p>

          <p className="mt-1 text-lg font-semibold text-[var(--text)]">
            {amount}
          </p>
        </div>

        <div className="flex -space-x-2">
          {members.map((member, index) => (
            <div
              key={index}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--avatar-background)] text-xs font-semibold text-[var(--avatar-text)]"
            >
              {member}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GroupCard;