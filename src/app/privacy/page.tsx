import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'プライバシーポリシー — WordPocket',
};

export default function PrivacyPage() {
  const updated = '2026年5月14日';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/auth" className="text-indigo-400 text-sm hover:underline">← WordPocketへ戻る</Link>

        <h1 className="text-2xl font-bold text-white mt-6 mb-2">プライバシーポリシー</h1>
        <p className="text-slate-400 text-sm mb-8">最終更新日：{updated}</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">1. 収集する情報</h2>
          <p className="text-slate-300 leading-relaxed">
            WordPocket（以下「本アプリ」）は、アカウント登録・ログインのためにメールアドレスを収集します。
            その他、学習データ（登録単語・学習履歴）はアカウントに紐づけて保存されます。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">2. 情報の利用目的</h2>
          <ul className="list-disc list-inside text-slate-300 leading-relaxed space-y-1">
            <li>アカウントの認証・ログイン</li>
            <li>学習データの保存・同期</li>
            <li>サービスに関する重要なお知らせの送信（必要な場合のみ）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">3. 情報の保管</h2>
          <p className="text-slate-300 leading-relaxed">
            収集した情報は、Supabase, Inc.（米国）が提供するデータベースサービスを通じて保管されます。
            Supabaseのプライバシーポリシーは{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              supabase.com/privacy
            </a>{' '}
            をご参照ください。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">4. 第三者への提供</h2>
          <p className="text-slate-300 leading-relaxed">
            収集した個人情報を、法令に基づく場合を除き、第三者に販売・提供・開示することはありません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">5. データの削除</h2>
          <p className="text-slate-300 leading-relaxed">
            アカウントおよび関連するすべてのデータの削除を希望される場合は、アプリの設定画面から「アカウントを削除」を実行するか、
            下記メールアドレスまでご連絡ください。速やかに対応いたします。
          </p>
          <p className="mt-2">
            <a href="mailto:yamaguchi.20090626@gmail.com" className="text-indigo-400 hover:underline">
              yamaguchi.20090626@gmail.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">6. Cookieおよびローカルストレージ</h2>
          <p className="text-slate-300 leading-relaxed">
            本アプリはセッション管理のためにブラウザのローカルストレージを使用します。
            広告目的のCookieは使用しません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">7. 子どものプライバシー</h2>
          <p className="text-slate-300 leading-relaxed">
            本アプリは13歳未満の方を対象としておらず、13歳未満の方の個人情報を意図的に収集しません。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">8. ポリシーの変更</h2>
          <p className="text-slate-300 leading-relaxed">
            本ポリシーを変更する場合は、このページに最終更新日とともに掲載します。
            重要な変更の場合は、登録メールアドレスへの通知を行うことがあります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. お問い合わせ</h2>
          <p className="text-slate-300 leading-relaxed">
            プライバシーに関するご質問・ご要望は下記までご連絡ください。
          </p>
          <p className="mt-2">
            <a href="mailto:yamaguchi.20090626@gmail.com" className="text-indigo-400 hover:underline">
              yamaguchi.20090626@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
