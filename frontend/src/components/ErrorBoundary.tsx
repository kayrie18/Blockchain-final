import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled error in component tree:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full rounded-3xl border border-slate-700 bg-slate-900/95 p-10 shadow-2xl">
            <h1 className="text-3xl font-black mb-4">Something went wrong</h1>
            <p className="text-slate-300 leading-relaxed mb-6">
              ChainVerify encountered an unexpected issue while rendering. Please refresh the page or try again later.
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-slate-400 font-mono overflow-auto">
              {this.state.error?.message || 'Unknown application error.'}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => window.location.reload()} className="px-5 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-semibold">Reload App</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
