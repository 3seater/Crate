import { opsClob, opsMagic, opsSafeDeploy } from "./definitions";

/** Returns true when all trading-critical services are enabled. */
export async function isTradingEnabled(): Promise<boolean> {
  return (await opsClob()) && (await opsMagic()) && (await opsSafeDeploy());
}
