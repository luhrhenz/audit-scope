"use client";

import { useState } from "react";
import ReportCard, { AuditReport } from "@/components/ReportCard";
import ParticlesBackground from "@/components/ParticlesBackground";
import ThemeToggle from "@/components/ThemeToggle";

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

type InputMode = "paste" | "github";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [contractCode, setContractCode] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Analyzing…");
  const [error, setError] = useState<string | null>(null);
  const [fetchedFiles, setFetchedFiles] = useState<string[]>([]);

  async function runAnalysis(code: string) {
    setLoadingLabel("Analyzing…");

    const lineCount = code.split("\n").length;
    const contractLength = code.length;

    window.pendo?.track("contract_analysis_submitted", {
      contractLength,
      lineCount,
      solidityVersion: code.match(/pragma solidity\s+([^;]+)/)?.[1]?.trim() ?? "unknown",
    });

    const res = await fetch("/api/scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract: code }),
    });

    const data = await res.json();

    if (!res.ok) {
      window.pendo?.track("audit_report_generation_failed", {
        errorMessage: data.error ?? "Unknown error",
        errorType: "api_error",
        contractLength,
        lineCount,
      });
      throw new Error(data.error ?? "An unknown error occurred.");
    }

    setActiveModel(data._model ?? null);
    setReport(data);

    const riskAreas: Array<{ severity: string }> = data.riskAreas ?? [];
    window.pendo?.track("audit_report_generated", {
      modelUsed: data._model,
      riskAreaCount: riskAreas.length,
      highSeverityCount: riskAreas.filter((r) => r.severity === "high").length,
      mediumSeverityCount: riskAreas.filter((r) => r.severity === "medium").length,
      lowSeverityCount: riskAreas.filter((r) => r.severity === "low").length,
      attackSurfaceCount: data.attackSurface?.length ?? 0,
      vulnerabilityPatternsDetectedCount:
        (data.vulnerabilityPatterns ?? []).filter((v: { present: boolean }) => v.present).length,
      keyVariablesCount: data.keyVariables?.length ?? 0,
      auditFocusCount: data.auditFocus?.length ?? 0,
      contractLength,
      lineCount,
    });
  }

  async function handleGenerate() {
    if (!contractCode.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setFetchedFiles([]);

    try {
      await runAnalysis(contractCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error — check your connection.";
      setError(msg);
      // fire failure event only if runAnalysis didn't already fire it (network-level errors)
      if (err instanceof TypeError) {
        window.pendo?.track("audit_report_generation_failed", {
          errorMessage: msg,
          errorType: "network_error",
          contractLength: contractCode.length,
          lineCount: contractCode.split("\n").length,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleScanRepo() {
    if (!githubUrl.trim()) return;
    setLoading(true);
    setLoadingLabel("Fetching contracts…");
    setError(null);
    setReport(null);
    setFetchedFiles([]);

    window.pendo?.track("GitHub repo scan", { url: githubUrl.trim() });

    try {
      const fetchRes = await fetch("/api/fetch-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl.trim() }),
      });

      const fetchData = await fetchRes.json();

      if (!fetchRes.ok) {
        throw new Error(fetchData.error ?? "Failed to fetch repository.");
      }

      setFetchedFiles(fetchData.files ?? []);

      window.pendo?.track("GitHub contracts fetched", {
        fileCount: fetchData.fileCount,
        url: githubUrl.trim(),
      });

      await runAnalysis(fetchData.code);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error — check your connection."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    window.pendo?.track("Clear");
    setContractCode("");
    setGithubUrl("");
    setReport(null);
    setActiveModel(null);
    setError(null);
    setFetchedFiles([]);
  }

  const canSubmitPaste = !loading && !!contractCode.trim();
  const canSubmitGithub = !loading && !!githubUrl.trim();

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <ParticlesBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-900/40">
                A
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  AuditScope
                </span>
                <span className="ml-2 hidden text-[10px] text-zinc-400 dark:text-zinc-500 lg:inline">
                  Smart Contract Audit Scoping Tool
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 tracking-wide">
                Cairo support coming soon
              </span>
              <span className="hidden sm:inline-flex rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                Solidity
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 sm:px-5 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 flex-1">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl lg:text-4xl">
              Generate Your Audit Scope
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
              Paste a Solidity contract or point to a GitHub repo. Get a
              structured vulnerability report in seconds.
            </p>
          </div>

          {/* Input Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col gap-4 shadow-sm dark:shadow-none">
            {/* Mode Tabs */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs">
                <button
                  onClick={() => setInputMode("paste")}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    inputMode === "paste"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  Paste Code
                </button>
                <button
                  onClick={() => setInputMode("github")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                    inputMode === "github"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  GitHub URL
                </button>
              </div>

              {(contractCode || githubUrl || report) && (
                <button
                  onClick={handleClear}
                  className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Paste Code mode */}
            {inputMode === "paste" && (
              <>
                <textarea
                  value={contractCode}
                  onChange={(e) => {
                    const prev = contractCode;
                    setContractCode(e.target.value);
                    if (!prev && e.target.value) {
                      window.pendo?.track("Contract Input");
                    }
                  }}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  className="h-48 sm:h-72 w-full resize-y rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 outline-none focus:border-violet-400 dark:focus:border-violet-500/60 focus:ring-1 focus:ring-violet-400/30 dark:focus:ring-violet-500/30 transition-all"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                    {contractCode.length > 0
                      ? `${contractCode.split("\n").length} lines · ${contractCode.length} chars`
                      : "Supports Solidity 0.4.x – 0.8.x"}
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={!canSubmitPaste}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        Generate Scope
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* GitHub URL mode */}
            {inputMode === "github" && (
              <>
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSubmitGithub) handleScanRepo();
                    }}
                    placeholder="https://github.com/owner/repo"
                    spellCheck={false}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 outline-none focus:border-violet-400 dark:focus:border-violet-500/60 focus:ring-1 focus:ring-violet-400/30 dark:focus:ring-violet-500/30 transition-all"
                  />
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pl-1">
                    Supports full repos, branches, subfolders, or single{" "}
                    <code className="font-mono">.sol</code> files — public repos only
                  </p>
                </div>

                {/* URL examples */}
                <div className="flex flex-wrap gap-2">
                  {[
                    "owner/repo",
                    "owner/repo/tree/main/contracts",
                    "owner/repo/blob/main/Token.sol",
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() =>
                        setGithubUrl(`https://github.com/${ex}`)
                      }
                      className="rounded-md border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-500/40 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                    {loading
                      ? loadingLabel
                      : "Up to 20 .sol files · max 80 KB combined"}
                  </p>
                  <button
                    onClick={handleScanRepo}
                    disabled={!canSubmitGithub}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5 fill-current"
                          aria-hidden="true"
                        >
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        Scan Repository
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-600 dark:text-red-400">
              <span className="font-semibold">Error: </span>
              {error}
            </div>
          )}

          {/* Report */}
          {report && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Vulnerability Report
                  </h2>
                  {activeModel && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                          {activeModel}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Fetched files badge strip */}
                {fetchedFiles.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
                      {fetchedFiles.length} file{fetchedFiles.length !== 1 ? "s" : ""} scanned:
                    </span>
                    {fetchedFiles.map((f) => (
                      <span
                        key={f}
                        className="rounded px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60"
                      >
                        {f.split("/").pop()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ReportCard report={report} />
            </div>
          )}
        </main>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-[11px] text-zinc-400 dark:text-zinc-700">
          AuditScope — built for hackathon · no data stored · stateless
        </footer>
      </div>
    </div>
  );
}
