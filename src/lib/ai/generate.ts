import { validateQuerySemantics } from "./code-query-rules";
import {
  buildSystemPrompt,
  buildUserPrompt,
  CODE_GENERATION_RULES,
} from "./prompts";
import { createLlmClient, getLlmModel, isLlmConfigured } from "./client";

const FORBIDDEN_IMPORTS = [
  "os",
  "sys",
  "subprocess",
  "socket",
  "requests",
  "urllib",
  "http",
  "ftplib",
  "smtplib",
  "pickle",
  "ctypes",
  "multiprocessing",
  "threading",
  "shutil",
  "pathlib",
  "builtins",
];

const FORBIDDEN_SQL = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bCREATE\b/i,
  /\bALTER\b/i,
  /\bTRUNCATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i,
];

export interface CodeValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGeneratedCode(
  code: string,
  options?: { description?: string }
): CodeValidationResult {
  const errors: string[] = [];

  if (!code.includes("def run(")) {
    errors.push("缺少入口函数 def run(query)");
  }

  for (const imp of FORBIDDEN_IMPORTS) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*(?:import\\s+${imp}|from\\s+${imp}\\s+import)`,
      "m"
    );
    if (pattern.test(code)) {
      errors.push(`禁止 import: ${imp}`);
    }
  }

  if (/\beval\s*\(/.test(code) || /\bexec\s*\(/.test(code)) {
    errors.push("禁止使用 eval/exec");
  }

  if (/\bopen\s*\(/.test(code)) {
    errors.push("禁止使用 open() 文件操作");
  }

  // 静态 SQL 检查（生成阶段第一道防线）
  const sqlStrings = code.match(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  for (const s of sqlStrings) {
    const inner = s.slice(1, -1);
    if (/\bSELECT\b/i.test(inner)) {
      for (const pattern of FORBIDDEN_SQL) {
        if (pattern.test(inner)) {
          errors.push(`SQL 包含禁止关键字: ${inner.slice(0, 80)}`);
        }
      }
    }
  }

  errors.push(...validateQuerySemantics(code, options?.description));

  return { valid: errors.length === 0, errors };
}

export async function generateRuleCode(
  description: string,
  ruleId: string
): Promise<{ code: string; validation: CodeValidationResult }> {
  if (!isLlmConfigured()) {
    // 无 API Key 时返回模板代码供开发调试
    const stub = buildStubCode(description, ruleId);
    return { code: stub, validation: validateGeneratedCode(stub, { description }) };
  }

  const client = createLlmClient();
  const response = await client.chat.completions.create({
    model: getLlmModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(description, ruleId) },
    ],
  });

  let code = response.choices[0]?.message?.content?.trim() ?? "";
  //  strip markdown fences if present
  code = code.replace(/^```(?:python)?\n?/i, "").replace(/\n?```$/i, "");

  const validation = validateGeneratedCode(code, { description });
  return { code, validation };
}

function buildStubCode(description: string, ruleId: string): string {
  return `# Auto-generated stub (configure LLM_API_KEY for real generation)
# Rule: ${description.slice(0, 100)}

from datetime import datetime

def run(query):
    now = datetime.utcnow()

    # type=1 稀有物品掉落；用户未指定时间范围时不传 from/to
    news = query.fetch_ingamenews({"type": 1})

    # 按角色名 subject 统计
    player_counts = {}
    for row in news:
        name = row.get("subject")
        if not name:
            continue
        player_counts[name] = player_counts.get(name, 0) + 1

    suspicious = []
    for name, count in player_counts.items():
        if count >= 5:
            suspicious.append({
                "playerId": str(name),
                "playerName": str(name),
                "score": min(100, count * 10),
                "reasons": [f"稀有掉落公告 {count} 次"],
            })

    suspicious.sort(key=lambda x: x["score"], reverse=True)

    return {
        "version": "1.0",
        "ruleId": "${ruleId}",
        "executedAt": now.isoformat() + "Z",
        "summary": f"发现 {len(suspicious)} 名可疑玩家（稀有掉落≥5次，全量扫描）",
        "totalScanned": len(news),
        "suspiciousPlayers": suspicious[:50],
        "metadata": {"type": 1},
    }
`;
}

export { CODE_GENERATION_RULES };
