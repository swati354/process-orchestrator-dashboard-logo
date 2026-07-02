import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ProcessesDashboard } from '@/components/ProcessesDashboard';

function SignInGate() {
  const { isAuthenticated, isLoading, login, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-900 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/lumiere-logo.png"
            alt="Lumiere Ent. logo"
            className="h-28 w-28 rounded-3xl object-contain shadow-lg"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Orchestrator Processes</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to browse your UiPath process releases</p>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="button"
          onClick={login}
          className="rounded-xl bg-green-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 transition-colors"
        >
          Sign in with UiPath
        </button>
      </div>
    );
  }

  return <ProcessesDashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <SignInGate />
    </AuthProvider>
  );
}