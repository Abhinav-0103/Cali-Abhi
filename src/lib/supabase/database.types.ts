
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_quota": {
                  Row: {
                    "count": number,"kind": string,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"kind": string,"user_id": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"kind"?: string,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "attempt": number,"cache_creation_input_tokens": number,"cache_read_input_tokens": number,"created_at": string,"error": string | null,"id": number,"input_tokens": number,"kind": string,"latency_ms": number | null,"model": string,"outcome": string,"output_tokens": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"cache_creation_input_tokens"?: number,"cache_read_input_tokens"?: number,"created_at"?: string,"error"?: string | null,"id"?: never,"input_tokens"?: number,"kind": string,"latency_ms"?: number | null,"model": string,"outcome": string,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "attempt"?: number,"cache_creation_input_tokens"?: number,"cache_read_input_tokens"?: number,"created_at"?: string,"error"?: string | null,"id"?: never,"input_tokens"?: number,"kind"?: string,"latency_ms"?: number | null,"model"?: string,"outcome"?: string,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"baseline_tests": {
                  Row: {
                    "created_at": string,"dead_hang_seconds": number,"id": string,"plank_seconds": number,"pull_ups": number,"push_ups": number,"source": string,"squats": number,"tested_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dead_hang_seconds": number,"id"?: string,"plank_seconds": number,"pull_ups": number,"push_ups": number,"source"?: string,"squats": number,"tested_on": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"dead_hang_seconds"?: number,"id"?: string,"plank_seconds"?: number,"pull_ups"?: number,"push_ups"?: number,"source"?: string,"squats"?: number,"tested_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_weight_logs": {
                  Row: {
                    "created_at": string,"id": string,"logged_on": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"logged_on": string,"user_id": string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logged_on"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"exercises": {
                  Row: {
                    "category": string,"chain": string,"chain_order": number,"contraindications": (string)[],"cues": (string)[],"equipment": (string)[],"id": string,"level": number,"media_url": string | null,"metric": string,"name": string,"unilateral": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"chain": string,"chain_order": number,"contraindications"?: (string)[],"cues"?: (string)[],"equipment"?: (string)[],"id": string,"level": number,"media_url"?: string | null,"metric": string,"name": string,"unilateral"?: boolean
                  }
                  Update: {
                    "category"?: string,"chain"?: string,"chain_order"?: number,"contraindications"?: (string)[],"cues"?: (string)[],"equipment"?: (string)[],"id"?: string,"level"?: number,"media_url"?: string | null,"metric"?: string,"name"?: string,"unilateral"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"plan_days": {
                  Row: {
                    "day_number": number,"focus": string | null,"id": string,"title": string,"user_id": string,"week_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day_number": number,"focus"?: string | null,"id"?: string,"title": string,"user_id": string,"week_id": string,"weekday": number
                  }
                  Update: {
                    "day_number"?: number,"focus"?: string | null,"id"?: string,"title"?: string,"user_id"?: string,"week_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_days_week_id_user_id_fkey"
      columns: ["week_id","user_id"]
isOneToOne: false
      referencedRelation: "plan_weeks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"plan_exercises": {
                  Row: {
                    "block": string,"day_id": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"rest_seconds": number,"sets": number,"target_max": number,"target_min": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block": string,"day_id": string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position": number,"rest_seconds": number,"sets": number,"target_max": number,"target_min": number,"user_id": string
                  }
                  Update: {
                    "block"?: string,"day_id"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"rest_seconds"?: number,"sets"?: number,"target_max"?: number,"target_min"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_exercises_day_id_user_id_fkey"
      columns: ["day_id","user_id"]
isOneToOne: false
      referencedRelation: "plan_days"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "plan_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_versions": {
                  Row: {
                    "created_at": string,"id": string,"is_current": boolean,"parent_version_id": string | null,"plan_id": string,"reason": string,"summary": string | null,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_current"?: boolean,"parent_version_id"?: string | null,"plan_id": string,"reason": string,"summary"?: string | null,"user_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_current"?: boolean,"parent_version_id"?: string | null,"plan_id"?: string,"reason"?: string,"summary"?: string | null,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_versions_parent_version_id_fkey"
      columns: ["parent_version_id"]
isOneToOne: false
      referencedRelation: "plan_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_versions_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"plan_weeks": {
                  Row: {
                    "focus": string | null,"id": string,"user_id": string,"version_id": string,"week_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "focus"?: string | null,"id"?: string,"user_id": string,"version_id": string,"week_number": number
                  }
                  Update: {
                    "focus"?: string | null,"id"?: string,"user_id"?: string,"version_id"?: string,"week_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_weeks_version_id_user_id_fkey"
      columns: ["version_id","user_id"]
isOneToOne: false
      referencedRelation: "plan_versions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"error": string | null,"id": string,"source": string | null,"start_date": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"source"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"source"?: string | null,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "birth_year": number | null,"created_at": string,"days_per_week": number | null,"equipment": (string)[],"experience": string | null,"goal": string | null,"height_cm": number | null,"id": string,"injury_areas": (string)[],"injury_notes": string | null,"minutes_per_session": number | null,"onboarding_completed_at": string | null,"parq_acknowledged_at": string | null,"parq_answers": Json | null,"parq_flagged": boolean | null,"preferred_days": (number)[],"sex": string | null,"skill_goals": (string)[],"timezone": string,"unit_system": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"created_at"?: string,"days_per_week"?: number | null,"equipment"?: (string)[],"experience"?: string | null,"goal"?: string | null,"height_cm"?: number | null,"id": string,"injury_areas"?: (string)[],"injury_notes"?: string | null,"minutes_per_session"?: number | null,"onboarding_completed_at"?: string | null,"parq_acknowledged_at"?: string | null,"parq_answers"?: Json | null,"parq_flagged"?: never,"preferred_days"?: (number)[],"sex"?: string | null,"skill_goals"?: (string)[],"timezone"?: string,"unit_system"?: string,"updated_at"?: string
                  }
                  Update: {
                    "birth_year"?: number | null,"created_at"?: string,"days_per_week"?: number | null,"equipment"?: (string)[],"experience"?: string | null,"goal"?: string | null,"height_cm"?: number | null,"id"?: string,"injury_areas"?: (string)[],"injury_notes"?: string | null,"minutes_per_session"?: number | null,"onboarding_completed_at"?: string | null,"parq_acknowledged_at"?: string | null,"parq_answers"?: Json | null,"parq_flagged"?: never,"preferred_days"?: (number)[],"sex"?: string | null,"skill_goals"?: (string)[],"timezone"?: string,"unit_system"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"plan_exercise_id": string | null,"planned_sets": number,"position": number,"rpe": number | null,"session_id": string,"skipped": boolean,"target_max": number,"target_min": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id": string,"plan_exercise_id"?: string | null,"planned_sets": number,"position": number,"rpe"?: number | null,"session_id": string,"skipped"?: boolean,"target_max": number,"target_min": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"plan_exercise_id"?: string | null,"planned_sets"?: number,"position"?: number,"rpe"?: number | null,"session_id"?: string,"skipped"?: boolean,"target_max"?: number,"target_min"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_exercises_plan_exercise_id_fkey"
      columns: ["plan_exercise_id"]
isOneToOne: false
      referencedRelation: "plan_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_exercises_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"set_logs": {
                  Row: {
                    "created_at": string,"id": string,"logged_at": string,"session_exercise_id": string,"set_number": number,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"logged_at": string,"session_exercise_id": string,"set_number": number,"updated_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logged_at"?: string,"session_exercise_id"?: string,"set_number"?: number,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "set_logs_session_exercise_id_user_id_fkey"
      columns: ["session_exercise_id","user_id"]
isOneToOne: false
      referencedRelation: "session_exercises"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"weekly_checkins": {
                  Row: {
                    "adjustments": NonNullable<Json>,"created_at": string,"difficulty": number,"energy": number,"id": string,"plan_id": string,"resulting_version_id": string | null,"soreness": number,"source": string,"summary": string | null,"user_id": string,"week_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustments"?: NonNullable<Json>,"created_at"?: string,"difficulty": number,"energy": number,"id"?: string,"plan_id": string,"resulting_version_id"?: string | null,"soreness": number,"source": string,"summary"?: string | null,"user_id": string,"week_number": number
                  }
                  Update: {
                    "adjustments"?: NonNullable<Json>,"created_at"?: string,"difficulty"?: number,"energy"?: number,"id"?: string,"plan_id"?: string,"resulting_version_id"?: string | null,"soreness"?: number,"source"?: string,"summary"?: string | null,"user_id"?: string,"week_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "weekly_checkins_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "weekly_checkins_resulting_version_id_fkey"
      columns: ["resulting_version_id"]
isOneToOne: false
      referencedRelation: "plan_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sessions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"day_number": number | null,"id": string,"notes": string | null,"performed_on": string,"plan_day_id": string | null,"plan_id": string | null,"progression_applied_at": string | null,"started_at": string,"status": string,"updated_at": string,"user_id": string,"week_number": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"day_number"?: number | null,"id": string,"notes"?: string | null,"performed_on": string,"plan_day_id"?: string | null,"plan_id"?: string | null,"progression_applied_at"?: string | null,"started_at": string,"status"?: string,"updated_at"?: string,"user_id": string,"week_number"?: number | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"day_number"?: number | null,"id"?: string,"notes"?: string | null,"performed_on"?: string,"plan_day_id"?: string | null,"plan_id"?: string | null,"progression_applied_at"?: string | null,"started_at"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string,"week_number"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_plan_day_id_user_id_fkey"
      columns: ["plan_day_id","user_id"]
isOneToOne: false
      referencedRelation: "plan_days"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "workout_sessions_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "personal_bests": {
                  Row: {
                    "achieved_on": string,"best_value": number,"exercise_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "session_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "consume_ai_quota":
{ Args: { "p_kind": string,"p_limit": number,"p_user_id": string,"p_window": string }; Returns: boolean
                           },
"save_plan_version":
{ Args: { "p_parent_version_id"?: string,"p_plan_id": string,"p_reason": string,"p_start_date"?: string,"p_summary": string,"p_user_id": string,"p_weeks": Json }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
