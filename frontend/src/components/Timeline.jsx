const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));

const getEventTitle = (event) => {
  if (event.type === 'applied') {
    return 'Snapshot captured automatically';
  }

  if (event.type === 'status') {
    return event.label.replace('Status changed to', 'Status updated to');
  }

  return event.label.replace('Added note:', 'Note saved:');
};

function Timeline({ events, resumeFilename, portal }) {
  if (!events?.length) {
    return <p className="text-sm text-zinc-500">No snapshot history yet.</p>;
  }

  return (
    <div className="space-y-5">
      {events.map((event) => (
        <div key={event.id} className="flex gap-4">
          <div className="mt-1 flex w-5 shrink-0 justify-center">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-400" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-zinc-300">
              <span className="font-medium text-white">{formatDate(event.date)}</span>
              <span className="mx-2 text-zinc-600">-</span>
              {getEventTitle(event)}
            </p>
            {event.type === 'applied' ? (
              <div className="space-y-1 text-sm text-zinc-500">
                <p className="font-mono">resume: {resumeFilename || 'resume_not_detected'}</p>
                <p className="font-mono">portal: {portal}</p>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Timeline;
