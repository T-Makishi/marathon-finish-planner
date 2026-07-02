import type { OfficialRaceData } from "../raceData";
import { fukuokaMarathon } from "./fukuoka-marathon";
import { hokkaidoMarathon } from "./hokkaido-marathon";
import { kanazawaMarathon } from "./kanazawa-marathon";
import { kobeMarathon } from "./kobe-marathon";
import { kyotoMarathon } from "./kyoto-marathon";
import { mccUrlRaceTemplates } from "./mcc-url-race-templates";
import { nagoyaWomensMarathon } from "./nagoya-womens-marathon";
import { nahaMarathon } from "./naha-marathon";
import { osakaMarathon } from "./osaka-marathon";
import { tokyoMarathon } from "./tokyo-marathon";
import { toyamaMarathon } from "./toyama-marathon";
import { yokohamaMarathon } from "./yokohama-marathon";

const curatedRaceData: OfficialRaceData[] = [
  nahaMarathon,
  toyamaMarathon,
  hokkaidoMarathon,
  fukuokaMarathon,
  tokyoMarathon,
  kyotoMarathon,
  kobeMarathon,
  nagoyaWomensMarathon,
  kanazawaMarathon,
  yokohamaMarathon,
  osakaMarathon
];

const curatedSlugs = new Set(curatedRaceData.map((race) => race.slug));

export const RACE_DATA_LIST: OfficialRaceData[] = [
  ...curatedRaceData,
  ...mccUrlRaceTemplates.filter((race) => !curatedSlugs.has(race.slug))
];
