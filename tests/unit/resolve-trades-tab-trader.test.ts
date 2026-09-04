import { beforeEach, describe, expect, it, vi } from "vitest";
import * as gamma from "../../apps/server/src/features/markets/lib/gamma";
import { resolveTradesTabTrader } from "../../apps/server/src/features/markets/lib/resolve-trades-tab-trader";
import type { ValidatedSearchResult } from "../../apps/server/src/features/markets/schemas/gamma";

vi.mock("../../apps/server/src/features/markets/lib/gamma", () => ({
  getPublicProfile: vi.fn(),
  fetchPublicSearchForTraderResolve: vi.fn(),
}));

const wallet40 = "0xdd22472e552920b8438158ea7238bfadfa4f736a";

function searchHit(
  partial: Partial<ValidatedSearchResult["profiles"][number]> & {
    proxyWallet: string;
  }
): ValidatedSearchResult["profiles"][number] {
  return {
    id: partial.id ?? "1",
    name: partial.name ?? null,
    pseudonym: partial.pseudonym ?? null,
    proxyWallet: partial.proxyWallet,
    username: partial.username ?? "",
    address: partial.address ?? partial.proxyWallet,
    pfp: partial.pfp ?? "",
    profileImage: partial.profileImage ?? null,
    bio: partial.bio ?? null,
  } as ValidatedSearchResult["profiles"][number];
}

describe("resolveTradesTabTrader", () => {
  beforeEach(() => {
    vi.mocked(gamma.getPublicProfile).mockReset();
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockReset();
  });

  it("returns null for whitespace-only query", async () => {
    await expect(resolveTradesTabTrader("   ")).resolves.toBeNull();
    expect(gamma.getPublicProfile).not.toHaveBeenCalled();
    expect(gamma.fetchPublicSearchForTraderResolve).not.toHaveBeenCalled();
  });

  it("resolves wallet via public profile proxyWallet", async () => {
    vi.mocked(gamma.getPublicProfile).mockResolvedValue({
      proxyWallet: "0xAAA0000000000000000000000000000000000001",
    } as Awaited<ReturnType<typeof gamma.getPublicProfile>>);
    await expect(
      resolveTradesTabTrader(`  ${wallet40.toUpperCase()}  `)
    ).resolves.toEqual({
      proxyWallet: "0xaaa0000000000000000000000000000000000001",
    });
    expect(gamma.getPublicProfile).toHaveBeenCalledWith(wallet40.toLowerCase());
    expect(gamma.fetchPublicSearchForTraderResolve).not.toHaveBeenCalled();
  });

  it("returns null when public profile missing", async () => {
    vi.mocked(gamma.getPublicProfile).mockResolvedValue(null);
    await expect(resolveTradesTabTrader(wallet40)).resolves.toBeNull();
  });

  it("returns null when profile has no proxyWallet", async () => {
    vi.mocked(gamma.getPublicProfile).mockResolvedValue({
      proxyWallet: null,
    } as Awaited<ReturnType<typeof gamma.getPublicProfile>>);
    await expect(resolveTradesTabTrader(wallet40)).resolves.toBeNull();
  });

  it("resolves exact display name with single profile", async () => {
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockResolvedValue({
      profiles: [
        searchHit({
          name: "ExactTrader",
          pseudonym: null,
          proxyWallet: "0xbbb0000000000000000000000000000000000002",
          username: "ExactTrader",
        }),
      ],
      markets: [],
      events: [],
      pagination: { hasMore: false, totalResults: 1 },
    } as ValidatedSearchResult);
    await expect(resolveTradesTabTrader("exacttrader")).resolves.toEqual({
      proxyWallet: "0xbbb0000000000000000000000000000000000002",
    });
    expect(gamma.fetchPublicSearchForTraderResolve).toHaveBeenCalledWith(
      "exacttrader"
    );
    expect(gamma.getPublicProfile).not.toHaveBeenCalled();
  });

  it("matches custom name when display username differs", async () => {
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockResolvedValue({
      profiles: [
        searchHit({
          name: "CustomNick",
          pseudonym: "Utter-Mean",
          proxyWallet: "0xccc0000000000000000000000000000000000003",
          username: "CustomNick",
        }),
      ],
      markets: [],
      events: [],
      pagination: { hasMore: false, totalResults: 1 },
    } as ValidatedSearchResult);
    await expect(resolveTradesTabTrader("customnick")).resolves.toEqual({
      proxyWallet: "0xccc0000000000000000000000000000000000003",
    });
  });

  it("matches pseudonym when user types pseudonym", async () => {
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockResolvedValue({
      profiles: [
        searchHit({
          name: "ShownName",
          pseudonym: "HiddenHandle",
          proxyWallet: "0xddd0000000000000000000000000000000000004",
          username: "ShownName",
        }),
      ],
      markets: [],
      events: [],
      pagination: { hasMore: false, totalResults: 1 },
    } as ValidatedSearchResult);
    await expect(resolveTradesTabTrader("hiddenhandle")).resolves.toEqual({
      proxyWallet: "0xddd0000000000000000000000000000000000004",
    });
  });

  it("returns null when two profiles share the same display name", async () => {
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockResolvedValue({
      profiles: [
        searchHit({
          name: "Dup",
          proxyWallet: "0x1110000000000000000000000000000000000001",
          username: "Dup",
        }),
        searchHit({
          id: "2",
          name: "Dup",
          proxyWallet: "0x2220000000000000000000000000000000000002",
          username: "Dup",
        }),
      ],
      markets: [],
      events: [],
      pagination: { hasMore: false, totalResults: 2 },
    } as ValidatedSearchResult);
    await expect(resolveTradesTabTrader("dup")).resolves.toBeNull();
  });

  it("returns null when no profile matches name", async () => {
    vi.mocked(gamma.fetchPublicSearchForTraderResolve).mockResolvedValue({
      profiles: [
        searchHit({
          name: "Other",
          proxyWallet: "0x3330000000000000000000000000000000000003",
          username: "Other",
        }),
      ],
      markets: [],
      events: [],
      pagination: { hasMore: false, totalResults: 1 },
    } as ValidatedSearchResult);
    await expect(resolveTradesTabTrader("nope")).resolves.toBeNull();
  });
});
