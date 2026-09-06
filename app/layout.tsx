import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '数模版本站',
  description: '数学建模竞赛团队的论文、代码与数据版本日志',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
