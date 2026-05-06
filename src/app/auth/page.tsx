'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const errMsg = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (errMsg) {
      setError(errMsg);
    } else if (mode === 'signup') {
      setMessage('確認メールを送信しました。メールを確認してからログインしてください。');
    } else {
      router.push('/study');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Sprightly</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          {mode === 'login' ? 'アカウントにログイン' : '新規アカウント作成'}
        </p>

        {message && (
          <div className="bg-green-50 text-green-700 rounded-lg p-4 mb-4 text-sm">{message}</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '処理中…' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
          className="mt-6 w-full text-center text-sm text-indigo-600 hover:underline"
        >
          {mode === 'login' ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方はこちら'}
        </button>
      </div>
    </div>
  );
}
