import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Cadence render error', error, info);
  }

  private reset = () => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key === 'cadence.tasks.v1' || key.startsWith('cadence.tasks.v1.')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-fallback">
          <h1>{t('errPageLoad')}</h1>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn-primary" onClick={this.reset}>
            {t('errResetCache')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
