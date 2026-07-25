import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "마케팅 워크플로",
    template: "%s · 마케팅 워크플로",
  },
  description:
    "마케팅팀의 프로젝트, 업무 흐름, 대기 사항과 후속 업무를 관리하는 협업 도구",
};

// Native app feel: color-adaptive chrome, no user-scaling jank on controls.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
    { media: "(prefers-color-scheme: dark)", color: "#121215" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Root layout. Establishes the design system's typographic foundation:
 * Pretendard as the primary Korean/UI web font (loaded via CDN in globals.css),
 * falling back to the platform system font (SF on Apple) for coverage — exposed
 * as the CSS variables globals.css / tailwind consume (--font-sans, --font-mono).
 * Pretendard matches the SF/Apple SD Gothic Neo metrics closely, so Latin and
 * Hangul share one consistent, legibility-tuned look (apple-design §15).
 */
const fontVars = {
  "--font-sans":
    '"Pretendard", "Pretendard Variable", -apple-system, BlinkMacSystemFont, ' +
    '"SF Pro Text", "SF Pro Display", "Apple SD Gothic Neo", "Segoe UI", Roboto, ' +
    '"Noto Sans KR", "Malgun Gothic", system-ui, sans-serif',
  "--font-mono":
    'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", ' +
    'Menlo, Consolas, monospace',
} as React.CSSProperties;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" style={fontVars} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}
