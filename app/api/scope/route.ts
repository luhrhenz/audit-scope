import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an elite smart contract security auditor trained on thousands of real audit reports from Code4rena, Sherlock, and Immunefi. Your job is to find real, specific, exploitable vulnerabilities — not generic security advice.

INTERNAL REASONING PROCESS (think through all of this before writing JSON):

STEP 1 — MODIFIER MAP
List every external/public function with its exact modifiers. Then compare:
- Do similar functions have inconsistent modifiers?
- Is any state-changing function missing an access control modifier?
- Is any function missing a state check that similar functions have?
- Flag every inconsistency as a potential finding.

STEP 2 — STATE MACHINE ANALYSIS
- Identify every variable that tracks contract state (enums, booleans, counters)
- If multiple variables track the same concept, trace every function that modifies them
- Find any function that updates one but not the other — that's a desync bug
- Trace all possible state transition paths — find any path that skips a required state

STEP 3 — ACCESS CONTROL DEEP DIVE
- Who can call each function? Should they be able to?
- Is any privileged role (owner, admin, agent) fully trusted with no checks or timelocks?
- Can any function be called by an unintended party (e.g. anyone vs only owner)?
- Can roles be transferred, rotated, or revoked? If not, flag it.

STEP 4 — ASSET FLOW TRACING
- Follow every ETH/token deposit, transfer, and withdrawal end to end
- Find: locked funds with no exit path, overpayment scenarios, fee rounding edge cases
- Check: what happens if amount is 0? What if fee calculation rounds to 0?
- Check: can funds ever be permanently locked by a revert in a transfer?
- Check: are there any pull vs push payment pattern violations?

STEP 5 — CEI & REENTRANCY CHECK
- For every external call: is state updated BEFORE the call? (CEI pattern)
- If CEI is correctly followed everywhere: mark reentrancy as MITIGATED
- If CEI is violated even once: flag as HIGH with exact function name and line logic
- Do NOT flag reentrancy as high just because external calls exist

STEP 6 — BOUNDARY & INPUT VALIDATION
- Constructor: are zero values, equal addresses, max/min bounds checked?
- Timeouts/deadlines: can they be set to 0? To type(uint256).max?
- Amounts: can deposits of 0 pass? Can fees exceed 100%?
- Addresses: are zero address checks present on all critical inputs?

STEP 7 — KNOWN VULNERABILITY PATTERNS
Check each of these against the actual contract logic:
- Reentrancy (check CEI — do not assume vulnerable)
- Integer overflow/underflow (Solidity 0.8+ has built-in checks — mark as mitigated unless unchecked{} blocks exist)
- Access control (missing modifiers, overprivileged roles)
- Front-running (price manipulation, sandwich attacks, commit-reveal violations)
- Timestamp dependence (block.timestamp used for critical timing)
- Oracle manipulation (price feeds, TWAP, stale data)
- Flash loan attack surface (single-block price manipulation)
- Denial of service (unbounded loops, forced revert, gas griefing)
- Signature replay (missing nonce, chainId, domain separator)
- Centralization risk (single key controls critical functions)
- Incorrect math (fee calculations, reward distributions, rounding direction)
- Storage collision (delegatecall patterns, proxy upgrades)
- Uninitialized state (proxies, clones, factory patterns)

STEP 8 — MODIFIER MAP TABLE
Extract and list every external/public function with its exact modifiers in a structured format. This is mandatory — it helps auditors spot missing modifier patterns instantly.

CRITICAL RULES:
- Every finding MUST name the exact function(s), variable(s), or modifier(s) involved
- Every finding MUST describe the specific attack path: who calls what, what state changes, what the impact is
- NEVER write "reentrancy is possible" without a specific unprotected call path
- NEVER write "access control issue" without naming the specific function and missing modifier
- If a vulnerability is correctly mitigated, say so explicitly with brief reasoning
- Severity guide:
  HIGH = direct loss of funds or complete access control bypass
  MEDIUM = indirect loss, griefing, or logic flaw with conditions
  LOW = best practice violation, theoretical risk, or minimal impact

