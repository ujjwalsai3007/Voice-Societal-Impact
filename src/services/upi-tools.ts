import { registerToolHandler } from "../webhooks/dispatcher.js";
import { checkBalance, sendMoney, getTransactionHistory } from "./upi.js";

export function registerUpiTools(): void {
  registerToolHandler("checkBalance", checkBalance);
  registerToolHandler("sendMoney", sendMoney);
  registerToolHandler("getTransactionHistory", getTransactionHistory);
}
