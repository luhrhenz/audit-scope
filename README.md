# AuditScope

A smart contract security audit scoping tool. Paste any Solidity contract and get back a structured vulnerability report in seconds — powered by LLMs with deep security reasoning.

Built for the hackathon.

---

## What it does

- **Contract Summary** — plain-English explanation of what the contract does
- **Attack Surface** — every external/public function with its modifiers
- **Modifier Map** — side-by-side modifier comparison to catch asymmetries (e.g. `releaseFunds()` has `noDispute` but `refundBuyer()` doesn't)
- **Risk Areas** — high/medium/low findings with exact attack paths and fix recommendations
- **Key Variables & State** — critical storage variables and their risk implications
- **Audit Focus** — top actionable priorities for a human auditor
- **Vulnerability Patterns** — 13 known patterns checked against the actual contract logic (reentrancy, access control, flash loans, signature replay, etc.)

---

## Stack

- **Framework** — Next.js 16 (App Router, TypeScript)
- **Styling** — Tailwind CSS, dark theme
- **AI Backend** — Groq API with automatic model rotation:
  - `qwen/qwen3-32b` (primary, odd requests)
  - `llama-3.3-70b-versatile` (primary, even requests)
  - `gemini-2.0-flash` (fallback if both Groq models fail)
- **Stateless** — no database, no auth, single-page tool

---

## Setup

**1. Clone the repo**

```bash
git clone https://github.com/luhrhenz/audit-scope.git
cd audit-scope
npm install
```

**2. Add your API keys**

Create a `.env.local` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your Groq key at [console.groq.com](https://console.groq.com)

**3. Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How it works

The AI follows an 8-step internal reasoning process before producing output:

1. **Modifier Map** — lists every function's modifiers, flags inconsistencies
2. **State Machine Analysis** — traces state variable desync bugs
3. **Access Control Audit** — checks who can call what and whether they should
4. **Asset Flow Tracing** — follows ETH/token movement end to end
5. **CEI Check** — verifies Checks-Effects-Interactions pattern before flagging reentrancy
6. **Boundary Validation** — constructor inputs, zero values, deadline edge cases
7. **Vulnerability Pattern Scan** — 13 known patterns checked against actual logic
8. **Modifier Map Table** — structured output for auditor review

Every finding names the exact function, variable, or modifier involved. Generic findings are not accepted.

---

## Notes

- Supports Solidity 0.4.x – 0.8.x
- Cairo support coming soon
- `.env.local` is gitignored — never committed
