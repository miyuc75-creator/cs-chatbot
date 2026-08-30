export interface FaqCsvRow {
  番号: string;
  カテゴリ: string;
  質問: string;
  回答: string;
}

export interface FaqRecord {
  question: string;
  answer: string;
  category: string;
}
