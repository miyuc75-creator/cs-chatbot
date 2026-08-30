export type ConversationStatus =
  | "ai_active"
  | "waiting_operator"
  | "operator_active"
  | "completed";

export type ConversationCategory =
  | "return_exchange"
  | "product_question"
  | "general_question"
  | "complaint"
  | "undetermined";

export type MessageSender = "customer" | "ai" | "operator";

export interface ConversationRow {
  id: string;
  customer_id: string;
  status: ConversationStatus;
  category: ConversationCategory | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: MessageSender;
  content: string;
  created_at: string;
}

export interface KnowledgeItemRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  embedding: number[] | null;
  created_at: string;
}

export interface OperatorRow {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface MatchKnowledgeItemResult {
  id: string;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: ConversationRow;
        Insert: Partial<ConversationRow> & { customer_id: string };
        Update: Partial<ConversationRow>;
      };
      messages: {
        Row: MessageRow;
        Insert: Partial<MessageRow> & {
          conversation_id: string;
          sender: MessageSender;
          content: string;
        };
        Update: Partial<MessageRow>;
      };
      knowledge_items: {
        Row: KnowledgeItemRow;
        Insert: Partial<KnowledgeItemRow> & {
          question: string;
          answer: string;
          category: string;
        };
        Update: Partial<KnowledgeItemRow>;
      };
      operators: {
        Row: OperatorRow;
        Insert: Partial<OperatorRow> & { id: string; email: string; name: string };
        Update: Partial<OperatorRow>;
      };
    };
    Functions: {
      match_knowledge_items: {
        Args: { query_embedding: number[]; match_count?: number };
        Returns: MatchKnowledgeItemResult[];
      };
    };
  };
}
