import React, { useState, useEffect } from 'react';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function TokensTab() {
  const [config, setConfig] = useState<GitHubConfig>({
    token: '',
    owner: 'mindulle',
    repo: 'sonagi-design-system',
    branch: 'main',
    path: 'packages/tokens/tokens',
  });
  
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load config from clientStorage via plugin message
    parent.postMessage({ pluginMessage: { type: 'get-github-config' } }, '*');

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'github-config-loaded') {
        if (msg.config) {
          setConfig(prev => ({ ...prev, ...msg.config }));
        }
      } else if (msg.type === 'export-tokens-result') {
        handlePushToGitHub(msg.payload);
      } else if (msg.type === 'error') {
        setStatus(`Error: ${msg.message}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    setStatus('Extracting variables from Figma...');
    parent.postMessage({ pluginMessage: { type: 'export-tokens' } }, '*');
  };

  const handlePushToGitHub = async (collections: Record<string, any>) => {
    try {
      setStatus('Pushing to GitHub...');
      
      for (const [name, content] of Object.entries(collections)) {
        const filePath = `${config.path}/${name.toLowerCase()}.json`;
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
        
        // 1. Check if file exists to get SHA
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

        // 2. Upload file
        const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
        
        const putRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `chore(tokens): sync ${name} tokens from Figma`,
            content: contentBase64,
            branch: config.branch,
            sha
          })
        });

        if (!putRes.ok) {
          const err = await putRes.json();
          throw new Error(err.message || 'Failed to push file');
        }
      }
      
      setStatus('Successfully pushed to GitHub! 🎉');
    } catch (err: any) {
      console.error(err);
      setStatus(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = async () => {
    if (!config.token) {
      setStatus('GitHub Token is required.');
      return;
    }
    setLoading(true);
    setStatus('Fetching from GitHub...');
    
    try {
      const collections: Record<string, any> = {};
      const filesToFetch = ['primitives.json', 'semantics.json']; // Can be dynamic
      
      for (const fileName of filesToFetch) {
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}/${fileName}?ref=${config.branch}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        });
        
        if (res.ok) {
          const text = await res.text();
          collections[fileName.replace('.json', '')] = JSON.parse(text);
        } else if (res.status !== 404) {
          throw new Error(`Failed to fetch ${fileName}`);
        }
      }

      setStatus('Applying variables to Figma...');
      parent.postMessage({ pluginMessage: { type: 'import-tokens', payload: collections } }, '*');
      setStatus('Successfully imported from GitHub! 🎉');
    } catch (err: any) {
      console.error(err);
      setStatus(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 text-sm text-gray-800">
      <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-2">
        <h3 className="font-bold text-blue-800 mb-1">GitHub Config</h3>
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
              placeholder="Path (e.g. packages/tokens)" 
              className="w-2/3 p-2 border border-gray-300 rounded text-xs"
              value={config.path}
              onChange={e => setConfig({...config, path: e.target.value})}
            />
          </div>
          <button 
            onClick={saveConfig}
            className="w-full bg-white border border-blue-300 text-blue-700 py-1.5 rounded text-xs font-semibold hover:bg-blue-100"
          >
            Save Config
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={handleExportClick}
          disabled={loading}
          className="bg-gray-800 text-white p-3 rounded font-bold hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          ⬆️ Export (Figma ➔ GitHub)
        </button>

        <button 
          onClick={handleImportClick}
          disabled={loading}
          className="bg-white border-2 border-gray-800 text-gray-800 p-3 rounded font-bold hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          ⬇️ Import (GitHub ➔ Figma)
        </button>
      </div>

      {status && (
        <div className="mt-2 p-2 bg-gray-100 text-xs rounded border border-gray-200 text-center break-words">
          {status}
        </div>
      )}
    </div>
  );
}
