import { Component, type ErrorInfo, type ReactNode } from 'react';

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
      localStorage.removeItem('cadence.tasks.v1');
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
          <h1>页面加载出错</h1>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn-primary" onClick={this.reset}>
            重置本地任务缓存并刷新
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
