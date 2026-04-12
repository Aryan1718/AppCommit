const statusMap = {
  applied: 'border-stone-900/12 bg-stone-200/80 text-stone-800',
  interview: 'border-[color:var(--app-accent)]/20 bg-[color:var(--app-accent)]/10 text-[color:var(--app-accent)]',
  offer: 'border-[color:var(--app-accent)]/28 bg-[color:var(--app-accent)]/16 text-[color:var(--app-accent)]',
  rejected: 'border-stone-900/10 bg-stone-200/70 text-stone-700',
};

const labelMap = {
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

function StatusBadge({ status }) {
  const classes = statusMap[status] || statusMap.rejected;
  const label = labelMap[status] || 'Unknown';

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${classes}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
