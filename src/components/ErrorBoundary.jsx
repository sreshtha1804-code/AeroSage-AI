import { Component } from 'react';

/** Prevents a rendering error from leaving the user with a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // The one deliberate console call in the frontend: it reports an unexpected render failure.
    // eslint-disable-next-line no-console
    console.error('[UI error]', error);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        className="mx-auto mt-16 max-w-md rounded-2xl border border-amber-400/40 p-6 text-center"
      >
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-300">An unexpected error occurred. Please reload the page.</p>
        <button className="btn mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
