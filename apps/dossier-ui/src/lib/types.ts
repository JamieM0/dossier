export type ProfileItem = {
  item_id: string;
  state: "CONFIRMED" | "INFERENCE_PENDING";
  text: string;
  item_type: string;
  created_at: string;
  updated_at: string;
};
