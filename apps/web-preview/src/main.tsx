import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { SonagiPlayground, SonagiJupyterPlayground, JupyterNotebook } from '../../../packages/playground-core/src/index';

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
    </div>
  )
}`
};

const exampleNotebook: JupyterNotebook = {
  cells: [
    {
      cell_type: 'markdown',
      source: '# JupyterLite Playground Test\nThis is a sample markdown cell inside a Jupyter notebook JSON structure.'
    },
    {
      cell_type: 'code',
      execution_count: 1,
      source: ['import numpy as np\n', 'print("Hello JupyterLite!")\n', 'np.random.rand(3)'],
      outputs: [
        {
          output_type: 'stream',
          name: 'stdout',
          text: 'Hello JupyterLite!\n'
        }
      ]
    }
  ]
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <div style={{ paddingBottom: "2rem" }}>
        <h2>Playground Core - Visual Test</h2>
        <SonagiPlayground 
          template="react" 
          files={exampleFiles} 
          theme="light"
          showLineNumbers={true} 
          showTabs={true} 
        />
      </div>
      <div style={{ paddingBottom: "2rem" }}>
        <h2>JupyterLite Core - Visual Test</h2>
        <SonagiJupyterPlayground 
          notebook={exampleNotebook}
          theme="light"
        />
      </div>
    </ErrorBoundary>
  </React.StrictMode>,
)
