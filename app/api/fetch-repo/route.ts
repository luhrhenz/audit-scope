import { NextRequest, NextResponse } from "next/server";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 30_000;
const MAX_TOTAL_BYTES = 80_000;

interface ParsedUrl {
  owner: string;
  repo: string;
  kind: "blob" | "tree" | "repo";
  branch: string | null;
  subPath: string;
}

function parseGithubUrl(raw: string): ParsedUrl | null {
  try {
    const url = new URL(raw.trim());
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");

    if (parts.length === 2) {
      return { owner, repo, kind: "repo", branch: null, subPath: "" };
    }

    const kind = parts[2] as "blob" | "tree";
    const branch = parts[3] ?? null;
    const subPath = parts.slice(4).join("/");
    return { owner, repo, kind, branch, subPath };
  } catch {
    return null;
  }
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AuditScope/1.0",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: ghHeaders(),
  });
  if (!res.ok) return "main";
  const data = await res.json();
  return (data.default_branch as string) ?? "main";
}

async function fetchSolFiles(
  owner: string,
  repo: string,
  branch: string,
  filterPath: string
): Promise<Array<{ path: string; content: string }>> {
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders() }
  );

  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    const msg = (err as { message?: string }).message;
    if (treeRes.status === 404) throw new Error("Repository not found. Is it public?");
    if (treeRes.status === 403) throw new Error("GitHub rate limit reached. Try again in a minute.");
    throw new Error(msg ?? `GitHub API error: ${treeRes.status}`);
  }

  const tree = await treeRes.json();
  const items = (
    tree.tree as Array<{ path: string; type: string; size: number }>
  )
    .filter(
      (f) =>
        f.type === "blob" &&
        f.path.endsWith(".sol") &&
        f.size < MAX_FILE_BYTES &&
        (!filterPath || f.path.startsWith(filterPath))
    )
    .slice(0, MAX_FILES);

  if (items.length === 0) {
    throw new Error(
      filterPath
        ? `No Solidity (.sol) files found under "${filterPath}".`
        : "No Solidity (.sol) files found in this repository."
    );
  }

  // Fetch all files in parallel
  const fetched = await Promise.all(
    items.map(async (item) => {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`,
        { headers: ghHeaders() }
      );
      if (!res.ok) return null;
      return { path: item.path, content: await res.text() };
    })
  );

  // Accumulate up to the total size cap
  let total = 0;
  const results: Array<{ path: string; content: string }> = [];
  for (const f of fetched) {
    if (!f) continue;
    if (total + f.content.length > MAX_TOTAL_BYTES) break;
    total += f.content.length;
    results.push(f);
  }
  return results;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = (body as { url?: string }).url;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const parsed = parseGithubUrl(url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL. Paste a link like https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  try {
    let solFiles: Array<{ path: string; content: string }>;

    if (parsed.kind === "blob") {
      const branch = parsed.branch ?? "main";
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${parsed.subPath}`;
      const res = await fetch(rawUrl, { headers: ghHeaders() });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Could not fetch file. Is the repo public?" },
          { status: 404 }
        );
      }
      solFiles = [{ path: parsed.subPath, content: await res.text() }];
    } else {
      const branch =
        parsed.branch ?? (await getDefaultBranch(parsed.owner, parsed.repo));
      solFiles = await fetchSolFiles(
        parsed.owner,
        parsed.repo,
        branch,
        parsed.subPath
      );
    }

    const sep = "=".repeat(60);
    const combined = solFiles
      .map((f) => `// ${sep}\n// File: ${f.path}\n// ${sep}\n\n${f.content}`)
      .join("\n\n");

    return NextResponse.json({
      code: combined,
      fileCount: solFiles.length,
      files: solFiles.map((f) => f.path),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
