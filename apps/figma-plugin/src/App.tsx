import React, { useEffect, useState } from 'react';

// Using the same mocked data structure or standard structure
interface EagleImage {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

function App() {
  const [images, setImages] = useState<EagleImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchImages = async (query = '') => {
    setLoading(true);
    try {
      // Typically this would fetch from EAGLE_API_URL or sonagi-assets
      // For now, let's mock it since we are inside Figma iframe
      // Figma plugins can make normal fetch() calls from ui.html!
      // Example placeholder logic:
      const mockData: EagleImage[] = [
        {
          id: '1',
          name: 'Hero Section Reference',
          url: 'https://via.placeholder.com/600x400.png?text=Hero+Section',
          tags: ['hero', 'web'],
        },
        {
          id: '2',
          name: 'Pricing Table UI',
          url: 'https://via.placeholder.com/400x600.png?text=Pricing+Table',
          tags: ['pricing', 'ui'],
        },
        {
          id: '3',
          name: 'Dashboard Layout',
          url: 'https://via.placeholder.com/800x600.png?text=Dashboard',
          tags: ['dashboard', 'admin'],
        },
      ];
      
      const filtered = mockData.filter(img => 
        img.name.toLowerCase().includes(query.toLowerCase()) || 
        img.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
      );
      setImages(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleInsert = async (url: string) => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      parent.postMessage({ pluginMessage: { type: 'insert-image', bytes } }, '*');
    } catch (e) {
      console.error('Failed to fetch image bytes', e);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900">
      <h1 className="text-lg font-bold mb-4">Sonagi Assets</h1>
      
      <input
        type="text"
        className="w-full p-2 border border-gray-300 rounded mb-4"
        placeholder="Search assets..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          fetchImages(e.target.value);
        }}
      />

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {images.map(img => (
            <div key={img.id} className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer" onClick={() => handleInsert(img.url)}>
              <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
              <div className="p-2">
                <p className="text-xs font-semibold truncate" title={img.name}>{img.name}</p>
                <div className="flex gap-1 mt-1 overflow-hidden">
                  {img.tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded truncate">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
