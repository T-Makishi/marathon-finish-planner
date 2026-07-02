import { RACE_DATA_LIST } from "./races";

export type RaceDataCategory = "full" | "half" | "ultra" | "other";
export type RaceDataStatus = "verified" | "partially-verified" | "previous-year" | "unverified" | "awaiting-official" | "needs-review";
export type DataConfidence = "high" | "medium" | "low" | "unknown";
export type RaceDataDifficulty = "easy" | "normal" | "hard" | "very-hard" | "unknown";
export type RaceDataTerrain = "flat" | "uphill" | "downhill" | "rolling" | "mixed" | "unknown";
export type MccCategory = "MCC" | "HMCC" | "MCC100" | "other";
export type SourceUsageStatus = "allowed" | "public-facts-only" | "manual-review-required" | "prohibited" | "unknown";

export type RaceDataSource = {
  title: string;
  url: string;
  type: "official-web" | "official-pdf" | "official-api" | "open-data" | "mcc-list" | "manual-input";
  accessedAt: string;
  usageStatus?: SourceUsageStatus;
  usageNotes?: string[];
};

export type RaceDataCheckpoint = {
  id: string;
  name: string;
  distanceKm: number;
  closingTime?: string | null;
  elapsedLimitMinutes?: number | null;
  memo?: string;
};

export type RaceDataSection = {
  startKm: number;
  endKm: number;
  startElevationM?: number | null;
  endElevationM?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  terrain: RaceDataTerrain;
  description?: string;
  confidence?: DataConfidence;
};

export type RaceDataWaterStation = {
  distanceKm: number;
  name?: string;
  confidence?: DataConfidence;
};

export type RaceDataSupportPoint = {
  distanceKm: number;
  name: string;
  type: "retire-bus" | "medical" | "other";
  confidence?: DataConfidence;
};

export type OfficialRaceData = {
  id: string;
  slug: string;
  name: string;
  officialName?: string | null;
  year: number | null;
  prefecture: string;
  city?: string;
  eventDate?: string | null;
  officialEventDate?: string | null;
  mccListedDate?: string | null;
  dateConflict?: boolean;
  category: RaceDataCategory;
  distanceKm: number;
  startLocation?: string | null;
  finishLocation?: string | null;
  startTime?: string | null;
  timeLimitMinutes?: number | null;
  mccMember?: boolean | null;
  mccCategory?: MccCategory | null;
  startType?: "single" | "wave" | "unknown";
  courseDifficulty?: RaceDataDifficulty;
  courseSummary?: string;
  checkpoints: RaceDataCheckpoint[];
  sections: RaceDataSection[];
  waterStations?: RaceDataWaterStation[];
  supportPoints?: RaceDataSupportPoint[];
  sources: RaceDataSource[];
  verificationStatus: RaceDataStatus;
  publicationAllowed?: boolean;
  verifiedAt?: string | null;
  extractionWarnings?: string[];
  legalReviewNotes?: string[];
  notes?: string[];
};

export const OFFICIAL_RACE_DATA: OfficialRaceData[] = RACE_DATA_LIST;
