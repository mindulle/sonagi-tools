const { widget } = figma;
const { AutoLayout, Text, Input, useSyncedState } = widget;

const CLI_PROXY_API = "http://100.82.121.40:8000/v1/chat/completions";

function BrainstormWidget() {
  const [prompt, setPrompt] = useSyncedState("prompt", "");
  const [response, setResponse] = useSyncedState("response", "Ask me something to brainstorm!");
  const [loading, setLoading] = useSyncedState("loading", false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    
    setLoading(true);
    setResponse("Generating...");

    try {
      const res = await fetch(CLI_PROXY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o", // Example model name for the proxy
          messages: [
            { 
              role: "system", 
              content: "You are a helpful UI/UX brainstorming assistant. Provide concise, creative ideas based on the user's prompt. Keep it short." 
            },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || "No response generated.";
      setResponse(reply);
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AutoLayout
      direction="vertical"
      padding={24}
      spacing={16}
      fill="#FFFFFF"
      cornerRadius={12}
      stroke="#E5E7EB"
      effect={{
        type: "drop-shadow",
        color: { r: 0, g: 0, b: 0, a: 0.05 },
        offset: { x: 0, y: 2 },
        blur: 8,
      }}
    >
      <Text fontSize={20} fontWeight="bold" fill="#111827">
        Sonagi Brainstorm
      </Text>
      
      <Input
        value={prompt}
        placeholder="Enter topic..."
        onTextEditEnd={(e) => setPrompt(e.characters)}
        fill="#F9FAFB"
        stroke="#D1D5DB"
        width={320}
        padding={12}
        cornerRadius={6}
        fontSize={14}
      />

      <AutoLayout
        fill={loading ? "#93C5FD" : "#3B82F6"}
        padding={{ top: 10, bottom: 10, left: 16, right: 16 }}
        cornerRadius={6}
        onClick={handleGenerate}
        hoverStyle={{ fill: loading ? "#93C5FD" : "#2563EB" }}
      >
        <Text fontSize={14} fill="#FFFFFF" fontWeight="bold">
          {loading ? "Generating..." : "Generate Ideas"}
        </Text>
      </AutoLayout>
      
      <AutoLayout
        fill="#EFF6FF"
        padding={16}
        cornerRadius={8}
        width={320}
        stroke="#BFDBFE"
      >
        <Text fontSize={14} fill="#1E3A8A" width="fill-parent">
          {response}
        </Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(BrainstormWidget);