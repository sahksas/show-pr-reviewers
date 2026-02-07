import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [currentURL, setCurrentURL] = useState<string>("");
  const [isGitHubPR, setIsGitHubPR] = useState(false);

  useEffect(() => {
    // Check if token is configured
    chrome.storage.sync.get({ githubToken: "" }, (items) => {
      setTokenConfigured(!!items.githubToken);
    });

    // Check current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
      setCurrentURL(url);
      setIsGitHubPR(url.includes("github.com") && url.includes("/pulls"));
    });
  }, []);

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div
      style={{
        width: "280px",
        padding: "16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "16px", margin: "0 0 16px 0" }}>
        GitHub PR Reviewers
      </h1>

      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: tokenConfigured ? "#2da44e" : "#cf222e",
            }}
          />
          <span style={{ fontSize: "14px" }}>
            {tokenConfigured === null
              ? "Loading..."
              : tokenConfigured
                ? "Token configured"
                : "Token not configured"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isGitHubPR ? "#2da44e" : "#656d76",
            }}
          />
          <span style={{ fontSize: "14px" }}>
            {isGitHubPR ? "On GitHub PR list page" : "Not on GitHub PR list"}
          </span>
        </div>
      </div>

      {!tokenConfigured && tokenConfigured !== null && (
        <p style={{ fontSize: "12px", color: "#656d76", margin: "0 0 16px 0" }}>
          Configure your GitHub token to display reviewers on PR list pages.
        </p>
      )}

      <button
        onClick={openOptions}
        style={{
          width: "100%",
          padding: "8px 16px",
          backgroundColor: "#f6f8fa",
          color: "#24292f",
          border: "1px solid #d0d7de",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Open Settings
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
