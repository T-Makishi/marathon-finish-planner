import { RACE_DATA_LIST } from "./races";

export type RaceDataCategory = "full" | "half" | "ultra" | "other";
export type RaceDataStatus = "verified" | "partially-verified" | "previous-year" | "unverified" | "awaiting-official";
export type DataConfidence = "high" | "medium" | "low" | "unknown";
export type RaceDataDifficulty = "easy" | "normal" | "hard" | "very-hard" | "unknown";
export type RaceDataTerrain = "flat" | "uphill" | "downhill" | "rolling" | "mixed" | "unknown";

export type RaceDataSource = {
  title: string;
  url: string;
  type: "official-web" | "official-pdf";
  accessedAt: string;
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

export type OfficialRaceData = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  prefecture: string;
  city?: string;
  eventDate?: string | null;
  category: RaceDataCategory;
  distanceKm: number;
  startLocation?: string | null;
  finishLocation?: string | null;
  startTime?: string | null;
  timeLimitMinutes?: number | null;
  mccMember?: boolean | null;
  startType?: "single" | "wave" | "unknown";
  courseDifficulty?: RaceDataDifficulty;
  courseSummary?: string;
  checkpoints: RaceDataCheckpoint[];
  sections: RaceDataSection[];
  waterStations?: RaceDataWaterStation[];
  sources: RaceDataSource[];
  verificationStatus: RaceDataStatus;
  verifiedAt?: string | null;
  notes?: string[];
};

export const OFFICIAL_RACE_DATA: OfficialRaceData[] = RACE_DATA_LIST;
