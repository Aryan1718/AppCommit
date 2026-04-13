const statusMap = {
  applied: 'border-stone-900/12 bg-stone-200/80 text-stone-800',
  interview: 'border-amber-200/80 bg-amber-100/60 text-amber-800',
  offer: 'border-emerald-200/80 bg-emerald-100/60 text-emerald-800',
  rejected: 'border-rose-200/80 bg-rose-100/60 text-rose-800',
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
