export type CommandsExecuteMessage = {
  payload: CommandsExecutePayload;
};
export type CommandsExecutePayload = {
  command: string;
  [key: string]: unknown;
};
