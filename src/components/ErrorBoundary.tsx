import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'app' | 'widget';
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, '\n', error.stack, '\nComponent stack:', info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.variant === 'widget') {
        return (
          <div className="flex h-full min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-[11px] font-medium text-white/40">This section hit an error.</p>
            <div className="w-full max-w-lg text-left">
              <p className="break-words text-[10px] font-mono text-red-400">{this.state.error?.message}</p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[9px] font-mono text-white/30">{this.state.error?.stack}</pre>
              {this.state.componentStack && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[9px] font-mono text-white/20">Component stack:{this.state.componentStack}</pre>
              )}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
              className="rounded-md border border-white/[0.1] px-3 py-1.5 text-[10px] font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Try again
            </button>
          </div>
        );
      }

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#080706',
            color: '#fff',
            padding: '40px',
            fontFamily: 'monospace',
            overflow: 'auto',
            zIndex: 2147483647,
          }}
        >
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#d4a52c' }}>
            SpotVault encountered an error
          </h1>
          <p style={{ fontSize: '14px', marginBottom: '20px', color: 'rgba(255,255,255,0.5)' }}>
            The app crashed while rendering. Your data is safe. Reloading usually fixes this.
          </p>
          <div style={{ marginBottom: '16px' }}>
            <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Error: </strong>
            <span style={{ color: '#f87171' }}>{this.state.error?.message}</span>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', marginBottom: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px',
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid rgba(212,165,44,0.3)',
              background: 'rgba(212,165,44,0.1)',
              color: '#f5e6b0',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload SpotVault
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
