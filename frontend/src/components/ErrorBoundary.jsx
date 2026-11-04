import React from 'react';

// Catches render errors anywhere below it so a single bad record can no longer
// blank the whole page without explanation.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ugoekloh Foundations interface error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="section">
        <div className="container narrow">
          <h2>Something went wrong</h2>
          <p>
            This part of the site could not be displayed. Reload the page to try
            again. If the problem continues, contact the foundation team.
          </p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          {import.meta.env.DEV && (
            <pre className="error-detail">{String(this.state.error?.stack || this.state.error)}</pre>
          )}
        </div>
      </section>
    );
  }
}
