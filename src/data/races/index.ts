import type { OfficialRaceData } from "../raceData";
import { fukuokaMarathon } from "./fukuoka-marathon";
import { hokkaidoMarathon } from "./hokkaido-marathon";
import { kanazawaMarathon } from "./kanazawa-marathon";
import { kobeMarathon } from "./kobe-marathon";
import { kyotoMarathon } from "./kyoto-marathon";
import { nahaMarathon } from "./naha-marathon";
import { osakaMarathon } from "./osaka-marathon";
import { tokyoMarathon } from "./tokyo-marathon";
import { toyamaMarathon } from "./toyama-marathon";
import { yokohamaMarathon } from "./yokohama-marathon";

export const RACE_DATA_LIST: OfficialRaceData[] = [
  nahaMarathon,
  toyamaMarathon,
  hokkaidoMarathon,
  fukuokaMarathon,
  tokyoMarathon,
  kyotoMarathon,
  kobeMarathon,
  kanazawaMarathon,
  yokohamaMarathon,
  osakaMarathon
];
