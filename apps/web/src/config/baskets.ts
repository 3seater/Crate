import type { BasketConfig } from "@doji/types";

export const WEIGHT_TOLERANCE = 0.001;

/**
 * Build-time weight validation. Throws if weights in any basket do not sum
 * to 1.0 within WEIGHT_TOLERANCE.
 */
export function validateBaskets(baskets: BasketConfig[]): BasketConfig[] {
  for (const basket of baskets) {
    const sum = basket.constituents.reduce((acc, c) => acc + c.weight, 0);
    if (Math.abs(sum - 1.0) > WEIGHT_TOLERANCE) {
      throw new Error(
        `Basket "${basket.id}" has invalid weights: sum is ${sum.toFixed(6)}, expected 1.0 ± ${WEIGHT_TOLERANCE}`
      );
    }
  }
  return baskets;
}

/**
 * Curated meme baskets for Robinhood Chain.
 *
 * Token addresses and pool addresses verified from DexScreener
 * (chain slug: "robinhood") — highest-liquidity pool per token.
 *
 * Pool addresses are Uniswap v4 bytes32 pool IDs used by DexScreener
 * for price feeds. Enso Finance handles routing internally.
 */
export const BASKETS: BasketConfig[] = validateBaskets([
  {
    id: "top-memes",
    name: "Top Memes",
    description:
      "The three biggest meme coins on Robinhood Chain by market cap",
    constituents: [
      {
        symbol: "PONS",
        name: "Pons",
        address: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
        poolAddress: "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA",
        weight: 0.5,
      },
      {
        symbol: "CASHCAT",
        name: "Cash Cat",
        address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
        poolAddress: "0xA70fc67C9F5e4af0AA07a6c3F7Df00D6e83F3Ab8",
        weight: 0.3,
      },
      {
        symbol: "AI",
        name: "Artificial Inu",
        address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
        poolAddress:
          "0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27",
        weight: 0.2,
      },
    ],
  },
  {
    id: "mid-cap-memes",
    name: "Mid Cap Memes",
    description: "Higher risk, higher reward mid-cap memes on Robinhood Chain",
    constituents: [
      {
        symbol: "BONER",
        name: "Boner Coin",
        address: "0x98096d17e191B3dA1d5f99a6D7b3584351b11E18",
        poolAddress:
          "0x9c89b04303dfa76f3f6fb02c2b77be0e8a00ab8fa00d507119acd54ab3e8640d",
        weight: 0.35,
      },
      {
        symbol: "CHUMP",
        name: "Chump Coin",
        address: "0xEc0acde3cF4c5f98ce2C021e6Bd6eC475fEe278a",
        poolAddress: "0x1Ca479C00Cf7E4efA6799E4bFaceb11eB2Fa4202",
        weight: 0.35,
      },
      {
        symbol: "TENDIES",
        name: "TENDIES",
        address: "0x45242320DBB855EeA8Fd36804C6487E10E97FCF9",
        poolAddress: "0x237609918F330ADD285b8bC5f8f2922283D1C4C5",
        weight: 0.3,
      },
    ],
  },
  {
    id: "onchain-cats",
    name: "On-chain Cats",
    description: "The cat coins taking over Robinhood Chain",
    constituents: [
      {
        symbol: "CASHCAT",
        name: "Cash Cat",
        address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
        poolAddress: "0xa70fc67c9f69da90b63a0e4c05d229954574e313",
        weight: 0.4,
      },
      {
        symbol: "HMM",
        name: "Thinking Cat",
        address: "0x7FE995a80075dF3Dc8Ae11A9b82c7FE4202CD87f",
        poolAddress: "0x2b0d0183d017c58b924401ca8ac362f6e01f0e9e",
        weight: 0.35,
      },
      {
        symbol: "ROBINCAT",
        name: "ROBINCAT",
        address: "0xded852De9fe9bA9b6f27f39e8e81CF851A5C79cc",
        poolAddress:
          "0x05c53aa8db4ac905381ba999d92a40a13fc0bc93b5d0a287ca16dc107bd8d11b",
        weight: 0.25,
      },
    ],
  },
]);

/** Look up a basket by its id slug. Returns undefined when not found. */
export function getBasketById(id: string): BasketConfig | undefined {
  return BASKETS.find((b) => b.id === id);
}
