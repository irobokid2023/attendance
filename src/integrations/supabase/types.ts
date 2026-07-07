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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          section: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          section: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          section?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          academic_year: string
          app_name: string
          default_class_duration_minutes: number
          id: string
          notify_attendance_reminders: boolean
          notify_holiday_alerts: boolean
          primary_color: string
          reminder_time: string
          singleton: boolean
          tagline: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string
          app_name?: string
          default_class_duration_minutes?: number
          id?: string
          notify_attendance_reminders?: boolean
          notify_holiday_alerts?: boolean
          primary_color?: string
          reminder_time?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          app_name?: string
          default_class_duration_minutes?: number
          id?: string
          notify_attendance_reminders?: boolean
          notify_holiday_alerts?: boolean
          primary_color?: string
          reminder_time?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          status: string
          student_id: string
          topic: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          status: string
          student_id: string
          topic?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
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
      curriculum: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          program_name: string
          session_no: number
          topic_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          program_name: string
          session_no: number
          topic_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          program_name?: string
          session_no?: number
          topic_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      grading: {
        Row: {
          class_id: string
          created_at: string
          date: string
          grade_value: string
          id: string
          marked_by: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          grade_value: string
          id?: string
          marked_by?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          grade_value?: string
          id?: string
          marked_by?: string | null
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
          created_by: string | null
          date: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
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
      instructor_attendance: {
        Row: {
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          instructor_id: string
          location: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          instructor_id: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          instructor_id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      misc_tasks: {
        Row: {
          created_at: string
          id: string
          marked_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["misc_task_status"]
          task_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["misc_task_status"]
          task_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["misc_task_status"]
          task_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          title?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
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
          created_by: string | null
          days: string[] | null
          id: string
          ir_coordinator_mobile: string | null
          ir_coordinator_name: string | null
          name: string
          primary_coordinator_mobile: string | null
          primary_coordinator_name: string | null
          secondary_coordinator_mobile: string | null
          secondary_coordinator_name: string | null
          transport_mode: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          transport_mode?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          days?: string[] | null
          id?: string
          ir_coordinator_mobile?: string | null
          ir_coordinator_name?: string | null
          name?: string
          primary_coordinator_mobile?: string | null
          primary_coordinator_name?: string | null
          secondary_coordinator_mobile?: string | null
          secondary_coordinator_name?: string | null
          transport_mode?: string | null
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
          laptop_no: string | null
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
          laptop_no?: string | null
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
          laptop_no?: string | null
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
          created_by: string | null
          date: string
          id: string
          topic: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          topic: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
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
      delete_old_activity_logs: { Args: never; Returns: undefined }
      delete_old_topics: { Args: never; Returns: undefined }
      get_table_sizes: {
        Args: never
        Returns: {
          index_bytes: number
          row_estimate: number
          table_bytes: number
          table_name: string
          total_bytes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "instructor" | "admin"
      misc_task_status: "done" | "pending" | "not_applicable" | "granted"
      payment_status: "paid" | "not_paid"
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
      app_role: ["instructor", "admin"],
      misc_task_status: ["done", "pending", "not_applicable", "granted"],
      payment_status: ["paid", "not_paid"],
    },
  },
} as const
