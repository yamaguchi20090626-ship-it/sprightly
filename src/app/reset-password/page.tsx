'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }
    setError('');
    setLoading(true);
    const errMsg = await updatePassword(password);
    setLoading(false);
    if (errMsg) {
      setError(errMsg);
    } else {
      router.push('/study');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Sprightly</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">新しいパスワードを設定</p>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {loading ? '処理中…' : 'パスワードを変更する'}
          </button>
        </form>
      </div>
    </div>
  );
}
