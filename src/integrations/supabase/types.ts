export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alliances: {
        Row: {
          created_at: string
          game_id: string
          id: string
          night: number
          partner_id: string
          requester_id: string
          status: Database["public"]["Enums"]["alliance_status"]
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          night: number
          partner_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["alliance_status"]
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          partner_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["alliance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "alliances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alliances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alliances_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      armory_rounds: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_winner: boolean
          night: number
          player_a_id: string
          player_b_id: string
          scored: boolean
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_winner?: boolean
          night: number
          player_a_id: string
          player_b_id: string
          scored?: boolean
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_winner?: boolean
          night?: number
          player_a_id?: string
          player_b_id?: string
          scored?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "armory_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "armory_rounds_player_a_id_fkey"
            columns: ["player_a_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "armory_rounds_player_b_id_fkey"
            columns: ["player_b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      arrests: {
        Row: {
          capo_id: string
          created_at: string
          game_id: string
          id: string
          night: number
          target_id: string
          was_correct: boolean | null
        }
        Insert: {
          capo_id: string
          created_at?: string
          game_id: string
          id?: string
          night: number
          target_id: string
          was_correct?: boolean | null
        }
        Update: {
          capo_id?: string
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          target_id?: string
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "arrests_capo_id_fkey"
            columns: ["capo_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_assignments: {
        Row: {
          created_at: string
          fingers: number
          from_player_id: string
          game_id: string
          id: string
          night: number
          to_player_id: string
        }
        Insert: {
          created_at?: string
          fingers?: number
          from_player_id: string
          game_id: string
          id?: string
          night: number
          to_player_id: string
        }
        Update: {
          created_at?: string
          fingers?: number
          from_player_id?: string
          game_id?: string
          id?: string
          night?: number
          to_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_assignments_from_player_id_fkey"
            columns: ["from_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_assignments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_assignments_to_player_id_fkey"
            columns: ["to_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_night: number
          id: string
          morning_revealed: boolean
          morning_revealed_night: number | null
          name: string
          night3_game_name: string
          phase: Database["public"]["Enums"]["game_phase"]
        }
        Insert: {
          created_at?: string
          current_night?: number
          id?: string
          morning_revealed?: boolean
          morning_revealed_night?: number | null
          name?: string
          night3_game_name?: string
          phase?: Database["public"]["Enums"]["game_phase"]
        }
        Update: {
          created_at?: string
          current_night?: number
          id?: string
          morning_revealed?: boolean
          morning_revealed_night?: number | null
          name?: string
          night3_game_name?: string
          phase?: Database["public"]["Enums"]["game_phase"]
        }
        Relationships: []
      }
      giuros: {
        Row: {
          answer: string | null
          answered_at: string | null
          asker_id: string
          created_at: string
          game_id: string
          id: string
          night: number
          question: string
          target_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asker_id: string
          created_at?: string
          game_id: string
          id?: string
          night: number
          question: string
          target_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asker_id?: string
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          question?: string
          target_id?: string
        }
        Relationships: []
      }
      murder_votes: {
        Row: {
          created_at: string
          game_id: string
          id: string
          night: number
          traitor_id: string
          victim_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          night: number
          traitor_id: string
          victim_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          traitor_id?: string
          victim_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "murder_votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_votes_traitor_id_fkey"
            columns: ["traitor_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_votes_victim_id_fkey"
            columns: ["victim_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      murders: {
        Row: {
          created_at: string
          fingers: number
          game_id: string
          id: string
          night: number
          traitor_id: string
          victim_id: string
        }
        Insert: {
          created_at?: string
          fingers?: number
          game_id: string
          id?: string
          night: number
          traitor_id: string
          victim_id: string
        }
        Update: {
          created_at?: string
          fingers?: number
          game_id?: string
          id?: string
          night?: number
          traitor_id?: string
          victim_id?: string
        }
        Relationships: []
      }
      phase_ready: {
        Row: {
          created_at: string
          game_id: string
          night: number
          phase: Database["public"]["Enums"]["game_phase"]
          player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          night: number
          phase: Database["public"]["Enums"]["game_phase"]
          player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          night?: number
          phase?: Database["public"]["Enums"]["game_phase"]
          player_id?: string
        }
        Relationships: []
      }
      phase_transitions: {
        Row: {
          created_at: string
          from_phase: Database["public"]["Enums"]["game_phase"]
          game_id: string
          night: number
        }
        Insert: {
          created_at?: string
          from_phase: Database["public"]["Enums"]["game_phase"]
          game_id: string
          night: number
        }
        Update: {
          created_at?: string
          from_phase?: Database["public"]["Enums"]["game_phase"]
          game_id?: string
          night?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          banished: boolean
          banished_night: number | null
          banished_revealed: boolean
          created_at: string
          game_id: string
          giuro_used: boolean
          id: string
          name: string
          pin: string | null
          state: Database["public"]["Enums"]["player_state"]
          total_points: number
        }
        Insert: {
          banished?: boolean
          banished_night?: number | null
          banished_revealed?: boolean
          created_at?: string
          game_id: string
          giuro_used?: boolean
          id?: string
          name: string
          pin?: string | null
          state?: Database["public"]["Enums"]["player_state"]
          total_points?: number
        }
        Update: {
          banished?: boolean
          banished_night?: number | null
          banished_revealed?: boolean
          created_at?: string
          game_id?: string
          giuro_used?: boolean
          id?: string
          name?: string
          pin?: string | null
          state?: Database["public"]["Enums"]["player_state"]
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          bonus_mission: string | null
          bonus_mission_state:
            | Database["public"]["Enums"]["mission_state"]
            | null
          bonus_target_id: string | null
          created_at: string
          game_id: string
          id: string
          mission_1: string
          mission_1_state: Database["public"]["Enums"]["mission_state"]
          mission_2: string
          mission_2_state: Database["public"]["Enums"]["mission_state"]
          night: number
          night_points: number
          player_id: string
          role: Database["public"]["Enums"]["player_role"]
          traitor_list_seen: boolean
        }
        Insert: {
          bonus_mission?: string | null
          bonus_mission_state?:
            | Database["public"]["Enums"]["mission_state"]
            | null
          bonus_target_id?: string | null
          created_at?: string
          game_id: string
          id?: string
          mission_1: string
          mission_1_state?: Database["public"]["Enums"]["mission_state"]
          mission_2: string
          mission_2_state?: Database["public"]["Enums"]["mission_state"]
          night: number
          night_points?: number
          player_id: string
          role: Database["public"]["Enums"]["player_role"]
          traitor_list_seen?: boolean
        }
        Update: {
          bonus_mission?: string | null
          bonus_mission_state?:
            | Database["public"]["Enums"]["mission_state"]
            | null
          bonus_target_id?: string | null
          created_at?: string
          game_id?: string
          id?: string
          mission_1?: string
          mission_1_state?: Database["public"]["Enums"]["mission_state"]
          mission_2?: string
          mission_2_state?: Database["public"]["Enums"]["mission_state"]
          night?: number
          night_points?: number
          player_id?: string
          role?: Database["public"]["Enums"]["player_role"]
          traitor_list_seen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      sotto_sospetto: {
        Row: {
          accused_id: string
          behaviour: string
          caller_id: string
          created_at: string
          game_id: string
          id: string
          night: number
          resolved_at: string | null
          result: string | null
        }
        Insert: {
          accused_id: string
          behaviour: string
          caller_id: string
          created_at?: string
          game_id: string
          id?: string
          night: number
          resolved_at?: string | null
          result?: string | null
        }
        Update: {
          accused_id?: string
          behaviour?: string
          caller_id?: string
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          resolved_at?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sotto_sospetto_accused_id_fkey"
            columns: ["accused_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sotto_sospetto_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sotto_sospetto_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      sotto_sospetto_votes: {
        Row: {
          created_at: string
          id: string
          sospetto_id: string
          vote: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sospetto_id: string
          vote: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sospetto_id?: string
          vote?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sotto_sospetto_votes_sospetto_id_fkey"
            columns: ["sospetto_id"]
            isOneToOne: false
            referencedRelation: "sotto_sospetto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sotto_sospetto_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      suspect_tips: {
        Row: {
          capo_id: string
          game_id: string
          id: string
          night: number
          suspect_ids: string[]
        }
        Insert: {
          capo_id: string
          game_id: string
          id?: string
          night: number
          suspect_ids: string[]
        }
        Update: {
          capo_id?: string
          game_id?: string
          id?: string
          night?: number
          suspect_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "suspect_tips_capo_id_fkey"
            columns: ["capo_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspect_tips_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          game_id: string
          id: string
          night: number
          points_applied: boolean
          target_id: string
          voter_id: string
          was_correct: boolean | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          night: number
          points_applied?: boolean
          target_id: string
          voter_id: string
          was_correct?: boolean | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          night?: number
          points_applied?: boolean
          target_id?: string
          voter_id?: string
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alliance_status: "pending" | "accepted" | "declined" | "broken"
      game_phase:
        | "setup"
        | "night_active"
        | "armory"
        | "tribunale_missions"
        | "tribunale_arrests"
        | "tribunale_discussion"
        | "tribunale_voting"
        | "tribunale_reveal"
        | "tribunale_leaderboard"
        | "tribunale_drinks"
        | "finished"
        | "great_reveal"
      mission_state: "pending" | "completed" | "failed"
      player_role: "capo" | "traitor" | "faithful"
      player_state: "active" | "ghost" | "banished"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alliance_status: ["pending", "accepted", "declined", "broken"],
      game_phase: [
        "setup",
        "night_active",
        "armory",
        "tribunale_missions",
        "tribunale_arrests",
        "tribunale_discussion",
        "tribunale_voting",
        "tribunale_reveal",
        "tribunale_leaderboard",
        "tribunale_drinks",
        "finished",
        "great_reveal",
      ],
      mission_state: ["pending", "completed", "failed"],
      player_role: ["capo", "traitor", "faithful"],
      player_state: ["active", "ghost", "banished"],
    },
  },
} as const
