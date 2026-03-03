"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-400 rounded-lg px-3 py-1.5 transition-colors"
    >
      {copied ? "Kopiert!" : "Kopier"}
    </button>
  );
}
