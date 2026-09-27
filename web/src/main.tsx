import React, { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import { ThemeProvider, useTheme } from "./lib/theme";
import { App } from "./App";
import "antd/dist/reset.css";
import "./index.css";

// Hex mirrors of the design tokens in index.css, per theme.
const TOKENS = {
  light: {
    bg: "#f9faf9", surface: "#ffffff", elevated: "#ffffff", border: "#e5e7e5",
    text: "#182121", muted: "#647474", accent: "#0d9488",
  },
  dark: {
    bg: "#0c1414", surface: "#141e1e", elevated: "#1a2626", border: "#283636",
    text: "#e9f0ee", muted: "#94a8a5", accent: "#2dd4bf",
  },
};

/** Wires the app's light/dark theme + teal palette into Ant Design's ConfigProvider. */
function AntdRoot({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const t = TOKENS[theme];
  return (
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: t.accent,
          colorInfo: t.accent,
          colorBgBase: t.bg,
          colorTextBase: t.text,
          colorBgContainer: t.surface,
          colorBgElevated: t.elevated,
          colorBgLayout: t.bg,
          colorBorder: t.border,
          colorBorderSecondary: t.border,
          colorText: t.text,
          colorTextSecondary: t.muted,
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
