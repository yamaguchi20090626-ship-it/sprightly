import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { WordProvider } from '@/context/WordContext';
import { SettingsProvider } from '@/context/SettingsContext';
import AppShell from '@/components/AppShell';
import NavBar from '@/components/NavBar';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'Sprightly — 英単語フラッシュカード',
  description: 'Ankiスタイルの間隔反復で英単語を効率的に記憶するWebアプリ',
  openGraph: {
    title: 'Sprightly',
    description: '英単語をスマートに暗記',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">
        <WordProvider>
          <SettingsProvider>
            <AppShell>
              <NavBar />
              <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
            </AppShell>
          </SettingsProvider>
        </WordProvider>
      </body>
    </html>
  );
}
