'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/add', label: '追加' },
  { href: '/study', label: '学習' },
  { href: '/words', label: '一覧' },
  { href: '/progress', label: '進捗' },
  { href: '/settings', label: '設定' },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-nav)' }}>
      <div className="max-w-2xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-sky-400 text-lg mr-6">Sprightly</span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-sky-600 text-white'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
