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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string
          status: string
          student_id: string
          topic: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by: string
          status: string
          student_id: string
          topic?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string
          status?: string
          student_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          day: string | null
          div: string | null
          grade: string | null
          id: string
          instructor_names: string | null
          name: string
          num_sessions: number | null
          school_id: string
          teacher_id: string | null
          timing: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          day?: string | null
          div?: string | null
          grade?: string | null
          id?: string
          instructor_names?: string | null
          name: string
          num_sessions?: number | null
          school_id: string
          teacher_id?: string | null
          timing?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          day?: string | null
          div?: string | null
          grade?: string | null
          id?: string
          instructor_names?: string | null
          name?: string
          num_sessions?: number | null
          school_id?: string
          teacher_id?: string | null
          timing?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grading: {
        Row: {
          class_id: string
          created_at: string
          date: string
          grade_value: string
          id: string
          marked_by: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          grade_value: string
          id?: string
          marked_by: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          grade_value?: string
          id?: string
          marked_by?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          days: string[] | null
          id: string
          ir_coordinator_mobile: string | null
          ir_coordinator_name: string | null
          name: string
          primary_coordinator_mobile: string | null
          primary_coordinator_name: string | null
          secondary_coordinator_mobile: string | null
          secondary_coordinator_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name?: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          div: string | null
          full_name: string
          grade: string | null
          id: string
          parent_email_1: string | null
          parent_email_2: string | null
          parent_mobile_1: string | null
          parent_mobile_2: string | null
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          div?: string | null
          full_name: string
          grade?: string | null
          id?: string
          parent_email_1?: string | null
          parent_email_2?: string | null
          parent_mobile_1?: string | null
          parent_mobile_2?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          div?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          parent_email_1?: string | null
          parent_email_2?: string | null
          parent_mobile_1?: string | null
          parent_mobile_2?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          topic: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          date?: string
          id?: string
          topic: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "instructor"
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
      app_role: ["instructor"],
    },
  },
} as const
