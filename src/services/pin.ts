import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { logEvent } from "./event-store.js";

export const NO_PIN_SET_ERROR =
  "No PIN set for this account. Please set your 4-digit PIN before sending money.";
export const INVALID_CURRENT_PIN_ERROR = "Current PIN is incorrect.";
export const SAME_PIN_CHANGE_ERROR =
  "New PIN must be different from current PIN.";

const pinHashStore = new Map<string, string>();

const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

function hashPin(userId: string, pin: string): string {
  return createHash("sha256")
    .update(`${userId}:${pin}`)
    .digest("hex");
}

function parsePin(pin: string): string {
  return pinSchema.parse(pin);
}

export function hasPin(userId: string): boolean {
  return pinHashStore.has(userId);
}

export function setPin(userId: string, pin: string): void {
  const validPin = parsePin(pin);
  const action = hasPin(userId) ? "pin_reset" : "pin_set";

  pinHashStore.set(userId, hashPin(userId, validPin));
  logEvent("pin_verification", userId, {
    action,
    status: "success",
  });
}

export function changePin(
  userId: string,
  currentPin: string,
  newPin: string,
): void {
  const validCurrentPin = parsePin(currentPin);
  const validNewPin = parsePin(newPin);

  const existingHash = pinHashStore.get(userId);
  if (!existingHash) {
    logEvent("pin_verification", userId, {
      action: "pin_change",
      status: "failed",
      reason: "no_pin_set",
    });
    throw new Error(NO_PIN_SET_ERROR);
  }

  if (hashPin(userId, validCurrentPin) !== existingHash) {
    logEvent("pin_verification", userId, {
      action: "pin_change",
      status: "failed",
      reason: "current_pin_mismatch",
    });
    throw new Error(INVALID_CURRENT_PIN_ERROR);
  }

  if (validCurrentPin === validNewPin) {
    logEvent("pin_verification", userId, {
      action: "pin_change",
      status: "failed",
      reason: "same_pin",
    });
    throw new Error(SAME_PIN_CHANGE_ERROR);
  }

  pinHashStore.set(userId, hashPin(userId, validNewPin));
  logEvent("pin_verification", userId, {
    action: "pin_change",
    status: "success",
  });
}

export function verifyPin(userId: string, pin: string): boolean {
  let validPin: string;
  try {
    validPin = parsePin(pin);
  } catch (err) {
    logEvent("pin_verification", userId, {
      action: "pin_verify",
      status: "invalid_format",
      providedLength: pin.length,
    });
    throw err;
  }

  const savedPinHash = pinHashStore.get(userId);
  if (!savedPinHash) {
    logEvent("pin_verification", userId, {
      action: "pin_verify",
      status: "failed",
      reason: "no_pin_set",
    });
    throw new Error(NO_PIN_SET_ERROR);
  }

  const isValid = savedPinHash === hashPin(userId, validPin);
  logEvent("pin_verification", userId, {
    action: "pin_verify",
    status: isValid ? "verified" : "failed",
  });
  return isValid;
}

export function resetPinStore(): void {
  pinHashStore.clear();
  pinFailedStreaks.clear();
}

export function getPinUserCount(): number {
  return pinHashStore.size;
}

const pinFailedStreaks = new Map<string, number>();

export function incrementPinFailedStreak(userId: string): void {
  pinFailedStreaks.set(userId, (pinFailedStreaks.get(userId) ?? 0) + 1);
}

export function resetPinFailedStreak(userId: string): void {
  pinFailedStreaks.delete(userId);
}

export function getPinFailedStreak(userId: string): number {
  return pinFailedStreaks.get(userId) ?? 0;
}
