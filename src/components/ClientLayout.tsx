'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from './AppShell';
import NavBar from './NavBar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/auth') {
      router.replace('/auth');
    }
    if (user && pathname === '/auth') {
      router.replace('/study');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60 text-sm">読み込み中…</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <AppShell>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </AppShell>
  );
}
