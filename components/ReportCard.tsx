"use client";

import React from "react";

interface AttackSurfaceItem {
  function: string;
  visibility: string;
  modifiers: string[];
  description: string;
}

interface ModifierMapItem {
  function: string;
  modifiers: string[];
  note: string;
}

interface RiskArea {
  severity: "high" | "medium" | "low";
  title: string;
  function: string;
  attackPath: string;
  recommendation: string;
}

interface KeyVariable {
  name: string;
  type: string;
  risk: string;
}

interface VulnPattern {
  pattern: string;
  present: boolean;
  detail: string;
}

export interface AuditReport {
  summary: string;
  attackSurface: AttackSurfaceItem[];
  modifierMap: ModifierMapItem[];
  riskAreas: RiskArea[];
  keyVariables: KeyVariable[];
  auditFocus: string[];
  vulnerabilityPatterns: VulnPattern[];
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/8",
  medium: "border-yellow-500/30 bg-yellow-500/8",
  low: "border-green-500/30 bg-green-500/8",
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-400",
  low: "bg-green-500",
};

function Section({
  title,
  icon,
  children,
  fullWidth,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-zinc-700/60 bg-zinc-900 p-5 flex flex-col gap-3${fullWidth ? " lg:col-span-2" : ""}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
        <span className="text-base">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Modifier({ label }: { label: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-zinc-700/60 text-zinc-300 border border-zinc-600/40">
      {label}
    </span>
  );
}

export default function ReportCard({ report }: { report: AuditReport }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

      {/* Summary */}
      <div className="lg:col-span-2">
        <Section title="Contract Summary" icon="📋">
          <p className="text-sm leading-relaxed text-zinc-300">{report.summary}</p>
        </Section>
      </div>

      {/* Risk Areas — full width, most important */}
      <div className="lg:col-span-2">
        <Section title="Risk Areas" icon="⚠️">
          <div className="flex flex-col gap-3">
            {report.riskAreas.map((r, i) => (
              <div key={i} className={`rounded-lg border px-4 py-3 flex flex-col gap-2 ${SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.low}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${SEVERITY_BADGE[r.severity] ?? SEVERITY_BADGE.low}`}>
                    {r.severity}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100">{r.title}</span>
                  <code className="ml-auto text-[11px] text-violet-400 font-mono">{r.function}</code>
                </div>
                <div className="flex flex-col gap-1 pl-1">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wide mr-1">Attack path</span>
                    {r.attackPath}
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <span className="font-semibold text-zinc-500 uppercase text-[10px] tracking-wide mr-1">Fix</span>
                    {r.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Attack Surface */}
      <Section title="Attack Surface" icon="🔌">
        <div className="flex flex-col gap-2">
          {report.attackSurface.map((fn, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg bg-zinc-800 px-3 py-2.5 border border-zinc-700/40">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-bold text-violet-400">{fn.function}()</code>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {fn.visibility}
                </span>
                {fn.modifiers?.map((m, j) => <Modifier key={j} label={m} />)}
              </div>
              <p className="text-xs text-zinc-400">{fn.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Modifier Map */}
      <Section title="Modifier Map" icon="🗺️">
        <div className="flex flex-col gap-2">
          {report.modifierMap?.map((m, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg bg-zinc-800 px-3 py-2 border border-zinc-700/40">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-bold text-cyan-400">{m.function}()</code>
                {m.modifiers.length > 0
                  ? m.modifiers.map((mod, j) => <Modifier key={j} label={mod} />)
                  : <span className="text-[10px] text-zinc-600 italic">no modifiers</span>
                }
              </div>
              {m.note && (
                <p className="text-[11px] text-zinc-500 pl-0.5">{m.note}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Key Variables */}
      <Section title="Key Variables & State" icon="🗄️">
        <div className="flex flex-col gap-2">
          {report.keyVariables.map((v, i) => (
            <div key={i} className="flex flex-col gap-0.5 rounded-lg bg-zinc-800 px-3 py-2 border border-zinc-700/40">
              <div className="flex items-center gap-2">
                <code className="text-xs font-bold text-cyan-400">{v.name}</code>
                <span className="text-[10px] text-zinc-500 font-mono">{v.type}</span>
              </div>
              <p className="text-xs text-zinc-400">{v.risk}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Audit Focus */}
      <Section title="Suggested Audit Focus" icon="🎯">
        <ol className="flex flex-col gap-1.5">
          {report.auditFocus.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[10px] font-bold text-violet-400 border border-violet-500/30">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </Section>

      {/* Vulnerability Patterns — full width */}
      <div className="lg:col-span-2">
        <Section title="Vulnerability Patterns" icon="🛡️">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {report.vulnerabilityPatterns.map((v, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 border ${
                  v.present
                    ? "bg-red-500/8 border-red-500/25"
                    : "bg-zinc-800/60 border-zinc-700/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm ${v.present ? "text-red-400" : "text-zinc-500"}`}>
                    {v.present ? "✗" : "✓"}
                  </span>
                  <span className={`text-xs font-semibold ${v.present ? "text-red-300" : "text-zinc-400"}`}>
                    {v.pattern}
                  </span>
                </div>
                <p className="pl-5 text-[11px] text-zinc-500">{v.detail}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

    </div>
  );
}
