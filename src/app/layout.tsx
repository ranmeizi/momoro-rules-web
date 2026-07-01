import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Momoro Rules — 可疑玩家分析平台",
  description: "用自然语言定义规则，AI 生成代码，分析稀有掉落公告数据",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
