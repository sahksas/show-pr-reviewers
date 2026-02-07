import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"success" | "error" | "">("");
  const [cacheInfo, setCacheInfo] = useState<string>("");

  useEffect(() => {
    // Load saved token
    chrome.storage.sync.get({ githubToken: "" }, (items) => {
      const storedToken = items.githubToken;
      if (typeof storedToken === "string") {
        setToken(storedToken);
      }
    });

    // Load cache info
    loadCacheInfo();
  }, []);

  const loadCacheInfo = async () => {
    const storage = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(storage).filter((key) => key.startsWith("reviewers:"));

    if (cacheKeys.length === 0) {
      setCacheInfo("No cached data");
    } else {
      const totalEntries = cacheKeys.reduce((acc, key) => {
        const entry = storage[key] as { data?: Record<string, unknown> } | undefined;
        return acc + Object.keys(entry?.data || {}).length;
      }, 0);
      setCacheInfo(`${cacheKeys.length} repositories, ${totalEntries} PRs cached`);
    }
  };

  const saveToken = () => {
    chrome.storage.sync.set({ githubToken: token }, () => {
      setStatus("Token saved successfully!");
      setStatusType("success");
      setTimeout(() => {
        setStatus("");
        setStatusType("");
      }, 2000);
    });
  };

  const clearCache = async () => {
    const storage = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(storage).filter((key) => key.startsWith("reviewers:"));

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
      setStatus("Cache cleared!");
      setStatusType("success");
      loadCacheInfo();
    } else {
      setStatus("No cache to clear");
      setStatusType("");
    }

    setTimeout(() => {
      setStatus("");
      setStatusType("");
    }, 2000);
  };

  const testToken = async () => {
    if (!token) {
      setStatus("Please enter a token first");
      setStatusType("error");
      return;
    }

    setStatus("Testing...");
    setStatusType("");

    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        setStatus(`Token valid! Logged in as ${user.login}`);
        setStatusType("success");
      } else {
        setStatus(`Token invalid: ${response.status} ${response.statusText}`);
        setStatusType("error");
      }
    } catch (error) {
      setStatus(`Test failed: ${error}`);
      setStatusType("error");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>GitHub PR Reviewers Settings</h1>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "10px" }}>GitHub Personal Access Token</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "10px" }}>
          Required to access the GitHub API. Create a token at{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0969da" }}
          >
            GitHub Settings
          </a>{" "}
          with <code>repo</code> scope.
        </p>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d0d7de",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={saveToken}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2da44e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Save Token
          </button>
          <button
            onClick={testToken}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f6f8fa",
              color: "#24292f",
              border: "1px solid #d0d7de",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Test Token
          </button>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "10px" }}>Cache</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "10px" }}>
          Reviewer data is cached for 5 minutes to reduce API calls.
        </p>
        <p style={{ marginBottom: "10px" }}>{cacheInfo}</p>
        <button
          onClick={clearCache}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f6f8fa",
            color: "#24292f",
            border: "1px solid #d0d7de",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Clear Cache
        </button>
      </section>

      {status && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            backgroundColor: statusType === "success" ? "#dafbe1" : statusType === "error" ? "#ffebe9" : "#f6f8fa",
            color: statusType === "success" ? "#1a7f37" : statusType === "error" ? "#cf222e" : "#24292f",
            marginTop: "20px",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
