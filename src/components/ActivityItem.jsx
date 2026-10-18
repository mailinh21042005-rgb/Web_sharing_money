function ActivityItem({ icon, name, person, date, amount }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--icon-background)] text-lg text-[var(--icon-color)]">
          {icon}
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--text)]">
            {name}
          </p>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {person} · {date}
          </p>
        </div>
      </div>

      <p className="text-sm font-semibold text-[var(--primary)]">
        {amount}
      </p>
    </div>
  );
}

export default ActivityItem;