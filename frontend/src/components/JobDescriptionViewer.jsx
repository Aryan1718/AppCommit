function JobDescriptionViewer({ description }) {
  return (
    <div className="max-h-96 overflow-y-auto rounded-2xl border border-zinc-800 bg-[#09090b] p-5 font-mono text-sm leading-7 text-zinc-300">
      {description || 'No job description captured for this application.'}
    </div>
  );
}

export default JobDescriptionViewer;
