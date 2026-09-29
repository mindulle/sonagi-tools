import React, { useEffect, useState } from 'react';
import { TokensTab } from './components/TokensTab';

const ASSETS_API_URL = 'https://assets.sonagi.space';
const KARAKEEP_API_URL = 'https://ref.sonagi.space/api/v1';
const KARAKEEP_API_KEY = 'ak2_57b030c6292c755b5974_584bf208b5a778316d5f95a93f80ba9e';

// Placeholder for internal CLIproxyAPI
const INTERNAL_LLM_API_URL = 'http://100.82.121.40:8000/v1/chat/completions'; // Example IP

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
    imageAssetId?: string;
    screenshotAssetId?: string;
  };
}

const AuthImage = ({ assetId, alt }: { assetId: string, alt: string }) => {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let objectUrl = '';
    fetch(`${KARAKEEP_API_URL}/assets/${assetId}`, {
      headers: { 'Authorization': `Bearer ${KARAKEEP_API_KEY}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Asset fetch failed');
      return res.blob();
    })
    .then(blob => {
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    })
    .catch(err => console.error(err));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (!src) return <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-400 text-xs">Loading...</div>;
  return <img src={src} alt={alt} className="object-cover w-full h-full" loading="lazy" />;
};

function App() {
  const [tab, setTab] = useState<'assets' | 'references' | 'ai' | 'tokens'>('assets');
  const [assetItems, setAssetItems] = useState<AssetHubItem[]>([]);
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // AI States
  const [selectedTexts, setSelectedTexts] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (msg && msg.type === 'selection-updated') {
        setSelectedTexts(msg.texts || []);
      }
    };
  }, []);

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
      const response = await fetch(`${KARAKEEP_API_URL}/bookmarks?limit=50`, {
        headers: { 'Authorization': `Bearer ${KARAKEEP_API_KEY}` }
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
    if (tab === 'assets' && assetItems.length === 0) fetchAssets();
    else if (tab === 'references' && bookmarkItems.length === 0) fetchBookmarks();
  }, [tab]);

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
      const assetId = item.content?.imageAssetId || item.content?.screenshotAssetId;
      if (!assetId) return;
      
      const response = await fetch(`${KARAKEEP_API_URL}/assets/${assetId}`, {
        headers: { 'Authorization': `Bearer ${KARAKEEP_API_KEY}` }
      });
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      parent.postMessage({ pluginMessage: { type: 'insert-image', bytes } }, '*');
    } catch (e) {
      console.error('Failed to insert bookmark image', e);
    }
  };

  // ---------------- AI Functions ----------------

  const callRealLLM = async (prompt: string, type: 'search' | 'wireframe' | 'summary') => {
    setAiLoading(true);

    try {
      let systemPrompt = '';
      if (type === 'search') {
        systemPrompt = 'You are a search assistant. Extract the single most important keyword from the user text to search in the bookmark database. Reply ONLY with the keyword, nothing else.';
      } else if (type === 'summary') {
        systemPrompt = 'You are a summarization assistant. Summarize the user text into 2-3 concise bullet points. Keep it short and use Korean.';
      } else if (type === 'wireframe') {
        systemPrompt = `You are a UI designer. Generate a JSON array of wireframe boxes based on the user prompt. 
Format MUST be strictly a JSON array of objects with { "name": string, "w": number, "h": number }. Do not include markdown blocks. Example: [{"name":"Header","w":400,"h":60}]`;
      }

      const res = await fetch('https://llm.lab.sonagi.space/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.7-flash-high',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || '';

      if (type === 'search') {
        setSearch(reply);
        setTab('references');
        fetchBookmarks(reply);
      } 
      else if (type === 'summary') {
        const resultText = `✨ AI 요약: \n${reply}`;
        parent.postMessage({ pluginMessage: { type: 'create-sticky', text: resultText } }, '*');
      }
      else if (type === 'wireframe') {
        let layout;
        try {
          layout = JSON.parse(reply.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
          throw new Error('Failed to parse wireframe JSON');
        }
        parent.postMessage({ pluginMessage: { type: 'create-wireframe', layout } }, '*');
      }
    } catch (err: any) {
      console.error('LLM API Error:', err);
      parent.postMessage({ pluginMessage: { type: 'create-sticky', text: `❌ AI Error: ${err.message}` } }, '*');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-gray-900 flex flex-col h-screen overflow-hidden">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-lg font-bold">Sonagi Tools</h1>
      </div>
      
      <div className="flex gap-2 mb-4 border-b border-gray-200 flex-shrink-0">
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'assets' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('assets'); }}
        >
          Internal
        </button>
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'references' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('references'); }}
        >
          Ref
        </button>
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'tokens' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setTab('tokens'); }}
        >
          Tokens
        </button>
        <button 
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'ai' ? 'border-b-2 border-purple-500 text-purple-600 flex items-center gap-1' : 'text-gray-500 flex items-center gap-1'}`}
          onClick={() => { setTab('ai'); }}
        >
          ✨ AI
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* --- AI TAB --- */}
        {tab === 'ai' && (
          <div className="flex flex-col gap-4">
            <div className="bg-purple-50 p-3 rounded border border-purple-100">
              <h3 className="text-sm font-bold text-purple-800 mb-1">선택된 텍스트 ({selectedTexts.length}개)</h3>
              <p className="text-xs text-purple-600 line-clamp-2">
                {selectedTexts.length > 0 ? selectedTexts.join(' / ') : '캔버스에서 스티키 노트나 텍스트를 선택해주세요.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                disabled={selectedTexts.length === 0 || aiLoading}
                onClick={() => callRealLLM(selectedTexts[0], 'search')}
                className="bg-white border border-gray-300 text-gray-700 p-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50 text-left"
              >
                🔎 선택한 텍스트로 <span className="font-bold">레퍼런스 찾기</span>
              </button>
              <button 
                disabled={selectedTexts.length === 0 || aiLoading}
                onClick={() => callRealLLM(selectedTexts.join('\n'), 'summary')}
                className="bg-white border border-gray-300 text-gray-700 p-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50 text-left"
              >
                📝 선택한 내용 <span className="font-bold">요약본 생성</span>
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2">프롬프트로 생성</h3>
              <textarea 
                className="w-full p-2 border border-gray-300 rounded text-sm mb-2"
                rows={3}
                placeholder="예: 깔끔한 B2B 로그인 화면 뼈대 만들어줘"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              />
              <button 
                disabled={aiLoading || !aiPrompt.trim()}
                onClick={() => callRealLLM(aiPrompt, 'wireframe')}
                className="w-full bg-purple-600 text-white p-2 rounded text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {aiLoading ? 'AI 생성 중...' : '✨ 와이어프레임 자동 생성'}
              </button>
            </div>
          </div>
        )}

        {tab === 'tokens' && <TokensTab />}

        {/* --- ASSETS / REFS TAB --- */}
        {(tab === 'assets' || tab === 'references') && (
          <>
            <div className="flex gap-2 mb-4 flex-shrink-0">
              <input
                type="text"
                className="flex-1 p-2 border border-gray-300 rounded text-sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button 
                className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
                onClick={() => tab === 'assets' ? fetchAssets(search) : fetchBookmarks(search)}
              >
                Search
              </button>
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm text-center mt-10">Loading...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-4">
                {tab === 'assets' && assetItems.map(item => {
                  const previewUrl = item.has_thumbnail 
                    ? `${ASSETS_API_URL}/api/image/${item.id}/thumbnail`
                    : `${ASSETS_API_URL}/api/image/${item.id}/original`;

                  return (
                    <div 
                      key={item.id} 
                      className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 cursor-pointer flex flex-col" 
                      onClick={() => handleInsertAsset(item)}
                    >
                      <div className="h-24 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                        <img 
                          src={previewUrl} 
                          alt={item.name} 
                          className={`max-w-full max-h-full ${item.ext === 'svg' ? 'object-contain p-2' : 'object-cover w-full h-full'}`}
                          loading="lazy"
                        />
                        {item.ext === 'svg' && <span className="absolute top-1 right-1 bg-black/50 text-white text-[9px] px-1 rounded">SVG</span>}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <p className="text-xs font-semibold truncate" title={item.name}>{item.name}</p>
                      </div>
                    </div>
                  );
                })}

                {tab === 'references' && bookmarkItems.map(item => {
                  const assetId = item.content?.imageAssetId || item.content?.screenshotAssetId;
                  return (
                    <div 
                      key={item.id} 
                      className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm hover:shadow hover:border-blue-300 cursor-pointer flex flex-col" 
                      onClick={() => handleInsertBookmark(item)}
                    >
                      <div className="h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
                        {assetId ? <AuthImage assetId={assetId} alt={item.title} /> : <span className="text-gray-400 text-xs">No Image</span>}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <p className="text-xs font-semibold truncate" title={item.title}>{item.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
