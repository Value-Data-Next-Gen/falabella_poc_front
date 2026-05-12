import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="p-6">
        <div className="panel p-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-accent-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text-primary">Algo salió mal en este panel</div>
            <div className="text-[12px] text-text-muted mt-1">
              {this.state.error?.message ?? 'Error desconocido.'} El resto de la app sigue funcionando.
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn !py-1 !px-2 text-[11px] mt-3 flex items-center gap-1"
            >
              <RefreshCw size={11} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
