export type Base = {
  /**
   * @readOnly
   */
  readonly id: string;
  note?: string | null;
  /**
   * bad *\/ export type Injected = never;
   * @writeOnly
   */
  secret: string;
  "unsafe-key": "a" | "b";
};