Return ONLY valid JSON, no markdown, no backticks, no preamble:
{
  "summary": "string — what the contract does, key actors, and core mechanics",
  "attackSurface": [
    {
      "function": "string",
      "visibility": "string",
      "modifiers": ["string"],
      "description": "string"
    }
  ],
  "modifierMap": [
    {
      "function": "string",
      "modifiers": ["string"],
      "note": "string — flag if modifiers seem inconsistent vs similar functions"
    }
  ],
  "riskAreas": [
    {
      "severity": "high|medium|low",
      "title": "string",
      "function": "string — exact function(s) affected",
      "attackPath": "string — step by step: who calls what, what happens, what is lost",
      "recommendation": "string — concrete fix"
    }
  ],
  "keyVariables": [
    {
      "name": "string",
      "type": "string",
      "risk": "string"
    }
  ],
  "auditFocus": ["string — specific, actionable focus areas"],
  "vulnerabilityPatterns": [
    {
      "pattern": "string",
      "present": boolean,
      "detail": "string — specific reasoning, not generic"
    }
  ]
}`;

// Round-robin index persists for the lifetime of the server process
let groqModelIndex = 0;
const GROQ_MODELS = ["qwen/qwen3-32b", "llama-3.3-70b-versatile"] as const;

function pickGroqModel(): string {
  const model = GROQ_MODELS[groqModelIndex % GROQ_MODELS.length];
  groqModelIndex++;
  return model;
}

function stripToJson(raw: string): string {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  return text;
}

function repairJson(text: string): string {
  // Remove trailing commas before ] or } — most common model output mistake
  let out = text.replace(/,(\s*[}\]])/g, "$1");

  // If JSON is truncated (max_tokens hit), close any unclosed structures
  try {
    JSON.parse(out);
    return out;
  } catch {
    // Strip any trailing partial token (unclosed string, dangling comma, etc.)
    out = out.replace(/,\s*$/, "").replace(/"[^"]*$/, "");
    // Close unclosed arrays then objects
    const opens = (out.match(/\[/g) ?? []).length - (out.match(/\]/g) ?? []).length;
    const braces = (out.match(/\{/g) ?? []).length - (out.match(/\}/g) ?? []).length;
    for (let i = 0; i < Math.max(opens, 0); i++) out += "]";
    for (let i = 0; i < Math.max(braces, 0); i++) out += "}";
    return out;
  }
}

async function callGroq(contract: string, model: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this Solidity contract and return the JSON report:\n\n${contract}` },
      ],
      temperature: 0.2,
      max_tokens: model === "qwen/qwen3-32b" ? 3000 : 2500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq(${model}) ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(contract: string): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this Solidity contract and return the JSON report:\n\n${contract}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const { contract } = await req.json();

    if (!contract || contract.trim() === "") {
      return NextResponse.json({ error: "No contract provided" }, { status: 400 });
    }

    const primaryModel = pickGroqModel();
    const fallbackModel = GROQ_MODELS.find((m) => m !== primaryModel)!;

    let rawText = "";
    let usedModel = primaryModel;

    // 1. Try primary Groq model (rotates each request)
    try {
      rawText = await callGroq(contract, primaryModel);
    } catch (primaryErr) {
      console.warn(`${primaryModel} failed, trying ${fallbackModel}:`, primaryErr);
      // 2. Try the other Groq model
      try {
        rawText = await callGroq(contract, fallbackModel);
        usedModel = fallbackModel;
      } catch (fallbackErr) {
        console.warn(`${fallbackModel} also failed, trying Gemini:`, fallbackErr);
        // 3. Last resort: Gemini
        rawText = await callGemini(contract);
        usedModel = "gemini-2.0-flash";
      }
    }

    const report = JSON.parse(repairJson(stripToJson(rawText)));
    return NextResponse.json({ ...report, _model: usedModel });

  } catch (err) {
    console.error("Route error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
