import React from "react";
import { Sandpack, SandpackProps } from "@codesandbox/sandpack-react";

export interface SonagiPlaygroundProps {
  /** The starting template for the sandbox */
  template?: SandpackProps["template"];
  /** The files to render in the sandbox */
  files: Record<string, string | { code: string; active?: boolean; hidden?: boolean }>;
  /** Additional npm dependencies */
  dependencies?: Record<string, string>;
  /** Theme of the playground (light/dark/auto or a custom theme object) */
  theme?: SandpackProps["theme"];
  /** Show file tabs? */
  showTabs?: boolean;
  /** Show line numbers in editor? */
  showLineNumbers?: boolean;
  /** Height of the editor */
  editorHeight?: number | string;
}

export const SonagiPlayground: React.FC<SonagiPlaygroundProps> = ({
  template = "vanilla",
  files,
  dependencies,
  theme = "dark",
  showTabs = true,
  showLineNumbers = true,
  editorHeight = 400,
}) => {
  return (
    <div className="sonagi-playground-container" style={{ width: "100%", margin: "1rem 0" }}>
      <Sandpack
        template={template}
        files={files}
        theme={theme}
        customSetup={{
          dependencies,
        }}
        options={{
          showTabs,
          showLineNumbers,
          editorHeight,
          showNavigator: true,
          wrapContent: true,
        }}
      />
    </div>
  );
};
