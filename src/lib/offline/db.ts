import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LocalWorkout, StartableDay } from "@/lib/workout/types";

// On-device storage for workouts in progress, so logging works without a
// connection. Everything here is synced to Supabase when online.

interface CaliCoachDB extends DBSchema {
  workouts: { key: string; value: LocalWorkout };
  cache: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<CaliCoachDB>> | undefined;

function db() {
  dbPromise ??= openDB<CaliCoachDB>("calicoach", 1, {
    upgrade(database) {
      database.createObjectStore("workouts", { keyPath: "session.id" });
      database.createObjectStore("cache");
    },
  });
  return dbPromise;
}

export async function getWorkout(sessionId: string) {
  return (await db()).get("workouts", sessionId);
}

export async function putWorkout(workout: LocalWorkout) {
  await (await db()).put("workouts", workout);
}

export async function allWorkouts() {
  return (await db()).getAll("workouts");
}

export async function deleteWorkout(sessionId: string) {
  await (await db()).delete("workouts", sessionId);
}

/** The next plan day, cached so a workout can start without a connection. */
export async function cacheNextDay(day: StartableDay) {
  await (await db()).put("cache", day, "next-day");
}

export async function getCachedNextDay() {
  return (await (await db()).get("cache", "next-day")) as StartableDay | undefined;
}

/** Removes everything (used on sign-out so the next user doesn't see it). */
export async function clearOfflineData() {
  const database = await db();
  await Promise.all([database.clear("workouts"), database.clear("cache")]);
}
