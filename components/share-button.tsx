"use client";
import { useState } from "react";
export function ShareButton({ title, path }: { title: string; path?: string }) {
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState("");
  async function share() {
    const url = path ? new URL(path, window.location.origin).href : window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url); setStatus("Link copied");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFallback(url); setStatus("Copy this link to share");
    }
  }
  return <span className="share-control"><button className="text-button" onClick={share}>Share</button>{status && <small role="status">{status}</small>}{fallback && <input aria-label="Share link" readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} />}</span>;
}
