// Generated from the Supabase schema via the Management API typegen endpoint
// (GET /v1/projects/<ref>/types/typescript). Regenerate after every migration; do not edit by hand.

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
      body_weights: {
        Row: {
          id: string
          recorded_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: string
          recorded_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: string
          recorded_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_custom: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          target_value: number | null
          type: Database["public"]["Enums"]["goal_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          type: Database["public"]["Enums"]["goal_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          type?: Database["public"]["Enums"]["goal_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          dob: string | null
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          gender: Database["public"]["Enums"]["gender"] | null
          height_cm: number | null
          id: string
          last_active_date: string | null
          longest_streak: number
          onboarding_complete: boolean
          privacy: Database["public"]["Enums"]["privacy_level"]
          timezone: string
          total_points: number
          units: Database["public"]["Enums"]["units_pref"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          dob?: string | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          gender?: Database["public"]["Enums"]["gender"] | null
          height_cm?: number | null
          id: string
          last_active_date?: string | null
          longest_streak?: number
          onboarding_complete?: boolean
          privacy?: Database["public"]["Enums"]["privacy_level"]
          timezone?: string
          total_points?: number
          units?: Database["public"]["Enums"]["units_pref"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          dob?: string | null
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          gender?: Database["public"]["Enums"]["gender"] | null
          height_cm?: number | null
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          onboarding_complete?: boolean
          privacy?: Database["public"]["Enums"]["privacy_level"]
          timezone?: string
          total_points?: number
          units?: Database["public"]["Enums"]["units_pref"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      routine_day_exercises: {
        Row: {
          exercise_id: string
          id: string
          routine_day_id: string
          sort_order: number
          target_reps: number | null
          target_sets: number | null
        }
        Insert: {
          exercise_id: string
          id?: string
          routine_day_id: string
          sort_order?: number
          target_reps?: number | null
          target_sets?: number | null
        }
        Update: {
          exercise_id?: string
          id?: string
          routine_day_id?: string
          sort_order?: number
          target_reps?: number | null
          target_sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_day_exercises_routine_day_id_fkey"
            columns: ["routine_day_id"]
            isOneToOne: false
            referencedRelation: "routine_days"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_days: {
        Row: {
          day_of_week: number
          id: string
          label: string | null
          routine_id: string
        }
        Insert: {
          day_of_week: number
          id?: string
          label?: string | null
          routine_id: string
        }
        Update: {
          day_of_week?: number
          id?: string
          label?: string | null
          routine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_days_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          exercise_id: string
          id: string
          session_id: string
          sort_order: number
        }
        Insert: {
          exercise_id: string
          id?: string
          session_id: string
          sort_order?: number
        }
        Update: {
          exercise_id?: string
          id?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          id: string
          is_pr: boolean
          reps: number
          session_exercise_id: string
          set_number: number
          weight_kg: number
        }
        Insert: {
          id?: string
          is_pr?: boolean
          reps: number
          session_exercise_id: string
          set_number: number
          weight_kg?: number
        }
        Update: {
          id?: string
          is_pr?: boolean
          reps?: number
          session_exercise_id?: string
          set_number?: number
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          photo_url: string | null
          routine_day_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          routine_day_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          routine_day_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_routine_day_id_fkey"
            columns: ["routine_day_id"]
            isOneToOne: false
            referencedRelation: "routine_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_username_available: { Args: { candidate: string }; Returns: boolean }
    }
    Enums: {
      experience_level: "beginner" | "intermediate" | "advanced"
      gender: "male" | "female" | "other" | "prefer_not_to_say"
      goal_status: "active" | "achieved" | "abandoned"
      goal_type:
        | "lose_weight"
        | "build_muscle"
        | "get_stronger"
        | "stay_consistent"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "arms"
        | "legs"
        | "core"
        | "cardio"
        | "full_body"
        | "other"
      privacy_level: "public" | "private"
      units_pref: "metric" | "imperial"
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
      experience_level: ["beginner", "intermediate", "advanced"],
      gender: ["male", "female", "other", "prefer_not_to_say"],
      goal_status: ["active", "achieved", "abandoned"],
      goal_type: [
        "lose_weight",
        "build_muscle",
        "get_stronger",
        "stay_consistent",
      ],
      muscle_group: [
        "chest",
        "back",
        "shoulders",
        "arms",
        "legs",
        "core",
        "cardio",
        "full_body",
        "other",
      ],
      privacy_level: ["public", "private"],
      units_pref: ["metric", "imperial"],
    },
  },
} as const

