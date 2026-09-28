import React, { useEffect, useState, useMemo } from 'react';

interface AssetHubItem {
  id: string;
  name: string;
  ext?: string;
  tags?: string[];
  has_thumbnail?: boolean;
}

const API_URL = 'https://assets.sonagi.space';

function App() {
  const [items, setItems] = useState<AssetHubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchItems = async (query = '') => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/items?search=${encodeURIComponent(query)}&limit=50`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch from sonagi-assets', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchItems(search);
    }
  };

  const handleInsert = async (item: AssetHubItem) => {
    try {
      const isSvg = item.ext?.toLowerCase() === 'svg';
      const url = `${API_URL}/api/image/${item.id}/original`;

      const response = await fetch(url);
      
      if (isSvg) {
        const svgText = await response.text();
        parent.postMessage({ pluginMessage: { type: 'insert-svg', svg: svgText } }, '*');
      } else {
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        parent.postMessage({ pluginMessage: { type: 'insert-image', bytes } }, '*');
      }
    } catch (e) {
      console.error('Failed to insert asset', e);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900 flex flex-col h-screen">
      <h1 className="text-lg font-bold mb-4 flex-shrink-0">Sonagi Assets</h1>
      
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <input
          type="text"
          className="flex-1 p-2 border border-gray-300 rounded"
          placeholder="Search... (Press Enter)"
          value={search}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
        />
        <button 
          className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
          onClick={() => fetchItems(search)}
        >
          Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-gray-500 text-sm text-center mt-10">Loading assets...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-10">No assets found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {items.map(item => {
              const previewUrl = item.has_thumbnail 
                ? `${API_URL}/api/image/${item.id}/thumbnail`
                : `${API_URL}/api/image/${item.id}/original`;

              return (
                <div 
                  key={item.id} 
                  className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer flex flex-col" 
                  onClick={() => handleInsert(item)}
                >
                  <div className="h-24 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                    <img 
                      src={previewUrl} 
                      alt={item.name} 
                      className={`max-w-full max-h-full ${item.ext === 'svg' ? 'object-contain p-2' : 'object-cover w-full h-full'}`}
                      loading="lazy"
                    />
                    {item.ext === 'svg' && (
                      <span className="absolute top-1 right-1 bg-black/50 text-white text-[9px] px-1 rounded">SVG</span>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <p className="text-xs font-semibold truncate" title={item.name}>{item.name}</p>
                    <div className="flex gap-1 mt-1 overflow-hidden h-4">
                      {item.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded truncate max-w-full">
                          #{tag.split(':').pop() || tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
