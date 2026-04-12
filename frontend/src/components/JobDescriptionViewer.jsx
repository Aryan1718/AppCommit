function JobDescriptionViewer({ description }) {
  return (
    <div className="max-h-96 overflow-y-auto border border-stone-900/10 bg-white/70 p-5 font-mono text-sm leading-7 text-stone-700">
      {description || 'No job description captured for this application.'}
    </div>
  );
}

export default JobDescriptionViewer;
