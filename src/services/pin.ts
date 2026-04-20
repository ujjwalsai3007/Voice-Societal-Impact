import { z } from "zod/v4";
import { logEvent } from "./event-store.js";

const DEFAULT_PIN = "1234";

const pinStore = new Map<string, string>();

const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

function ensurePin(userId: string): string {
  const existing = pinStore.get(userId);
  if (existing) {
    return existing;
  }
  pinStore.set(userId, DEFAULT_PIN);
  return DEFAULT_PIN;
}

export function setPin(userId: string, pin: string): void {
  const validPin = pinSchema.parse(pin);
  pinStore.set(userId, validPin);
}

export function verifyPin(userId: string, pin: string): boolean {
  let validPin: string;
  try {
    validPin = pinSchema.parse(pin);
  } catch (err) {
    logEvent("pin_verification", userId, {
      status: "invalid_format",
      providedLength: pin.length,
    });
    throw err;
  }
  const savedPin = ensurePin(userId);
  const isValid = savedPin === validPin;
  logEvent("pin_verification", userId, {
    status: isValid ? "verified" : "failed",
  });
  return isValid;
}

export function resetPinStore(): void {
  pinStore.clear();
}
