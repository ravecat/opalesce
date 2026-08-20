export type EventsEventHeaders = {
  traceId: string;
  [key: string]: unknown;
};
export type EventsEventMessage = {
  payload: EventsEventPayload;
  headers: EventsEventHeaders;
};
export type EventsEventPayload = string;
