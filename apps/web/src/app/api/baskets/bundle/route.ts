import { NextResponse } from "next/server";
import { BASKETS } from "@/config/baskets";

const ENSO = "https://api.enso.finance/api/v1";
const ETH  = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

interface BundleRequest {
  basketId: string;
  fromAddress: string;
  amountInWei: string;
  tokenIn: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ENSO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ENSO_API_KEY not configured" }, { status: 500 });
  }

  const body = (await req.json()) as BundleRequest;
  const basket = BASKETS.find((b) => b.id === body.basketId);
  if (!basket) {
    return NextResponse.json({ error: `Basket "${body.basketId}" not found` }, { status: 404 });
  }

  const amountWei = BigInt(body.amountInWei);
  const tokenIn   = (body.tokenIn || ETH) as `0x${string}`;

  const actions = basket.constituents.map((c) => ({
    protocol: "enso",
    action: "route",
    args: {
      tokenIn,
      tokenOut: c.address,
      amountIn: ((amountWei * BigInt(Math.round(c.weight * 1e6))) / BigInt(1e6)).toString(),
      slippage: 50,
    },
  }));

  const params = new URLSearchParams({
    chainId: "4663",
    fromAddress: body.fromAddress,
    routingStrategy: "router",
    receiver: body.fromAddress,
  });

  const ensoRes = await fetch(`${ENSO}/shortcuts/bundle?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(actions),
  });

  if (!ensoRes.ok) {
    const msg = await ensoRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Enso API error (${ensoRes.status})`, detail: msg },
      { status: ensoRes.status }
    );
  }

  const data = (await ensoRes.json()) as { tx: { to: string; data: string; value: string } };
  return NextResponse.json({ tx: data.tx });
}
