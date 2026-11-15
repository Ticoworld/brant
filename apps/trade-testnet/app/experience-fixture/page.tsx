"use client";
import { useEffect, useState } from "react";
import Experience, {
  type Fields,
  type MarketView,
  type Review,
  type Activity,
} from "../experience";
import { marketIdentity, type PageRoute } from "../../lib/market-reader";
const id = "0x" + "12".repeat(32),
  id2 = "0x" + "ab".repeat(32),
  hash = "0x" + "34".repeat(32),
  address = "ckt1_controlled_public_identity_fixture";
const base: Fields = {
  id: "",
  creator: "",
  slots: "2",
  maturity: "0",
  index: "0",
  amount: "0.125",
  buyer: "",
  price: "0.01",
  envelope: "",
};
// Labelled presentation callbacks only. No provider, private key, RPC, signing or broadcast.
export default function Fixture() {
  const [mode, setMode] = useState("active"),
    [ready, setReady] = useState(false),
    [route, setRoute] = useState<PageRoute>({ view: "Markets" }),
    [fields, setFields] = useState(base),
    [review, setReview] = useState<Review | null>(null),
    [message, setMessage] = useState(
      "Controlled local view. No wallet or transaction execution.",
    ),
    [error, setError] = useState(false),
    [failed, setFailed] = useState(false),
    [removed, setRemoved] = useState<string[]>([]),
    [discovered, setDiscovered] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search),
      state = q.get("state") ?? "active";
    setMode(state);
    if (q.get("view") === "market")
      setRoute({
        view: "Market",
        id,
        ...(q.has("claim") ? { claim: Number(q.get("claim")) } : {}),
      });
    setReady(true);
  }, []);
  if (process.env.NEXT_PUBLIC_LOCAL_FIXTURE !== "1")
    return (
      <main>
        <h1>Local UI fixture disabled</h1>
      </main>
    );
  if (!ready) return <main>Loading controlled UI fixture…</main>;
  const connected = mode !== "disconnected",
    supported = mode !== "unsupported",
    checked = connected && supported;
  const funding = ["funding", "funding-ready", "empty-market"].includes(mode),
    empty = mode === "empty-market",
    settled = mode === "settled",
    partial = mode === "partial",
    readyFunding = mode === "funding-ready";
  const first = {
    index: 0,
    owner: hash,
    contribution: empty ? "0" : "0.125",
    backing: empty || settled ? "0" : partial ? "0.05" : "0.1",
    mine: checked && !empty,
    empty,
    remaining: !empty && !settled,
  };
  const second = {
    index: 1,
    owner: id2,
    contribution: empty || (funding && !readyFunding) ? "0" : "0.125",
    backing: empty || settled || (funding && !readyFunding) ? "0" : "0.1",
    mine: false,
    empty: empty || (funding && !readyFunding),
    remaining: !empty && !settled && (!funding || readyFunding),
  };
  const m: MarketView = {
    id,
    phase: funding ? "Funding" : "Active",
    contributed: empty ? "0" : funding && !readyFunding ? "0.125" : "0.25",
    goal: "0.25",
    backing:
      empty || settled
        ? "0"
        : partial
          ? "0.15"
          : funding && !readyFunding
            ? "0.1"
            : "0.2",
    initialBacking: empty ? "0" : funding && !readyFunding ? "0.1" : "0.2",
    creatorAllocation: empty
      ? "0"
      : funding && !readyFunding
        ? "0.025"
        : "0.05",
    capacity: "322",
    minimum: "0.125",
    maturity: mode === "maturity" ? "200" : "120",
    tip: "150",
    creatorIsMe: checked,
    funderIsMe: checked,
    allFunded: funding && readyFunding,
    settled: empty || settled,
    root: hash,
    positions: [first, second],
  };
  const other: MarketView = {
    ...m,
    id: id2,
    phase: "Funding",
    contributed: "0.125",
    backing: "0.1",
    initialBacking: "0.1",
    creatorAllocation: "0.025",
    maturity: "200",
    allFunded: false,
    positions: [
      {
        ...first,
        backing: "0.1",
        contribution: "0.125",
        empty: false,
        remaining: true,
      },
      {
        ...second,
        contribution: "0",
        backing: "0",
        empty: true,
        remaining: false,
      },
    ],
  };
  const all = [m, other];
  const markets =
    ["empty", "nodeploy"].includes(mode) && !discovered
      ? []
      : all.filter((x) => !removed.includes(x.id));
  const selected = all.find((x) => x.id === route.id) ?? null;
  const unavailable = failed || mode === "nodeploy";
  function navigate(next: PageRoute) {
    setRoute(next);
    setReview(null);
    setFailed(false);
  }
  function open(value: string) {
    try {
      const identity = marketIdentity(value);
      let claim: number | undefined;
      if (value.includes("?claim="))
        claim = Number(
          new URL(value, "http://localhost").searchParams.get("claim"),
        );
      setFields((f) => ({
        ...f,
        id: identity,
        index: String(claim ?? 0),
        amount: "0.1",
        envelope: "",
      }));
      navigate({
        view: "Market",
        id: identity,
        ...(claim !== undefined ? { claim } : {}),
      });
      if (["rpc", "stale", "nodeploy", "missing-history"].includes(mode)) {
        setFailed(true);
        setRemoved((xs) => [...xs, identity]);
        setError(true);
        setMessage(
          mode === "nodeploy"
            ? "Pudge deployment is not configured."
            : mode === "stale"
              ? "Stale root. Rebuild and collect fresh consent."
              : "Committed historical witness unavailable. No actions can be prepared.",
        );
      }
    } catch (e) {
      setError(true);
      setMessage(String(e));
    }
  }
  function txReview(title: string) {
    const row = selected?.positions[Number(fields.index)];
    setReview({
      title,
      hash,
      fee: "0.001",
      lines: [
        {
          label: "Evidence",
          value: "CONTROLLED UI FIXTURE — no actual transaction",
        },
        { label: "Market", value: selected?.id ?? id },
        ...(title.startsWith("Create")
          ? [{ label: "Shared capacity", value: "322 CKB" }]
          : []),
        {
          label: "Gross amount",
          value: title.includes("refund")
            ? (row?.contribution ?? "0") + " CKB"
            : fields.amount + " CKB",
        },
        { label: "Initial backing", value: "80% of contributions" },
        { label: "Creator gross allocation", value: "20% at activation" },
      ],
      outputs: [
        {
          capacity: "322",
          lock: "Presentation fixture only — not a chain output",
        },
      ],
      button: "Confirm UI fixture",
    });
  }
  const events: Activity[] = ["pending", "committed"].includes(mode)
    ? [
        {
          label: "Controlled assignment fixture",
          state: mode === "pending" ? "Pending" : "Committed",
          detail:
            "Presentation only. No actual submission or transaction hash.",
        },
      ]
    : [];
  return (
    <Experience
      fixture
      route={route}
      onNavigate={(view) => navigate({ view })}
      onOpenMarket={open}
      onSelectPosition={(index) => {
        const r = selected?.positions[index];
        if (!r) return;
        setRoute((v) => ({ ...v, claim: index }));
        setFields((f) => ({
          ...f,
          index: String(index),
          amount:
            selected!.phase === "Funding"
              ? r.empty
                ? selected!.minimum
                : r.contribution
              : r.backing,
          buyer: r.mine ? "" : address,
          envelope: "",
        }));
        setReview(null);
      }}
      onClearPosition={() => {
        setRoute((v) => ({ ...v, claim: undefined }));
        setReview(null);
      }}
      markets={markets}
      discovery={{
        state: discovered ? "complete" : "idle",
        message: discovered
          ? "Two controlled markets in this fixture. Not chain discovery."
          : "Controlled fixture directory, not a verified public index.",
        scanned: discovered ? 2 : 0,
      }}
      onDiscover={() => setDiscovered(true)}
      loadingMarket={mode === "loading" && route.view === "Market"}
      readAvailable={mode !== "nodeploy"}
      fields={fields}
      update={(key, value) => {
        setFields((f) => ({ ...f, [key]: value }));
        setReview(null);
      }}
      address={checked ? address : ""}
      connected={connected}
      busy={mode === "loading"}
      deployment={mode === "nodeploy" ? "Not deployed" : "Configured"}
      status={
        mode === "unsupported"
          ? "This connected lock is unsupported. Ordinary CKB secp256k1 is required."
          : message
      }
      error={error || mode === "unsupported"}
      market={
        route.view === "Market" && !unavailable && mode !== "loading"
          ? selected
          : null
      }
      activity={events}
      review={review}
      onConnect={() =>
        setMessage("Fixture only: no external wallet connected.")
      }
      onCheck={() => setMessage("Fixture only: no wallet qualification.")}
      onRecover={() => route.id && open(route.id)}
      onCreate={() => txReview("Create backed-claim market")}
      onAction={(action) => txReview("Review " + action)}
      onOffer={(action) => {
        if (action === "prepare") {
          setFields((f) => ({
            ...f,
            envelope: JSON.stringify({ fixture: true, neverSubmit: true }),
          }));
          setMessage("Controlled offer file prepared — never submit.");
        } else txReview("Paid assignment: " + action);
      }}
      onConfirm={() => {
        setReview(null);
        setMessage(
          "Fixture review confirmed. No signature or broadcast occurred.",
        );
      }}
      onCancel={() => setReview(null)}
    />
  );
}
