/** 用户规则描述是否明确提到时间范围 */
export function userMentionedTimeRange(description: string): boolean {
  return /(?:\d+\s*(?:天|日|周|月|小时)|最近|过去|本周|上周|今天|昨天|本月|天内|以内|之内|小时前)/i.test(
    description
  );
}

/** 用户是否明确要分析 MVP 击杀（type=0） */
export function userWantsMvpKill(description: string): boolean {
  return /MVP|击杀\s*boss|boss\s*击杀|击杀公告|\btype\s*0\b/i.test(description);
}

/**
 * 校验 fetch_ingamenews 语义：默认 type=1 全量；仅用户指定时才限时间
 */
export function validateQuerySemantics(
  code: string,
  description?: string
): string[] {
  const errors: string[] = [];
  const usesFetch = /fetch_ingamenews|fetch_announcements/.test(code);
  if (!usesFetch) return errors;

  const wantsMvp =
    description !== undefined ? userWantsMvpKill(description) : false;

  if (!wantsMvp) {
    if (
      /\btype\s*[=:]\s*0\b|"type"\s*:\s*0\b|'type'\s*:\s*0\b/.test(code)
    ) {
      errors.push(
        "禁止 type=0（MVP/Boss 击杀）。用户说的「打怪」指刷怪产生的 type=1 稀有掉落，必须 type=1"
      );
    }
    if (
      /\btype\s*[=:]\s*2\b|"type"\s*:\s*2\b|'type'\s*:\s*2\b/.test(code)
    ) {
      errors.push("禁止 type=2，除非用户明确要分析偷窃公告");
    }
    if (!/\btype\s*[=:]\s*1\b|"type"\s*:\s*1\b|'type'\s*:\s*1\b/.test(code)) {
      errors.push("fetch_ingamenews 必须传 type=1（稀有物品掉落）");
    }
  }

  if (description !== undefined && !userMentionedTimeRange(description)) {
    const fetchCalls =
      code.match(/fetch_(?:ingamenews|announcements)\s*\([\s\S]*?\)/g) ?? [];
    for (const block of fetchCalls) {
      if (
        /["']from["']\s*:|["']to["']\s*:|(?:[{,]\s*)from\s*=|(?:[{,]\s*)to\s*=/.test(
          block
        )
      ) {
        errors.push(
          "用户未指定时间范围：fetch_ingamenews 不得传 from/to，应查全量历史（仅 type=1）"
        );
        break;
      }
    }

    if (/timedelta\s*\(\s*days\s*=/.test(code) && usesFetch) {
      errors.push(
        "用户未指定时间：禁止 timedelta 自行截取窗口，应查全量（不要默认今天/7天/30天）"
      );
    }
    if (/replace\s*\(\s*hour\s*=\s*0/.test(code) && usesFetch) {
      errors.push("用户未指定时间：禁止「今日零点」起查，应查全量");
    }
    if (/strftime\s*\(\s*['"]%Y-%m-%d/.test(code) && usesFetch) {
      errors.push("用户未指定时间：禁止按当天日期过滤，应查全量");
    }
  }

  return errors;
}
