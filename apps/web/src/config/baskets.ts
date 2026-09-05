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
 * Curated baskets for Robinhood Chain.
 *
 * Token addresses and pool addresses verified from DexScreener
 * (chain slug: "robinhood") — highest-liquidity pool per token.
 */
export const BASKETS: BasketConfig[] = validateBaskets([
  {
    id: "top-memes",
    name: "Blue Chips",
    description:
      "The three biggest meme coins on Robinhood Chain by market cap",
    constituents: [
      {
        symbol: "PONS",
        name: "Pons",
        address: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
        poolAddress: "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x39dbed3a2bd333467115de45665cc57f813c4571.png",
        weight: 0.5,
      },
      {
        symbol: "CASHCAT",
        name: "Cash Cat",
        address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
        poolAddress: "0xa70fc67c9f69da90b63a0e4c05d229954574e313",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x020bfc650a365f8bb26819deaabf3e21291018b4.png",
        weight: 0.3,
      },
      {
        symbol: "AI",
        name: "Artificial Inu",
        address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
        poolAddress:
          "0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x2e8c31162b855a2ffa90f6f8634643ad6f111e18.png",
        weight: 0.2,
      },
    ],
  },
  {
    id: "ai-infra",
    name: "AI & Infra",
    description:
      "AI and compute tokens building the next layer of Robinhood Chain",
    constituents: [
      {
        symbol: "AI",
        name: "Artificial Inu",
        address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
        poolAddress:
          "0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x2e8c31162b855a2ffa90f6f8634643ad6f111e18.png",
        weight: 0.5,
      },
      {
        symbol: "QGRID",
        name: "QuantumGrid",
        address: "0x7d4727A173aab10d158D6F164B671C92f99d6647",
        poolAddress: "0x2cfa7f54012aaa42c844d66a19c0d7cacd56d587",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x7d4727a173aab10d158d6f164b671c92f99d6647.png",
        weight: 0.3,
      },
      {
        symbol: "MICRON",
        name: "MICRON AI",
        address: "0x3B542B9B72441e4BA0E70885f983075C51ea5c16",
        poolAddress:
          "0xfb972b12f372eab17aca6073f22a1279f907ef1db2618d99dc5a8d72d8ee1430",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x3b542b9b72441e4ba0e70885f983075c51ea5c16.png",
        weight: 0.2,
      },
    ],
  },
  {
    id: "onchain-cats",
    name: "Feline Index",
    description: "The cat coins taking over Robinhood Chain",
    constituents: [
      {
        symbol: "CASHCAT",
        name: "Cash Cat",
        address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
        poolAddress: "0xa70fc67c9f69da90b63a0e4c05d229954574e313",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x020bfc650a365f8bb26819deaabf3e21291018b4.png",
        weight: 0.4,
      },
      {
        symbol: "HMM",
        name: "Thinking Cat",
        address: "0x7FE995a80075dF3Dc8Ae11A9b82c7FE4202CD87f",
        poolAddress: "0x2b0d0183d017c58b924401ca8ac362f6e01f0e9e",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x7fe995a80075df3dc8ae11a9b82c7fe4202cd87f.png",
        weight: 0.35,
      },
      {
        symbol: "ROBINCAT",
        name: "ROBINCAT",
        address: "0xded852De9fe9bA9b6f27f39e8e81CF851A5C79cc",
        poolAddress:
          "0x05c53aa8db4ac905381ba999d92a40a13fc0bc93b5d0a287ca16dc107bd8d11b",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0xded852de9fe9ba9b6f27f39e8e81cf851a5c79cc.png",
        weight: 0.25,
      },
    ],
  },
  {
    id: "launchpad-pack",
    name: "Launchpad Pack",
    description: "The dominant token launch platforms on Robinhood Chain",
    constituents: [
      {
        symbol: "PONS",
        name: "Pons",
        address: "0x39dBED3a2bd333467115dE45665cC57F813C4571",
        poolAddress: "0x10CC6BD38112cAc182db90B6a71d8Bb5939526bA",
        logoUrl:
          "https://dd.dexscreener.com/ds-data/tokens/robinhood/0x39dbed3a2bd333467115de45665cc57f813c4571.png",
        weight: 0.5,
      },
      {
        symbol: "HOOKR",
        name: "Hookr.fun",
        address: "0x18E674231A58c239Dc7DaeDcffE15Ec3A24cff5c",
        poolAddress:
          "0x590dcb6a87828bf688b48089a62239b693378f1fb64d2286e6a399ed8c005fdf",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/8HVsUvtM_VyD-mXb?width=800&height=800&quality=95&format=auto",
        weight: 0.3,
      },
      {
        symbol: "STONKBROKER",
        name: "StonkBroker",
        address: "0xe934e36A439C94017B64a3FecE66AF12099aBF50",
        poolAddress:
          "0xd33c8fd38b06e989cdbd4dffdefab71c4bdd415b24964c8d69e38ff35b068f92",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/_dQRN4wt4hctn71c?width=800&height=800&quality=95&format=auto",
        weight: 0.2,
      },
    ],
  },
  {
    id: "defi-core",
    name: "DeFi Core",
    description: "Native DeFi infrastructure powering Robinhood Chain",
    constituents: [
      {
        symbol: "DELTA",
        name: "Delta",
        address: "0xe8ffd7e24187F72afB08d75B1bb13088A989a791",
        poolAddress: "0xd64fbda67e1015df43fa5e49f02ca844729e5f94",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/R0D6i-QgKwRAa7sg?width=800&height=800&quality=95&format=auto",
        weight: 0.4,
      },
      {
        symbol: "UP",
        name: "up",
        address: "0x57C0E45cB534413D1C20A4240955d6bB250BB4F1",
        poolAddress: "0x23d641feccd207e8794c593e8240444a0674c4ba",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/ZIigH50N_HPHeoaX?width=800&height=800&quality=95&format=auto",
        weight: 0.35,
      },
      {
        symbol: "ARROW",
        name: "Arrow",
        address: "0xf2915d1e3C1B0c769d0c756Ec43F1c1f6c99cD03",
        poolAddress: "0xe40d98d88038e0b844f844dce6ae3c79ec01ec53",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/qVNDzbSwL8Gxq58J?width=800&height=800&quality=95&format=auto",
        weight: 0.25,
      },
    ],
  },
  {
    id: "mag-4",
    name: "Mag 4",
    description: "The four biggest tokenized equities on Robinhood Chain",
    constituents: [
      {
        symbol: "NVDA",
        name: "NVIDIA • Robinhood Token",
        address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
        poolAddress: "0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3",
        logoUrl: "/stocks/nvda.png",
        weight: 0.3,
      },
      {
        symbol: "AAPL",
        name: "Apple • Robinhood Token",
        address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
        poolAddress: "0xaae0d815ee56e4092a5e5c2911e676fea50b2d6d",
        logoUrl: "/stocks/aapl.png",
        weight: 0.3,
      },
      {
        symbol: "TSLA",
        name: "Tesla • Robinhood Token",
        address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
        poolAddress: "0xf4acdaeeb7022862a763c9b1b885e11191c889e3",
        logoUrl: "/stocks/tsla.png",
        weight: 0.2,
      },
      {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust • Robinhood Token",
        address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
        poolAddress: "0xddcbba3666f578e3f09516f21ff85bfee859ab5e",
        logoUrl: "/stocks/sp500.png",
        weight: 0.2,
      },
    ],
  },
  {
    id: "paired",
    name: "Paired",
    description:
      "Meme coins paired with tokenized stocks — the defining meta of Robinhood Chain",
    constituents: [
      {
        symbol: "NUDES",
        name: "Send Nudes",
        address: "0xbe98b75361935b18d688409424a869a4C3dC7401",
        poolAddress:
          "0x383957bce2341f59ff97c47eda2ad3b3b839b7050adc8a4747a398abca0ad552",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/32efGaEMuDFyUCLi?width=800&height=800&quality=95&format=auto",
        weight: 0.4,
      },
      {
        symbol: "BONER",
        name: "Boner Coin",
        address: "0x98096d17e191B3dA1d5f99a6D7b3584351b11E18",
        poolAddress:
          "0x9c89b04303dfa76f3f6fb02c2b77be0e8a00ab8fa00d507119acd54ab3e8640d",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/zHSvsb5W3vIdMePa?width=800&height=800&quality=95&format=auto",
        weight: 0.35,
      },
      {
        symbol: "microduck",
        name: "microduck",
        address: "0xD5f1afEA47b1A9eab414D2ee740cF1d6d039E725",
        poolAddress:
          "0xcde4d35e341901bc0308c2ffc789448ccd0f238a59597fe702e6710484b9c370",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/PRPmxR0LalitfHcU?width=800&height=800&quality=95&format=auto",
        weight: 0.25,
      },
    ],
  },
  {
    id: "speculative",
    name: "Speculative",
    description: "High-conviction early-stage plays on Robinhood Chain",
    constituents: [
      {
        symbol: "urmom",
        name: "ur mom",
        address: "0x4874845b0d4aCffd896DdE1E42828A543717AF7f",
        poolAddress:
          "0x826ae3756e19d32a75cad183ce156554864f0087aa55879f33a7b8fb82ff4eee",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/z7P7xZsuuI8HPMQx?width=800&height=800&quality=95&format=auto",
        weight: 0.4,
      },
      {
        symbol: "PIPEDOG",
        name: "pipedog",
        address: "0x5Cb6F181081301b44905F3ae15419112ecaBd8A6",
        poolAddress: "0xb7f10f74b39291b9290b779978e19a7637c742d6",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/4S5N79kV0jhT7y6K?width=800&height=800&quality=95&format=auto",
        weight: 0.35,
      },
      {
        symbol: "MEME",
        name: "A Meme Coin",
        address: "0x385F4f8ae47651ce5F58F5265395a669f8281e18",
        poolAddress:
          "0xc6e298e137f2905398db87e6eae49ede64d231fee37330fa433fec917f4618b6",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/pPWqEwHoGm1tbUMt?width=800&height=800&quality=95&format=auto",
        weight: 0.25,
      },
    ],
  },
  {
    id: "elon-coded",
    name: "Elon-Coded",
    description:
      "Meme coins paired with SPCX — pure Elon/SpaceX narrative plays",
    constituents: [
      {
        symbol: "18932",
        name: "Robinhood Asteroid",
        address: "0x5759A852243A56A48853Af1d28fd4e0f33747C9B",
        poolAddress:
          "0xedf5d3c9f4a0cb59734c13e73309d70ddafa19ca113790449311554a6f6c4f4e",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/4Hg0txNIr17lqBph?width=800&height=800&quality=95&format=auto",
        weight: 0.4,
      },
      {
        symbol: "DOGE-1",
        name: "DOGE-1",
        address: "0x3eC8A8174129D5cBeCef67eE2AF8621319c34c03",
        poolAddress:
          "0x037dea9a1851a87f997c42cc9bf18659675f642d01d28fc7b1cc94695a0ad54c",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/RUqi9brv6X8jlQgT?width=800&height=800&quality=95&format=auto",
        weight: 0.35,
      },
      {
        symbol: "urmom",
        name: "ur mom",
        address: "0x4874845b0d4aCffd896DdE1E42828A543717AF7f",
        poolAddress:
          "0x826ae3756e19d32a75cad183ce156554864f0087aa55879f33a7b8fb82ff4eee",
        logoUrl:
          "https://cdn.dexscreener.com/cms/images/z7P7xZsuuI8HPMQx?width=800&height=800&quality=95&format=auto",
        weight: 0.25,
      },
    ],
  },
]);

/** Look up a basket by its id slug. Returns undefined when not found. */
export function getBasketById(id: string): BasketConfig | undefined {
  return BASKETS.find((b) => b.id === id);
}
