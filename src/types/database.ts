export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string;
          city: string | null;
          bio: string | null;
          avatar_path: string | null;
          conversation_style: string[] | null;
          topics: string | null;
          discoverable: boolean;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name: string;
          city?: string | null;
          bio?: string | null;
          avatar_path?: string | null;
          conversation_style?: string[] | null;
          topics?: string | null;
          discoverable?: boolean;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          display_name?: string;
          city?: string | null;
          bio?: string | null;
          avatar_path?: string | null;
          conversation_style?: string[] | null;
          topics?: string | null;
          discoverable?: boolean;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      interests: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: string;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          category?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_interests: {
        Row: {
          user_id: string;
          interest_id: string;
          is_primary: boolean;
          is_niche: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          interest_id: string;
          is_primary?: boolean;
          is_niche?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          interest_id?: string;
          is_primary?: boolean;
          is_niche?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      interest_relations: {
        Row: {
          interest_a: string;
          interest_b: string;
          relation_type: string;
          weight: number;
        };
        Insert: {
          interest_a: string;
          interest_b: string;
          relation_type?: string;
          weight?: number;
        };
        Update: {
          interest_a?: string;
          interest_b?: string;
          relation_type?: string;
          weight?: number;
        };
        Relationships: [];
      };
      connections: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "declined" | "canceled" | "removed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "declined" | "canceled" | "removed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: "pending" | "accepted" | "declined" | "canceled" | "removed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_at: string;
          joined_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_at?: string;
          joined_at?: string;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          last_read_at?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      communities: {
        Row: {
          id: string;
          slug: string;
          name: string;
          line: string;
          description: string;
          creator_id: string | null;
          avatar_path: string | null;
          visibility: "public" | "private";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          name: string;
          line?: string;
          description?: string;
          creator_id?: string | null;
          avatar_path?: string | null;
          visibility?: "public" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          line?: string;
          description?: string;
          creator_id?: string | null;
          avatar_path?: string | null;
          visibility?: "public" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_members: {
        Row: {
          community_id: string;
          user_id: string;
          role: "owner" | "moderator" | "member";
          joined_at: string;
        };
        Insert: {
          community_id: string;
          user_id: string;
          role?: "owner" | "moderator" | "member";
          joined_at?: string;
        };
        Update: {
          community_id?: string;
          user_id?: string;
          role?: "owner" | "moderator" | "member";
          joined_at?: string;
        };
        Relationships: [];
      };
      community_interests: {
        Row: {
          community_id: string;
          interest_id: string;
        };
        Insert: {
          community_id: string;
          interest_id: string;
        };
        Update: {
          community_id?: string;
          interest_id?: string;
        };
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          community_id: string;
          author_id: string;
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          author_id: string;
          title: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          author_id?: string;
          title?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_replies: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      blocked_users: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          reason: string;
          details: string | null;
          status: "pending" | "reviewed" | "dismissed";
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id: string;
          reason: string;
          details?: string | null;
          status?: "pending" | "reviewed" | "dismissed";
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_user_id?: string;
          reason?: string;
          details?: string | null;
          status?: "pending" | "reviewed" | "dismissed";
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: "connection_request" | "connection_accepted" | "new_message" | "community_reply";
          title: string;
          payload: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "connection_request" | "connection_accepted" | "new_message" | "community_reply";
          title: string;
          payload?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "connection_request" | "connection_accepted" | "new_message" | "community_reply";
          title?: string;
          payload?: Json;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rpc_send_connection_request: {
        Args: { p_target_user_id: string };
        Returns: { success: boolean; status: string; id: string };
      };
      rpc_respond_to_connection_request: {
        Args: { p_connection_id: string; p_status: string };
        Returns: { success: boolean; status: string };
      };
      rpc_send_message: {
        Args: { p_conversation_id: string; p_body: string };
        Returns: { success: boolean; message_id: string };
      };
      rpc_get_or_create_direct_conversation: {
        Args: { p_peer_user_id: string };
        Returns: { success: boolean; conversation_id: string };
      };
      rpc_mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: { success: boolean };
      };
      rpc_create_community: {
        Args: { p_name: string; p_description: string; p_topics?: string[] };
        Returns: { success: boolean; community_id: string; slug: string; name: string };
      };
      rpc_create_community_post: {
        Args: { p_community_id: string; p_title: string; p_content?: string };
        Returns: { success: boolean; post_id: string };
      };
      rpc_create_community_reply: {
        Args: { p_post_id: string; p_text: string };
        Returns: { success: boolean; reply_id: string };
      };
      rpc_delete_community_post: {
        Args: { p_post_id: string };
        Returns: { success: boolean };
      };
      rpc_get_discovery: {
        Args: {
          p_filter?: string;
          p_query?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          handle: string;
          display_name: string;
          city: string | null;
          bio: string | null;
          avatar_path: string | null;
          interests: string[];
          shared_interests: string[];
          match_score: number;
          explanation: string;
          connection_status: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
