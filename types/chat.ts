import type {
  ConversationCategory,
  ConversationStatus,
  MessageSender,
} from "./database";

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  createdAt: string;
}

export interface ChatSendRequest {
  conversationId: string | null;
  message: string;
}

export interface ChatSendResponse {
  conversationId: string;
  status: ConversationStatus;
  category: ConversationCategory | null;
  reply: ChatMessage;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason:
    | "customer_requested"
    | "complaint"
    | "undetermined_category"
    | "no_faq_match"
    | "low_confidence"
    | "return_action"
    | null;
}
