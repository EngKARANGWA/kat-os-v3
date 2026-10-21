// Fixed choices used in forms (same lists as the API in api/app.py).
export const DEVICE_CATEGORIES = ["iPhone", "MacBook", "iPad"];
export const PART_CATEGORIES = ["Screen", "Battery", "Back Glass", "Flex Cable", "Other"];
export const REPAIR_STATUSES = ["Received", "Diagnosing", "Waiting for Approval", "Repairing", "Ready", "Collected", "Cancelled"];
export const CLOSED_STATUSES = ["Collected", "Cancelled"];

/** Today's date as YYYY-MM-DD in the shop's local time. */
export const todayISO = () => new Date().toLocaleDateString("en-CA");

/** Common Apple models offered as suggestions when typing a device (any other text is allowed too). */
export const COMMON_MODELS = [
  ...["11", "11 Pro", "11 Pro Max", "12", "12 mini", "12 Pro", "12 Pro Max", "13", "13 mini", "13 Pro", "13 Pro Max", "14", "14 Plus", "14 Pro", "14 Pro Max",
    "15", "15 Plus", "15 Pro", "15 Pro Max", "16", "16 Plus", "16 Pro", "16 Pro Max", "16e", "SE (2022)", "X", "XR", "XS", "XS Max"].map((m) => `iPhone ${m}`),
  ...["iPad (10th gen)", "iPad Air", "iPad mini", "iPad Pro 11\"", "iPad Pro 13\""],
  ...["MacBook Air M1", "MacBook Air M2", "MacBook Air M3", "MacBook Air M4", "MacBook Pro 14\" M3", "MacBook Pro 14\" M4", "MacBook Pro 16\" M4"],
];
