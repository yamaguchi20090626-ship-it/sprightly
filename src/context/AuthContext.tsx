'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません';
  if (msg.includes('Email not confirmed')) return 'メールアドレスの確認が完了していません。確認メールをご確認ください';
  if (msg.includes('User already registered')) return 'このメールアドレスはすでに登録されています';
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で入力してください';
  if (msg.includes('Unable to validate email address')) return 'メールアドレスの形式が正しくありません';
  if (msg.includes('Email rate limit exceeded')) return 'しばらく時間をおいてから再試行してください';
  if (msg.includes('over_email_send_rate_limit')) return 'しばらく時間をおいてから再試行してください';
  return 'エラーが発生しました。もう一度お試しください';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  sendResetEmail: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => null,
  signIn: async () => null,
  signOut: async () => {},
  deleteAccount: async () => null,
  sendResetEmail: async () => null,
  updatePassword: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? translateAuthError(error.message) : null;
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? translateAuthError(error.message) : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendResetEmail(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    });
    return error ? translateAuthError(error.message) : null;
  }

  async function updatePassword(password: string): Promise<string | null> {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? translateAuthError(error.message) : null;
  }

  async function deleteAccount(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'ログインが必要です';

    const res = await fetch('/api/delete-account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.error ?? '削除に失敗しました';
    }
    await supabase.auth.signOut();
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, deleteAccount, sendResetEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
