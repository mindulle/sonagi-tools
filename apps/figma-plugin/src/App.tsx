import React, { useEffect, useState } from 'react';

const ASSETS_API_URL = 'https://assets.sonagi.space';
const KARAKEEP_API_URL = 'https://ref.sonagi.space/api/v1';
// Hardcoded token for internal use
const KARAKEEP_API_KEY = 'ak2_57b030c6292c755b5974_584bf208b5a778316d5f95a93f80ba9e';

interface AssetHubItem {
  id: string;
  name: string;
  ext?: string;
  tags?: string[];
  has_thumbnail?: boolean;
}

interface BookmarkItem {
  id: string;
  title: string;
  tags: { name: string }[];
  content: {
    imageUrl?: string;
    url?: string;
  };
}

function App() {
  const [tab, setTab] = useState<'assets' | 'references'>('assets');
  const [assetItems, setAssetItems] = useState<AssetHubItem[]>([]);
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAssets = async (query = '') => {
    setLoading(true);
    try {
      const response = await fetch(`${ASSETS_API_URL}/api/items?search=${encodeURIComponent(query)}&limit=50`);
      const data = await response.json();
      setAssetItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch from sonagi-assets', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async (query = '') => {
    setLoading(true);
    try {
      // Karakeep search endpoint might be slightly different, but /bookmarks supports ?q= or similar?
      // Wait, let's just fetch recent if no query, or we can filter locally for MVP if API lacks simple search.
      // Usually Hoarder API has a search param, let's assume filtering locally if we just pull 50.
      const response = await fetch(`${KARAKEEP_API_URL}/bookmarks?limit=50`, {
        headers: {
          'Authorization': `Bearer ${KARAKEEP_API_KEY}`
        }
      });
      const data = await response.json();
      let items: BookmarkItem[] = data.bookmarks || [];
      if (query) {
        items = items.filter(i => 
          i.title?.toLowerCase().includes(query.toLowerCase()) || 
          i.tags?.some(t => t.name.toLowerCase().includes(query.toLowerCase()))
        );
      }
      setBookmarkItems(items);
    } catch (error) {
      console.error('Failed to fetch from Karakeep', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'assets') {
      fetchAssets(search);
    } else {
      fetchBookmarks(search);
    }
  }, [tab]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (tab === 'assets') fetchAssets(search);
      else fetchBookmarks(search);
    }
  };

  const handleInsertAsset = async (item: AssetHubItem) => {
    try {
      const isSvg = item.ext?.toLowerCase() === 'svg';
      const url = `${ASSETS_API_URL}/api/image/${item.id}/original?cb=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      
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

  const handleInsertBookmark = async (item: BookmarkItem) => {
    try {
      const imageUrl = item.content?.imageUrl;
      if (!imageUrl) return;
      
      const response = await fetch(imageUrl + `?cb=${Date.now()}`, { cache: 'no-store' });
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      parent.postMessage({ pluginMessage: { type: 'insert-image', bytes } }, '*');
    } catch (e) {
      console.error('Failed to insert bookmark image', e);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900 flex flex-col h-screen">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-lg font-bold">Sonagi Tools</h1>
      </div>
      
      <div className="flex gap-2 mb-4 border-b border-gray-200 flex-shrink-0">
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'assets' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('assets'); setSearch(''); }}
        >
          Internal Assets
        </button>
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'references' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('references'); setSearch(''); }}
        >
          References
        </button>
      </div>
      
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <input
          type="text"
          className="flex-1 p-2 border border-gray-300 rounded text-sm"
          placeholder="Search... (Press Enter)"
          value={search}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
        />
        <button 
          className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
          onClick={() => {
            if (tab === 'assets') fetchAssets(search);
            else fetchBookmarks(search);
          }}
        >
          Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-gray-500 text-sm text-center mt-10">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {tab === 'assets' && assetItems.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-10 col-span-2">No assets found.</p>
            )}
            {tab === 'references' && bookmarkItems.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-10 col-span-2">No references found.</p>
            )}

            {tab === 'assets' && assetItems.map(item => {
              const previewUrl = item.has_thumbnail 
                ? `${ASSETS_API_URL}/api/image/${item.id}/thumbnail`
                : `${ASSETS_API_URL}/api/image/${item.id}/original`;

              return (
                <div 
                  key={item.id} 
                  className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer flex flex-col" 
                  onClick={() => handleInsertAsset(item)}
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

            {tab === 'references' && bookmarkItems.map(item => {
              const previewUrl = item.content?.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image';
              return (
                <div 
                  key={item.id} 
                  className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 transition-all cursor-pointer flex flex-col" 
                  onClick={() => handleInsertBookmark(item)}
                >
                  <div className="h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img 
                      src={previewUrl} 
                      alt={item.title} 
                      className="object-cover w-full h-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <p className="text-xs font-semibold truncate" title={item.title}>{item.title}</p>
                    <div className="flex gap-1 mt-1 overflow-hidden h-4">
                      {item.tags?.slice(0, 2).map(tag => (
                        <span key={tag.name} className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded truncate max-w-full">
                          #{tag.name}
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
