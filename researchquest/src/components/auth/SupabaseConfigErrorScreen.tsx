import { supabaseConfigErrorMessage } from "../../lib/supabase";

export function SupabaseConfigErrorScreen() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-lg bg-bg-surface border border-border-subtle rounded-md shadow-lg p-8">
        <div className="w-14 h-14 bg-bg-elevated border border-border-subtle rounded-md mb-5 flex items-center justify-center text-text-primary font-serif font-bold text-xl">
          RQ
        </div>
        <h1 className="font-serif text-title font-bold text-text-primary">
          Supabase configuration required
        </h1>
        <p className="text-body text-text-secondary mt-3">
          ResearchQuest needs Supabase credentials before it can start.
        </p>

        <div className="mt-5 rounded-sm border border-border-moderate bg-bg-elevated p-4">
          <p className="text-small font-medium text-text-primary">
            Required environment variables
          </p>
          <ul className="mt-2 space-y-1 text-small text-text-secondary font-mono">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>

        <div className="mt-4 rounded-sm border border-border-moderate bg-bg-elevated p-4">
          <p className="text-small font-medium text-text-primary">
            Setup instructions
          </p>
          <ol className="mt-2 space-y-2 text-small text-text-secondary list-decimal list-inside">
            <li>
              Create a{" "}
              <code className="font-mono text-text-primary">.env</code> file at
              the project root with:
            </li>
          </ol>
          <pre className="mt-2 p-3 rounded-sm bg-bg-base text-caption font-mono text-text-secondary overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <p className="mt-2 text-small text-text-secondary">
            You can find both values in your Supabase project dashboard under{" "}
            <strong className="text-text-primary">Settings &gt; API</strong>.
          </p>
        </div>

        <p className="text-caption text-text-tertiary mt-4">
          {supabaseConfigErrorMessage}. Add them to your local environment or
          deployment settings, then reload the app.
        </p>

        <button
          onClick={handleReload}
          className="mt-5 w-full px-4 py-2 bg-primary-500 text-bg-base rounded-sm hover:opacity-90 transition-opacity font-medium"
        >
          Reload app
        </button>
      </div>
    </div>
  );
}
