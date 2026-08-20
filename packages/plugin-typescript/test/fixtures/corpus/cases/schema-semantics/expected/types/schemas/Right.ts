import type { Left } from "./Left.js";
export type Right = {
  left?: Left;
  [key: string]: unknown;
};
