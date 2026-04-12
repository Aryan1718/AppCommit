function Privacy() {
  return (
    <div className="min-h-screen px-4 py-12 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl dossier-card p-8 sm:p-10">
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-stone-950">Privacy Policy for AppCommit</h1>
        <p className="mt-3 text-sm text-stone-500">Last updated: March 2026</p>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            What We Collect
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-7 text-stone-700">
            <li>Job application details you capture (company name, job title, job description)</li>
            <li>Resume files you upload</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            How We Use It
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-7 text-stone-700">
            <li>To provide the AppCommit service</li>
            <li>To store your job application snapshots</li>
            <li>We never sell your data to third parties</li>
            <li>We never use your data for advertising</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            Data Storage
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-7 text-stone-700">
            <li>Your data is stored in the Supabase project you configure for your own deployment</li>
            <li>Resume files are stored in your configured storage bucket</li>
            <li>You can delete your data at any time</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            Contact
          </h2>
          <p className="mt-4 text-base leading-7 text-stone-700">support@appcommit.online</p>
        </section>
      </div>
    </div>
  );
}

export default Privacy;
