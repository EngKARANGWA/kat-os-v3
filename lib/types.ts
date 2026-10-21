export type User = {
  id: number;
  full_name: string;
  username: string;
  role: string;
  work_email: string | null;
  branch_id: number | null;
  branch: string | null;
  active: boolean;
  is_manager: boolean;
};

export type Branch = { id: number; name: string; location: string | null; phone: string | null; active: boolean };

export type Client = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
  repair_count: number;
  // Only in the clients list (used by its search):
  open_repairs?: number;
  devices?: { serial_imei: string | null; model: string | null }[];
  tickets?: string[];
  repair_serials?: string[];
};

export type Device = {
  id: number;
  client_id: number;
  category: string;
  model: string | null;
  serial_imei: string | null;
  created_at: string;
};

export type RepairSummary = {
  id: number;
  ticket_code: string;
  client_id: number;
  client_name: string;
  client_phone: string;
  device: string;
  serial_imei: string | null;
  problem_category: string;
  status: string;
  technician_id: number | null;
  technician: string | null;
  deadline: string | null;
  created_at: string;
  branch_id: number | null;
  branch: string | null;
  quoted_price: number;
  paid: number;
  balance: number;
};

export type Repair = RepairSummary & {
  device_passcode: string | null;
  accessories: string | null;
  condition_in: string | null;
  problem_notes: string | null;
  diagnosis: string | null;
  work_done: string | null;
  approved: boolean;
  terms_snapshot: string | null;
  customer_acceptance: string | null;
  warranty_days: number;
  warranty_until: string | null;
  updated_at: string;
  payments: { id: number; amount: number; method: string | null; reference: string | null; paid_at: string; received_by: string | null }[];
  parts_used: { id: number; item_id: number; item_name: string; quantity: number; used_at: string }[];
};

export type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  device_category: string;
  supplier: string | null;
  compatible_models: string | null;
  quantity: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
  branch_id: number | null;
  branch: string | null;
  /** Set for stock lines created by product Check In. */
  product_id: number | null;
  unit: "piece" | "box";
  items_per_box: number | null;
  /** Boxes with some items already taken out. */
  opened_boxes: { count: number; items_left: number } | null;
  /** Totals from the movement history, in this line's unit (pieces or boxes). */
  checked_in: number | null;
  checked_out: number | null;
  /** Single items available: pieces, or all items still in boxes (including opened ones). */
  available_items: number | null;
};

/** A staff member in a dropdown (technician). */
export type Person = { id: number; full_name: string };

/** A product the shop sells (managed by the General Manager). */
export type Product = {
  id: number;
  name: string;
  product_type: "Finished" | "Semi-finished" | "Raw material";
  purchase_price: number;
  selling_price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** One change to a stock quantity (check-in, check-out, adjustment, part used on a repair). */
export type StockMovement = {
  id: number;
  item_id: number;
  sku: string;
  item_name: string;
  direction: "in" | "out";
  quantity: number;
  reason: string | null;
  note: string | null;
  repair_id: number | null;
  ticket_code: string | null;
  balance_after: number | null;
  created_by: string | null;
  created_at: string;
};

/** A scanned code looked up for Check Out. */
export type OutCode = {
  code: string;
  item_id: number;
  product_name: string;
  unit: "piece" | "box";
  items_per_box: number | null;
  items_left: number;
  opened: boolean;
  price_per_item: number;
};

/** A receipt made by Check Out. */
export type Sale = {
  id: number;
  number: string;
  purpose: "sale" | "repair";
  service_name: string | null;
  service_price: number;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  items_total: number;
  total: number;
  created_by: string | null;
  created_at: string;
  lines: { id: number; code: string | null; description: string; quantity: number; unit_price: number; amount: number; device_serial: string | null }[];
};
