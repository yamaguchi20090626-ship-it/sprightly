'use client';

import { useSettings } from '@/context/SettingsContext';

const fontClass = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' } as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { fontSize } = useSettings();
  return <div className={fontClass[fontSize]}>{children}</div>;
}
