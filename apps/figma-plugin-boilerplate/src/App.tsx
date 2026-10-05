import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(5);

  const onCreate = () => {
    parent.postMessage({ pluginMessage: { type: 'create-rectangles', count } }, '*');
  };

  const onCancel = () => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  };

  return (
    <div className="p-4 flex flex-col gap-4 text-sm font-sans bg-[var(--figma-color-bg)] text-[var(--figma-color-text)] h-full">
      <h2 className="font-semibold text-lg">Sonagi Figma Boilerplate</h2>
      <div className="flex flex-col gap-2">
        <label className="opacity-80">Rectangle Count:</label>
        <input 
          type="number" 
          className="border p-2 rounded bg-[var(--figma-color-bg-secondary)] text-[var(--figma-color-text)]"
          value={count} 
          onChange={(e) => setCount(Number(e.target.value))} 
        />
      </div>
      <div className="flex gap-2 mt-auto pt-4">
        <button 
          className="flex-1 bg-blue-500 text-white p-2 rounded font-medium hover:bg-blue-600 transition"
          onClick={onCreate}
        >
          Create
        </button>
        <button 
          className="flex-1 border p-2 rounded font-medium hover:bg-[var(--figma-color-bg-hover)] transition"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
