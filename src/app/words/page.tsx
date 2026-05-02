import WordList from '@/components/WordList';
import ProgressStats from '@/components/ProgressStats';

export default function WordsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">単語一覧</h1>
      <ProgressStats />
      <WordList />
    </div>
  );
}
