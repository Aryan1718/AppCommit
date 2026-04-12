function Privacy() {
  return (
    <div className="min-h-screen px-4 py-12 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl dossier-card p-8 sm:p-10">
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-stone-950">Your data stays yours.</h1>
        <p className="mt-3 text-sm text-stone-500">Last updated: April 11, 2026</p>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">What AppCommit collects</h2>
          <p className="mt-4 text-base leading-7 text-stone-700">
            AppCommit does not collect or sell your personal data for its own use. The application is designed to
            help you save your own job application records, not to gather them for us.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Your data ownership</h2>
          <p className="mt-4 text-base leading-7 text-stone-700">
            The job descriptions, resumes, application dates, and other records you save through AppCommit are your
            data. They remain under your control.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Where data is stored</h2>
          <p className="mt-4 text-base leading-7 text-stone-700">
            Your records are stored based on the storage option you set up for your deployment. If you connect your
            own database or storage service, the data stays there. AppCommit does not move that data somewhere else for
            separate collection.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">In simple terms</h2>
          <p className="mt-4 text-base leading-7 text-stone-700">
            We do not collect your data for advertising, do not sell it, and do not claim ownership over it. AppCommit
            is a tool to help you manage your own application history.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Privacy;
