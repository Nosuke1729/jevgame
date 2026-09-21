import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JEV // 読み合いの闘技場",
  description: "あなたの癖を読むAIと戦う、2D対戦アクションゲーム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
