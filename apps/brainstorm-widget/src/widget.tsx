/// <reference types="@figma/widget-typings" />
const { widget } = figma;
const { AutoLayout, Input, SVG, useSyncedState, useWidgetId } = widget;
const WidgetText = widget.Text;

const CLI_PROXY_API = "https://llm.lab.sonagi.space/v1/chat/completions";

const ICON_SPARKLES = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L12.168 8.5H19L13.416 12.5L15.584 19L10 15L4.416 19L6.584 12.5L1 8.5H7.832L10 2Z" fill="#3B82F6"/></svg>';
const ICON_CHECKED = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" rx="4" fill="#3B82F6"/><path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_UNCHECKED = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="3" stroke="#D1D5DB" stroke-width="2" fill="white"/></svg>';

function BrainstormWidget() {
  const widgetId = useWidgetId();
  const [prompt, setPrompt] = useSyncedState("prompt", "");
  const [response, setResponse] = useSyncedState("response", "");
  const [loading, setLoading] = useSyncedState("loading", false);
  const [useRAG, setUseRAG] = useSyncedState("useRAG", false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    
    setLoading(true);
    setResponse(""); // clear previous

    let systemContent = "You are a UI/UX brainstorming assistant. Provide concise, creative ideas as bullet points. Do not use markdown headers, just plain text bullets.";

    try {
      if (useRAG) {
        const ragRes = await fetch("http://127.0.0.1:13888/v0/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: prompt })
        });
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          if (ragData.context && ragData.context.trim()) {
            systemContent += "\n\n[사내 위키 검색 결과]\n" + ragData.context + "\n[검색 결과 끝]\n위 내용을 우선적으로 참고하여 아이디어를 제안해 주세요.";
          }
        }
      }

      const res = await fetch(CLI_PROXY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.7-flash-high", // Available model in CLIproxyAPI
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || "No response generated.";
      setResponse(reply.trim());
    } catch (err: any) {
      const errorMsg = err?.message || JSON.stringify(err, Object.getOwnPropertyNames(err)) || String(err);
      setResponse(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSticky = async () => {
    if (!response || loading) return;
    
    // In Figma Widget, onClick can use standard figma API to manipulate canvas
    const widgetNode = figma.getNodeById(widgetId) as WidgetNode;
    
    if ('createSticky' in figma) {
      // FigJam Sticky Notes use Inter Medium by default, we must load it first
      await (figma as any).loadFontAsync({ family: "Inter", style: "Medium" });
      const sticky = (figma as any).createSticky();
      sticky.text.characters = response;
      // Position sticky note to the right of the widget
      sticky.x = widgetNode.x + widgetNode.width + 40;
      sticky.y = widgetNode.y;
      (figma as any).currentPage.appendChild(sticky);
      (figma as any).currentPage.selection = [sticky];
    } else {
      // Fallback for normal Figma
      await (figma as any).loadFontAsync({ family: "Inter", style: "Regular" });
      const text = (figma as any).createText();
      text.characters = response;
      text.x = widgetNode.x + widgetNode.width + 40;
      text.y = widgetNode.y;
      (figma as any).currentPage.appendChild(text);
      (figma as any).currentPage.selection = [text];
    }
  };

  return (
    <AutoLayout
      direction="vertical"
      padding={24}
      spacing={16}
      fill="#FFFFFF"
      cornerRadius={16}
      stroke="#E5E7EB"
      effect={{
        type: "drop-shadow",
        color: { r: 0, g: 0, b: 0, a: 0.08 },
        offset: { x: 0, y: 4 },
        blur: 16,
      }}
      width={360}
    >
      {/* 2-Layer Hierarchy: Outer wrapper -> Header inner layer */}
      <AutoLayout direction="horizontal" spacing={8} verticalAlignItems="center" width="fill-parent">
        <SVG src={ICON_SPARKLES} />
        <WidgetText fontSize={18} fontWeight="bold" fill="#111827">
          Ideation Partner
        </WidgetText>
      </AutoLayout>
      
      {/* 2-Layer Hierarchy: Outer wrapper -> Input layer */}
      <AutoLayout direction="vertical" spacing={12} width="fill-parent">
        <AutoLayout
          direction="horizontal"
          spacing={8}
          verticalAlignItems="center"
          onClick={() => setUseRAG(!useRAG)}
        >
          <SVG src={useRAG ? ICON_CHECKED : ICON_UNCHECKED} />
          <WidgetText fontSize={14} fill="#4B5563">
            사내 위키(Vault) 데이터 기반 검색 연동
          </WidgetText>
        </AutoLayout>

        <AutoLayout
          fill="#F9FAFB"
          stroke="#D1D5DB"
          width="fill-parent"
          padding={16}
          cornerRadius={8}
        >
          <Input
            value={prompt}
            placeholder="ex) User onboarding gamification..."
            onTextEditEnd={(e: TextEditEvent) => setPrompt(e.characters)}
            fontSize={15}
            width="fill-parent"
            fill="#111827"
          />
        </AutoLayout>
        
        <AutoLayout
          fill={loading ? "#93C5FD" : "#2563EB"}
          padding={{ top: 12, bottom: 12, left: 16, right: 16 }}
          cornerRadius={8}
          width="fill-parent"
          horizontalAlignItems="center"
          onClick={handleGenerate}
          hoverStyle={{ fill: loading ? "#93C5FD" : "#1D4ED8" }}
        >
          <WidgetText fontSize={15} fill="#FFFFFF" fontWeight="bold">
            {loading ? "Generating Ideas..." : "Generate"}
          </WidgetText>
        </AutoLayout>
      </AutoLayout>
      
      {/* Output Layer (Conditionally rendered) */}
      {response ? (
        <AutoLayout
          direction="vertical"
          fill="#F3F4F6"
          padding={16}
          cornerRadius={8}
          width="fill-parent"
          spacing={16}
        >
          <WidgetText fontSize={14} fill="#374151" width="fill-parent" lineHeight={20}>
            {response}
          </WidgetText>

          {/* Action: Push to Canvas */}
          <AutoLayout
            fill="#FFFFFF"
            stroke="#D1D5DB"
            padding={{ top: 8, bottom: 8, left: 16, right: 16 }}
            cornerRadius={6}
            horizontalAlignItems="center"
            onClick={handleCreateSticky}
            hoverStyle={{ fill: "#F9FAFB" }}
            width="fill-parent"
          >
            <WidgetText fontSize={13} fill="#4B5563" fontWeight="bold">
              Extract to Sticky Note
            </WidgetText>
          </AutoLayout>
        </AutoLayout>
      ) : null}
    </AutoLayout>
  );
}

widget.register(BrainstormWidget);