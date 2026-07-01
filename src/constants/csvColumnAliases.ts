import { TrainingCsvField } from "../types/training";

export const CSV_COLUMN_ALIASES: Record<TrainingCsvField, string[]> = {
  date: ["date", "日付", "start time", "activity date", "activity_date", "start_time", "開始日時"],
  distance: ["distance", "距離", "distance (km)", "distance(km)", "距離(km)", "distance_km", "kilometers", "km"],
  duration: ["time", "duration", "経過時間", "elapsed time", "moving time", "elapsed_time", "moving_time", "activity_time"],
  activityType: ["type", "activity type", "activity_type", "種目", "アクティビティ", "sport", "sport_type"],
  heartRate: ["heart_rate", "heart rate", "avg hr", "average heart rate", "average_heart_rate", "平均心拍", "平均心拍数"],
  memo: ["note", "notes", "memo", "メモ", "description", "comments", "コメント"]
};

export function normalizeCsvColumnName(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "")
    .replace(/[()（）]/g, "");
}

export function detectTrainingColumns(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: normalizeCsvColumnName(header) }));
  const mapping: Partial<Record<TrainingCsvField, string>> = {};
  (Object.keys(CSV_COLUMN_ALIASES) as TrainingCsvField[]).forEach((field) => {
    const aliases = CSV_COLUMN_ALIASES[field].map(normalizeCsvColumnName);
    const match = normalizedHeaders.find((header) => aliases.includes(header.normalized));
    if (match) mapping[field] = match.raw;
  });
  return mapping;
}
