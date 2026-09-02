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

export type ConversationRow = {
  id: string;
  customer_id: string;
  status: ConversationStatus;
  category: ConversationCategory | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender: MessageSender;
  content: string;
  created_at: string;
};

export type KnowledgeItemRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  embedding: number[] | null;
  created_at: string;
};

export type OperatorRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export type MatchKnowledgeItemResult = {
  id: string;
  question: string;
  answer: string;
  category: string;
  similarity: number;
};

export type AppSettingsRow = {
  id: number;
  escalation_emails: string[];
  business_start_hour: number;
  business_end_hour: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: ConversationRow;
        Insert: Partial<ConversationRow> & { customer_id: string };
        Update: Partial<ConversationRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Partial<MessageRow> & {
          conversation_id: string;
          sender: MessageSender;
          content: string;
        };
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      knowledge_items: {
        Row: KnowledgeItemRow;
        Insert: Partial<KnowledgeItemRow> & {
          question: string;
          answer: string;
          category: string;
        };
        Update: Partial<KnowledgeItemRow>;
        Relationships: [];
      };
      operators: {
        Row: OperatorRow;
        Insert: Partial<OperatorRow> & { id: string; email: string; name: string };
        Update: Partial<OperatorRow>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettingsRow;
        Insert: Partial<AppSettingsRow>;
        Update: Partial<AppSettingsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_items: {
        Args: { query_embedding: number[]; match_count?: number };
        Returns: MatchKnowledgeItemResult[];
      };
    };
  };
};
