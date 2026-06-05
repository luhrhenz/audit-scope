"use client";

import { useState } from "react";
import ReportCard, { AuditReport } from "@/components/ReportCard";

const PLACEHOLDER = `// Paste your Solidity contract here
// Example:
pragma solidity ^0.8.0;

contract SimpleVault {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] -= amount;
    }

    function ownerWithdrawAll() external {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }
}`;

export default function Home() {
  const [contractCode, setContractCode] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!contractCode.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: contractCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "An unknown error occurred.");
        return;
      }

      setActiveModel(data._model ?? null);
      setReport(data);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setContractCode("");
    setReport(null);
    setActiveModel(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-900/40">
              A
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-zinc-100">AuditScope</span>
              <span className="ml-2 hidden text-[10px] text-zinc-500 sm:inline">
                Smart Contract Audit Scoping Tool
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400 tracking-wide">
              Cairo support coming soon
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
              Solidity
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 flex flex-col gap-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Generate Your Audit Scope
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Paste a Solidity contract below. Get a structured security scoping report in seconds.
          </p>
        </div>

        {/* Input Section */}
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Contract Source
            </label>
            {contractCode && (
              <button
                onClick={handleClear}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <textarea
            value={contractCode}
            onChange={(e) => setContractCode(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="h-72 w-full resize-y rounded-xl border border-zinc-700/50 bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-200 placeholder-zinc-700 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-600">
              {contractCode.length > 0
                ? `${contractCode.split("\n").length} lines · ${contractCode.length} chars`
                : "Supports Solidity 0.4.x – 0.8.x"}
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading || !contractCode.trim()}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/40 transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analyzing…
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Generate Scope
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
            <span className="font-semibold">Error: </span>
            {error}
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-zinc-100">Vulnerability Report</h2>
              {activeModel && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] text-zinc-500">
                    <span className="text-zinc-400 font-medium">{activeModel}</span>
                  </span>
                </div>
              )}
            </div>
            <ReportCard report={report} />
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-[11px] text-zinc-700">
        AuditScope — built for hackathon · no data stored · stateless
      </footer>
    </div>
  );
}
