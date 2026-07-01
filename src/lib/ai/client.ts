import OpenAI from "openai";

/** 百炼 DashScope OpenAI 兼容模式 */
const BAILIAN_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export function getLlmApiKey(): string | undefined {
  return (
    process.env.LLM_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    process.env.OPENAI_API_KEY
  );
}

export function getLlmBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? BAILIAN_BASE_URL;
}

export function getLlmModel(): string {
  return (
    process.env.LLM_MODEL ??
    process.env.OPENAI_MODEL ??
    "qwen-plus"
  );
}

export function isLlmConfigured(): boolean {
  const key = getLlmApiKey();
  if (!key) return false;
  const placeholders = ["sk-...", "your-api-key", "change-me"];
  return !placeholders.some((p) => key === p || key.startsWith(p));
}

export function createLlmClient(): OpenAI {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error("LLM API Key 未配置");

  return new OpenAI({
    apiKey,
    baseURL: getLlmBaseUrl(),
  });
}
