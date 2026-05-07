import { LoginPage } from './components/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-900 text-text-muted text-sm">
        Cargando sesión…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AppShell />;
}
