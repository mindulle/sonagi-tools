import React, { useEffect, useState } from 'react';
import { TokensTab } from './components/TokensTab';
import { IconsTab } from './components/IconsTab';
import { getPortfolioLandingWireframe } from './wireframe';

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
  const [tab, setTab] = useState<'assets' | 'references' | 'ai' | 'tokens' | 'icons'>('assets');
  const [assetItems, setAssetItems] = useState<AssetHubItem[]>([]);
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // AI States
  const [selectedTexts, setSelectedTexts] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [componentSchema, setComponentSchema] = useState<any[]>([]);

  useEffect(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;
      if (msg.type === 'selection-updated') {
        setSelectedTexts(msg.texts || []);
      } else if (msg.type === 'extract-component-keys-result') {
        setComponentSchema(msg.payload || []);
      } else if (msg.type === 'error') {
        console.error(msg.message);
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
        systemPrompt = `You are an expert UI/UX designer and wireframe generator for Sonagi Design System V3. 
Based on the user's prompt (which may contain paths to our Wiki/RAG), generate a detailed wireframe UI represented as a JSON array of WireframeNode objects.

Strictly adhere to this TypeScript interface for the output:
type WireframeNodeType = 'SECTION' | 'FRAME' | 'CARD' | 'BUTTON' | 'BADGE' | 'SHAPE' | 'STICKY' | 'TEXT' | 'COMPONENT';
interface WireframeNode {
  id?: string;
  type: WireframeNodeType;
  name: string;
  content?: string;
  geometry?: { x?: number; y?: number; width?: number; height?: number; };
  layout?: {
    direction?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    spacing?: number;
    padding?: number | { top?: number; right?: number; bottom?: number; left?: number; horizontal?: number; vertical?: number };
    primaryAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAlign?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
    horizontalSizing?: 'FIXED' | 'HUG' | 'FILL';
    verticalSizing?: 'FIXED' | 'HUG' | 'FILL';
    wrap?: boolean;
  };
  style?: {
    borderWidth?: number; // 2px for Sonagi V3
    borderColor?: string; // hex or token (e.g. 'border-default', '#4A90E2', '#30363d')
    borderRadius?: number; // 4px for Sonagi V3 sm
    backgroundColor?: string; // hex or token (e.g. 'bg-base', 'bg-surface', '#070a12')
    fontSize?: number;
    fontWeight?: 'Regular' | 'Medium' | 'SemiBold' | 'Bold';
    textColor?: string;
    textAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  };
  v3Style?: boolean; // true enables Sonagi V3 defaults
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'dandelion';
  theme?: 'dark' | 'light';
  children?: WireframeNode[];
}

Sonagi V3 Conventions:
- 2px solid borders, 4px corner radius (Neo-Brutalism & Wild Sonagi)
- 8px grid spacing (spacing: 8, 16, 24, 32, 48, 64)
- Brand Colors: Rain (#4A90E2), Cyan (#00ffcc), Dandelion (#ffd166), Burgundy (#47211b), Dark BG (#060911, #090d16)
- AutoLayout: Use layout.direction ('VERTICAL' | 'HORIZONTAL') with nested children rather than absolute geometry.

Create a realistic layout (e.g., width 1440 for web sections).
Output ONLY valid JSON array. Do NOT wrap in \`\`\`json markdown blocks.`;
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
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${tab === 'icons' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500'}`}
          onClick={() => { setTab('icons'); }}
        >
          Icons
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
                className="w-full bg-purple-600 text-white p-2 rounded text-sm font-bold hover:bg-purple-700 disabled:opacity-50 mb-2"
              >
                {aiLoading ? 'AI 생성 중...' : '✨ 와이어프레임 자동 생성'}
              </button>
              <button 
                onClick={() => {
                  const portfolioLayout = getPortfolioLandingWireframe();
                  parent.postMessage({ pluginMessage: { type: 'create-wireframe', layout: portfolioLayout } }, '*');
                }}
                className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold hover:bg-blue-700 mb-2 flex items-center justify-center gap-1"
              >
                🚀 [CEO-1000] 포트폴리오 메인 랜딩 와이어프레임 생성
              </button>
              <button 
                onClick={() => {
                  // POC Mock JSON AST matching WireframeNode interface
                  const mockAst = [
                    {
                      id: "sec-1",
                      type: "FRAME",
                      name: "Hero Section",
                      v3Style: true,
                      geometry: { width: 1440, height: 600 },
                      layout: { direction: "VERTICAL", spacing: 24, padding: 64, counterAlign: "CENTER", primaryAlign: "CENTER" },
                      style: { backgroundColor: "#070a12", borderWidth: 2, borderColor: "#1e2430" },
                      children: [
                        {
                          id: "badge-1",
                          type: "BADGE",
                          name: "Tag",
                          content: "SONAGI DESIGN SYSTEM V3",
                          variant: "accent"
                        },
                        {
                          id: "text-1",
                          type: "TEXT",
                          name: "Title",
                          content: "Transform your workflow",
                          style: { fontSize: 48, fontWeight: "Bold", textColor: "#ffffff" }
                        },
                        {
                          id: "btn-1",
                          type: "BUTTON",
                          name: "CTA Button",
                          content: "Get Started",
                          variant: "accent"
                        }
                      ]
                    }
                  ];
                  parent.postMessage({ pluginMessage: { type: 'create-wireframe', layout: mockAst } }, '*');
                }}
                className="w-full bg-gray-800 text-white p-2 rounded text-sm font-bold hover:bg-gray-900 mb-2"
              >
                🛠️ Sonagi V3 컴포넌트 렌더러 테스트
              </button>

              <hr className="my-2 border-gray-200" />
              
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-700">🧩 컴포넌트 도감 추출기</h3>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                현재 파일에 있는 모든 컴포넌트의 Key 값을 스캔하여 JSON 스키마로 추출합니다. 이 값을 복사해서 시스템 프롬프트(Component Schema)에 붙여넣으세요.
              </p>
              <button 
                onClick={() => {
                  parent.postMessage({ pluginMessage: { type: 'extract-component-keys' } }, '*');
                }}
                className="w-full bg-indigo-100 text-indigo-700 border border-indigo-200 p-2 rounded text-sm font-bold hover:bg-indigo-200 mb-2"
              >
                📥 현재 파일의 Component Key 추출
              </button>
              {componentSchema.length > 0 && (
                <div className="mt-2 text-xs bg-gray-900 text-green-400 p-2 rounded max-h-32 overflow-y-auto">
                  <pre>{JSON.stringify(componentSchema, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'tokens' && <TokensTab />}
        {tab === 'icons' && <IconsTab />}

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
