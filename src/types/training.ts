export type TrainingSourceApp = "garmin" | "runkeeper" | "strava" | "other";

export type NormalizedActivityType = "running" | "walking" | "cycling" | "swimming" | "other";

export type TrainingActivity = {
  id: string;
  date: string;
  activityType: string;
  normalizedActivityType: NormalizedActivityType;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  averageHeartRate?: number;
  sourceApp: TrainingSourceApp;
  memo?: string;
  importedAt: string;
  importBatchId: string;
};

export type TrainingImportBatch = {
  id: string;
  importedAt: string;
  sourceApp: TrainingSourceApp;
  fileName?: string;
  totalRows: number;
  importedRows: number;
  excludedRows: number;
  duplicateRows: number;
};

export type TrainingCsvField = "date" | "distance" | "duration" | "activityType" | "heartRate" | "memo";

export type TrainingColumnMapping = Partial<Record<TrainingCsvField, string>>;

export type TrainingPreviewStatus = "取込予定" | "重複候補" | "主要集計対象外" | "除外" | "要確認";

export type ParsedTrainingPreviewRow = {
  index: number;
  raw: Record<string, string>;
  activity?: Omit<TrainingActivity, "id" | "importedAt" | "importBatchId" | "sourceApp">;
  status: TrainingPreviewStatus;
  duplicateKey?: string;
  reason?: string;
};

export type TrainingParseResult = {
  headers: string[];
  totalRows: number;
  limitExceededRows: number;
  mapping: TrainingColumnMapping;
  rows: ParsedTrainingPreviewRow[];
  recognizedColumns: string[];
  errors: string[];
};

export type TrainingSummary = {
  weekDistanceKm: number;
  monthDistanceKm: number;
  last30DistanceKm: number;
  last90DistanceKm: number;
  last30Count: number;
  last90Count: number;
  allCount: number;
  last30AveragePaceSec: number | null;
  last90AveragePaceSec: number | null;
  allLongestDistanceKm: number;
  last90LongestDistanceKm: number;
};

export type TrainingReadinessScore = {
  total: number;
  label: "順調" | "やや注意" | "準備を増やしたい" | "目標見直し推奨";
  details: {
    last30Distance: number;
    last90Distance: number;
    longestDistance: number;
    trainingCount: number;
    paceDiff: number;
    gateMargin: number;
  };
  suggestions: string[];
};
