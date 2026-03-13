const statusMap = {
  applied: 'bg-blue-50 text-blue-700 ring-blue-200',
  interview: 'bg-amber-50 text-amber-700 ring-amber-200',
  offer: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-slate-100 text-slate-600 ring-slate-200',
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
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}`}>
      {label}
    </span>
  );
}

export default StatusBadge;
