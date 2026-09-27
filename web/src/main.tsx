import React, { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import { ThemeProvider, useTheme } from "./lib/theme";
import { App } from "./App";
import "antd/dist/reset.css";
import "./index.css";

/** Wires the app's light/dark toggle into Ant Design's own theme.
 * We let AntD's default palette (its signature blue + neutral grays) drive,
 * so the look is unmistakably Ant Design rather than the old teal design. */
function AntdRoot({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          // Academic serif; colors/surfaces/radii come from AntD's defaults.
          fontFamily: '"Source Serif 4", Georgia, "Times New Roman", serif',
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AntdRoot>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdRoot>
    </ThemeProvider>
  </React.StrictMode>
);
