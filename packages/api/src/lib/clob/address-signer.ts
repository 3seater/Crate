/**
 * Minimal signer that only provides an address.
 * Used for server-side L2-only CLOB operations (postOrder, cancel, etc.)
 * when we have stored credentials but no access to the user's wallet.
 *
 * The official @polymarket/clob-client requires a signer for L2 headers
 * (POLY_ADDRESS). This adapter supplies the address from the user record.
 *
 * Implements the EthersSigner interface expected by the CLOB SDK's ClobSigner union.
 */

/** Matches the EthersSigner interface from @polymarket/clob-client-v2. */
interface EthersSigner {
  _signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string>;
  getAddress(): Promise<string>;
}

/**
 * Signer that only implements getAddress().
 * L1 operations (createOrDeriveApiKey, createOrder) will throw if attempted.
 */
export class AddressOnlySigner implements EthersSigner {
  readonly #address: string;

  constructor(address: string) {
    this.#address = address;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.#address);
  }

  _signTypedData(): Promise<string> {
    return Promise.reject(
      new Error(
        "Cannot sign: AddressOnlySigner is for L2-only. Order creation requires a real signer (client-side)."
      )
    );
  }
}

/**
 * Creates a minimal signer for L2-only operations.
 * Use when you have creds and address but no wallet (e.g. server-side).
 */
export function createAddressOnlySigner(address: string): EthersSigner {
  return new AddressOnlySigner(address);
}
