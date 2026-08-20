import type { CommandsExecuteMessage } from "../messages/CommandsExecute.js";
import type { RepliesAcceptedMessage } from "../messages/RepliesAccepted.js";
import type { RepliesRejectedMessage } from "../messages/RepliesRejected.js";
export type ExecuteCommandMessage = CommandsExecuteMessage;
export type ExecuteCommandReplyMessage = RepliesAcceptedMessage | RepliesRejectedMessage;
