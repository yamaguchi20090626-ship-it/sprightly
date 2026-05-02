import WordForm from '@/components/WordForm';
import CsvImport from '@/components/CsvImport';

export default function AddPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white mb-6">単語を追加</h1>
        <WordForm />
      </div>
      <CsvImport />
    </div>
  );
}
