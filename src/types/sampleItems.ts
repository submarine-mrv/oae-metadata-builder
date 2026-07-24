export type SampleItemJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SampleItemJson | undefined }
  | SampleItemJson[];

export interface SampleItem {
  id: number;
  [key: string]: SampleItemJson | undefined;
}

export interface SampleItemInsert {
  id?: number;
  [key: string]: SampleItemJson | undefined;
}

export interface SampleItemUpdate {
  id?: number;
  [key: string]: SampleItemJson | undefined;
}

export interface SampleItemsDatabase {
  public: {
    Tables: {
      sample_items: {
        Row: SampleItem;
        Insert: SampleItemInsert;
        Update: SampleItemUpdate;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: never;
    };
    Functions: {
      [key: string]: never;
    };
    Enums: {
      [key: string]: never;
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
}
