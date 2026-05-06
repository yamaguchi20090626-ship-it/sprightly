'use client';

import { useRouter } from 'next/navigation';
import { useSettings, useSettingsDispatch, type FontSize } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { getDailyNewCount } from '@/lib/dailyLimit';

const fontSizes: Array<{ value: FontSize; label: string }> = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
];

export default function SettingsPage() {
  const settings = useSettings();
  const dispatch = useSettingsDispatch();
  const { signOut } = useAuth();
  const router = useRouter();
  const todayNewCount = getDailyNewCount();

  async function handleSignOut() {
    await signOut();
    router.push('/auth');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">設定</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">1日の新規出題数</h2>
        <p className="text-xs text-gray-600">
          1日に初めて出題する新規単語の上限。学習中・復習カードは制限なし。
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={200}
            value={settings.newCardsPerDay}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n > 0) dispatch({ type: 'SET_NEW_CARDS_PER_DAY', count: n });
            }}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-sm text-gray-700 font-medium">語 / 日</span>
        </div>
        <p className="text-xs text-gray-600">
          本日の新規出題済み: <span className="font-bold text-gray-900">{todayNewCount}</span> 語
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">目標単語数</h2>
        <p className="text-xs text-gray-600">習得済みの単語がこの数に達したら目標達成です。</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={9999}
            value={settings.goalCount}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n > 0) dispatch({ type: 'SET_GOAL', count: n });
            }}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-sm text-gray-700 font-medium">語</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">文字サイズ</h2>
        <div className="flex gap-2">
          {fontSizes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => dispatch({ type: 'SET_FONT_SIZE', size: value })}
              className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
                settings.fontSize === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">現在: <span className="font-semibold text-gray-900">{fontSizes.find(f => f.value === settings.fontSize)?.label}</span></p>
      </div>

      <button
        onClick={handleSignOut}
        className="mx-auto block text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        ログアウト
      </button>
    </div>
  );
}
