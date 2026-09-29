import React, { useState } from 'react';

export interface JupyterCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  outputs?: any[];
  execution_count?: number | null;
}

export interface JupyterNotebook {
  cells: JupyterCell[];
  metadata?: any;
  nbformat?: number;
  nbformat_minor?: number;
}

export interface SonagiJupyterProps {
  notebook: JupyterNotebook;
  executeEndpoint?: string; // e.g. /api/execute/piston
  theme?: 'light' | 'dark';
}

export const SonagiJupyterPlayground: React.FC<SonagiJupyterProps> = ({
  notebook,
  executeEndpoint = '/api/execute',
  theme = 'dark'
}) => {
  const [cells, setCells] = useState<JupyterCell[]>(notebook.cells || []);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);

  const getSourceText = (source: string | string[]) => 
    Array.isArray(source) ? source.join('') : source;

  const handleRun = async (index: number) => {
    setRunningIndex(index);

    // Accumulate code from all cells up to the current one to simulate state
    const codeToRun = cells
      .slice(0, index + 1)
      .filter(c => c.cell_type === 'code')
      .map(c => getSourceText(c.source))
      .join('\n\n');

    try {
      // Stub execution logic
      const res = await fetch(executeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python', code: codeToRun })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }

      // Check if there is a body to parse before calling .json()
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Invalid JSON response: ${text.slice(0, 50)}...`);
      }
      
      // Update the specific cell's output
      setCells(prev => prev.map((cell, i) => {
        if (i === index) {
          return {
            ...cell,
            execution_count: (cell.execution_count || 0) + 1,
            outputs: [{
              output_type: 'stream',
              name: 'stdout',
              text: data.output || data.stdout || String(data)
            }]
          };
        }
        return cell;
      }));
    } catch (e: any) {
      setCells(prev => prev.map((cell, i) => {
        if (i === index) {
          return {
            ...cell,
            outputs: [{
              output_type: 'error',
              ename: 'ExecutionError',
              evalue: e.message,
              traceback: [e.message]
            }]
          };
        }
        return cell;
      }));
    } finally {
      setRunningIndex(null);
    }
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: 'sans-serif',
    background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
    color: theme === 'dark' ? '#d4d4d4' : '#333333',
    padding: '20px',
    borderRadius: '8px',
    border: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`
  };

  const cellStyle: React.CSSProperties = {
    marginBottom: '16px',
    padding: '12px',
    background: theme === 'dark' ? '#2d2d2d' : '#f5f5f5',
    borderRadius: '6px',
    position: 'relative'
  };

  return (
    <div className="sonagi-jupyter-container" style={containerStyle}>
      {cells.map((cell, index) => (
        <div key={index} style={cellStyle} className={`jupyter-cell ${cell.cell_type}`}>
          {cell.cell_type === 'markdown' && (
            <div className="markdown-body">
              {/* Note: we should render markdown properly with react-markdown in production */}
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {getSourceText(cell.source)}
              </pre>
            </div>
          )}
          
          {cell.cell_type === 'code' && (
            <div className="code-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#888', fontSize: '0.85em' }}>
                  In [{cell.execution_count || ' '}]:
                </span>
                <button 
                  onClick={() => handleRun(index)}
                  disabled={runningIndex !== null}
                  style={{
                    background: '#0e639c', color: '#fff', border: 'none', 
                    padding: '4px 12px', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  {runningIndex === index ? 'Running...' : '▶ Run'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '10px', background: theme === 'dark' ? '#1e1e1e' : '#fff', border: '1px solid #444', borderRadius: '4px', overflowX: 'auto' }}>
                <code>{getSourceText(cell.source)}</code>
              </pre>
              
              {cell.outputs && cell.outputs.length > 0 && (
                <div className="code-outputs" style={{ marginTop: '10px', padding: '10px', background: theme === 'dark' ? '#000' : '#eef', borderRadius: '4px' }}>
                  {cell.outputs.map((out, oIdx) => (
                    <pre key={oIdx} style={{ margin: 0, color: out.output_type === 'error' ? 'red' : 'inherit' }}>
                      {out.text || out.evalue || JSON.stringify(out)}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
