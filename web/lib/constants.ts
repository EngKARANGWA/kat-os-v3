// Fixed choices used in forms (same lists as the API in api/app.py).
export const DEVICE_CATEGORIES = ["iPhone", "MacBook", "iPad"];
export const PART_CATEGORIES = ["Screen", "Battery", "Back Glass", "Flex Cable", "Other"];
export const REPAIR_STATUSES = ["Received", "Diagnosing", "Waiting for Approval", "Repairing", "Ready", "Collected", "Cancelled"];
export const CLOSED_STATUSES = ["Collected", "Cancelled"];

/** Today's date as YYYY-MM-DD in the shop's local time. */
export const todayISO = () => new Date().toLocaleDateString("en-CA");
