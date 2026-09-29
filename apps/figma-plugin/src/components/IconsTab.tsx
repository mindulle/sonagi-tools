import React, { useState, useEffect } from 'react';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function IconsTab() {
  const [config, setConfig] = useState<GitHubConfig>({
    token: '',
    owner: 'mindulle',
    repo: 'sonagi-design-system',
    branch: 'main',
    path: 'packages/assets/src/icons', // Default path for icons
  });
  
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{name: string, svg: string}[]>([]);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'get-github-config' } }, '*');

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'github-config-loaded') {
        if (msg.config) {
          setConfig(prev => ({ ...prev, ...msg.config }));
        }
      } else if (msg.type === 'export-svgs-result') {
        setPreview(msg.payload);
        handlePushToGitHub(msg.payload);
      } else if (msg.type === 'error') {
        setStatus(`Error: ${msg.message}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config]);

  const saveConfig = () => {
    parent.postMessage({ pluginMessage: { type: 'set-github-config', config } }, '*');
    setStatus('Configuration saved!');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleExportClick = () => {
    if (!config.token) {
      setStatus('GitHub Token is required.');
      return;
    }
    setLoading(true);
    setStatus('Extracting SVGs from Figma...');
    parent.postMessage({ pluginMessage: { type: 'export-svgs' } }, '*');
  };

  const generateReactComponent = (name: string, svg: string) => {
    // Basic conversion of SVG string to React component
    // 1. Remove XML declaration if present
    let cleanSvg = svg.replace(/<\\?xml.*\\?>/gi, '').trim();
    // 2. Change width and height to inherit or generic (optional, but good for icons)
    // 3. Convert some basic attributes to React camelCase (e.g. fill-opacity -> fillOpacity)
    cleanSvg = cleanSvg.replace(/([a-z]+)-([a-z]+)=/gi, (match, p1, p2) => `${p1}${p2.charAt(0).toUpperCase() + p2.slice(1)}=`);
    // 4. Change class to className
    cleanSvg = cleanSvg.replace(/class=/gi, 'className=');

    return `import React from 'react';\n\nexport const ${name} = (props: React.SVGProps<SVGSVGElement>) => (\n  ${cleanSvg.replace(/<svg /, '<svg {...props} ')}\n);\n`;
  };

  const handlePushToGitHub = async (icons: {name: string, svg: string}[]) => {
    try {
      setStatus('Pushing to GitHub...');
      
      let count = 0;
      for (const icon of icons) {
        const reactCode = generateReactComponent(icon.name, icon.svg);
        const filePath = `${config.path}/${icon.name}.tsx`;
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
        
        // Check if file exists
        const getRes = await fetch(`${url}?ref=${config.branch}`, {
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        let sha = undefined;
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }

        const contentBase64 = btoa(unescape(encodeURIComponent(reactCode)));
        
        const putRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `feat(icons): export ${icon.name} from Figma`,
            content: contentBase64,
            branch: config.branch,
            sha
          })
        });

        if (!putRes.ok) {
          const err = await putRes.json();
          throw new Error(err.message || 'Failed to push file');
        }
        count++;
      }
      
      setStatus(`Successfully pushed ${count} icons to GitHub! 🎉`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm text-gray-800">
      <div className="bg-orange-50 p-3 rounded border border-orange-100 mb-2">
        <h3 className="font-bold text-orange-800 mb-1">GitHub Icon Config</h3>
        <div className="flex flex-col gap-2">
          <input 
            type="password" 
            placeholder="GitHub PAT (repo scope)" 
            className="w-full p-2 border border-gray-300 rounded text-xs"
            value={config.token}
            onChange={e => setConfig({...config, token: e.target.value})}
          />
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Owner" 
              className="w-1/2 p-2 border border-gray-300 rounded text-xs"
              value={config.owner}
              onChange={e => setConfig({...config, owner: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Repo" 
              className="w-1/2 p-2 border border-gray-300 rounded text-xs"
              value={config.repo}
              onChange={e => setConfig({...config, repo: e.target.value})}
            />
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Branch" 
              className="w-1/3 p-2 border border-gray-300 rounded text-xs"
              value={config.branch}
              onChange={e => setConfig({...config, branch: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Path (e.g. src/icons)" 
              className="w-2/3 p-2 border border-gray-300 rounded text-xs"
              value={config.path}
              onChange={e => setConfig({...config, path: e.target.value})}
            />
          </div>
          <button 
            onClick={saveConfig}
            className="w-full bg-white border border-orange-300 text-orange-700 py-1.5 rounded text-xs font-semibold hover:bg-orange-100"
          >
            Save Config
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={handleExportClick}
          disabled={loading}
          className="bg-orange-600 text-white p-3 rounded font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? 'Processing...' : '⬆️ Extract Icons & Push to GitHub'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          Select icons on the canvas to export specific ones, or deselect all to export all components.
        </p>
      </div>

      {status && (
        <div className="mt-2 p-2 bg-gray-100 text-xs rounded border border-gray-200 text-center break-words">
          {status}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-xs font-bold text-gray-500 mb-2">Exported Icons ({preview.length})</h3>
          <div className="flex flex-wrap gap-2">
            {preview.map(p => (
              <div key={p.name} className="p-2 border rounded bg-white flex flex-col items-center gap-1 w-16" title={p.name}>
                <div dangerouslySetInnerHTML={{ __html: p.svg }} className="w-6 h-6 text-gray-800 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" />
                <span className="text-[9px] truncate w-full text-center text-gray-500">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
