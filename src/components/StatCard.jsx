function StatCard({
  title,
  amount,
  description,
  icon,
  variant = "white",
}) {
  const variants = {
    white: "bg-[var(--stat-default)]",
    green: "bg-[var(--stat-green)]",
    yellow: "bg-[var(--stat-yellow)]",
    pink: "bg-[var(--stat-pink)]",
  };

  return (
    <div
      className={`rounded-3xl p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${variants[variant]}`}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {title}
        </span>

        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface)]/80 text-base text-[var(--primary)]">
          {icon}
        </span>
      </div>

      {/* Amount */}
      <p className="text-2xl font-semibold tracking-tight text-[var(--text)]">
        {amount}
      </p>

      {/* Description */}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {description}
      </p>
    </div>
  );
}

export default StatCard;