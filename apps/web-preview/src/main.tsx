import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { SonagiPlayground } from '../../../packages/playground-core/src/index';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: 'white', border: '2px solid red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const exampleFiles = {
  "/App.js": `export default function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Hello Sonagi Playgrounds! ⛈️</h1>
      <p>This is a live test of the \`@sonagi-tools/playground-core\` component.</p>
    </div>
  )
}`
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <h2>Playground Core - Visual Test</h2>
      <SonagiPlayground 
        template="react" 
        files={exampleFiles} 
        theme="light" // Changed to light so it contrasts with dark background
        showLineNumbers={true} 
        showTabs={true} 
      />
    </ErrorBoundary>
  </React.StrictMode>,
)
