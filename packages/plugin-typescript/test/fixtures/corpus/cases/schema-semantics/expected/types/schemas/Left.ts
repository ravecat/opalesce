import type { Right } from "./Right.js";
export type Left = {
  right?: Right;
  [key: string]: unknown;
};
