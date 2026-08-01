import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          textAlign: 'center',
          color: 'var(--text-dark)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--danger-bg, #FEF2F2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 28,
          }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Ocorreu um erro nesta seção
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 380 }}>
            Houve um problema ao carregar os dados. Clique em "Recarregar" para tentar novamente.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11, color: '#B91C1C',
              background: '#FEF2F2', padding: '8px 14px',
              borderRadius: 8, marginBottom: 20,
              maxWidth: 480, overflow: 'auto', textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: 'var(--color-primary, #432F2D)',
              color: '#fff', border: 'none',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
