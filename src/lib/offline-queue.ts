import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];

export interface QueuedActivity {
  id: string; // client-generated UUID, used as activities.id for idempotency
  opportunity_id: string;
  user_id: string;
  type: ActivityType;
  note: string | null;
  next_action: string | null;
  next_action_at: string | null;
  logged_at: string;
  status: "pending" | "failed";
  error?: string;
}

const DB_NAME = "coatings-crm-queue";
const STORE = "activities";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("status", "status");
          store.createIndex("logged_at", "logged_at");
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(activity: Omit<QueuedActivity, "status">): Promise<void> {
  const db = await getDb();
  await db.put(STORE, { ...activity, status: "pending" });
}

export async function drain(): Promise<{ synced: number; failed: number }> {
  if (!supabase) return { synced: 0, failed: 0 };

  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.store.index("logged_at");
  const pending = await index.getAll();
  await tx.done;

  const items = pending.filter((i: QueuedActivity) => i.status === "pending");
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const { status: _status, error: _error, ...activityData } = item as QueuedActivity;

    const { error } = await supabase.from("activities").insert({
      id: activityData.id,
      opportunity_id: activityData.opportunity_id,
      user_id: activityData.user_id,
      type: activityData.type,
      note: activityData.note,
      next_action: activityData.next_action,
      next_action_at: activityData.next_action_at,
      logged_at: activityData.logged_at,
    });

    if (!error) {
      // Synced — remove from queue
      await db.delete(STORE, activityData.id);
      synced++;
    } else if (error.code === "23505") {
      // Unique violation — already synced (tab closed mid-drain), remove
      await db.delete(STORE, activityData.id);
      synced++;
    } else if (error.code && error.code.startsWith("4")) {
      // 4xx-class: server rejection that won't resolve on retry
      await db.put(STORE, {
        ...item,
        status: "failed",
        error: error.message,
      });
      failed++;
    } else if (
      error.message?.includes("permission denied") ||
      error.message?.includes("violates row-level security") ||
      error.message?.includes("violates check constraint")
    ) {
      // RLS or validation rejection
      await db.put(STORE, {
        ...item,
        status: "failed",
        error: error.message,
      });
      failed++;
    } else {
      // Transient/network error — leave pending for next drain
      break; // Stop draining; network is likely down
    }
  }

  return { synced, failed };
}

export async function getQueueCounts(): Promise<{ pending: number; failed: number }> {
  const db = await getDb();
  const all = await db.getAll(STORE) as QueuedActivity[];
  let pending = 0;
  let failed = 0;
  for (const item of all) {
    if (item.status === "pending") pending++;
    else if (item.status === "failed") failed++;
  }
  return { pending, failed };
}

export async function getPendingForOpp(oppId: string): Promise<QueuedActivity[]> {
  const db = await getDb();
  const all = await db.getAll(STORE) as QueuedActivity[];
  return all
    .filter((i) => i.opportunity_id === oppId && i.status === "pending")
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
}

export async function clearFailed(): Promise<void> {
  const db = await getDb();
  const all = await db.getAll(STORE) as QueuedActivity[];
  const tx = db.transaction(STORE, "readwrite");
  for (const item of all) {
    if (item.status === "failed") {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}
