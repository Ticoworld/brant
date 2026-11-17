import { marketIdentity } from "../../../../lib/pudge/market-reader.ts";
import registry from "../../../../public/pudge-markets.json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = marketIdentity(new URL(request.url).searchParams.get("id") ?? "");
    if (!registry.markets.some((item) => item.id === id))
      return Response.json({ error: "Market is not in the verified Pudge registry." }, { status: 404 });
    return Response.json(
      {
        marketId: id,
        executions: [],
        complete: false,
        reason: "The verified deployment records backed-claim transitions, not token executions or price history.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Market history is unavailable." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
