import type { Event } from "../schemas/Event.js";
export type EventCreatedMessage = {
  payload: EventCreatedPayload;
};
export type EventCreatedPayload = Event;
