"use client";
import { useEffect, useState } from "react";
import Experience, {
  type Fields,
  type MarketView,
  type Review,
  type Activity,
} from "../experience";
const id = "0x" + "12".repeat(32),
  hash = "0x" + "34".repeat(32);
const base: Fields = {
  id,
  creator: "",
  slots: "2",
  maturity: "120",
  index: "0",
  amount: "0.1",
  buyer: "Controlled buyer address — UI fixture only",
  price: "0.01",
  envelope: "",
};
// Presentation fixtures only. No provider, key, signer, RPC or transaction builder is installed here.
export default function Fixture() {
  const [mode, setMode] = useState("active"),
    [fields, setFields] = useState(base),
    [review, setReview] = useState<Review | null>(null),
    [message, setMessage] = useState(
      "Controlled local view. No wallet or transaction execution.",
    ),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setMode(
      new URLSearchParams(window.location.search).get("state") ?? "active",
    );
    setReady(true);
  }, []);
  if (process.env.NEXT_PUBLIC_LOCAL_FIXTURE !== "1")
    return (
      <main>
        <h1>Local UI fixture disabled</h1>
        <p>No fixture state is available in the ordinary app.</p>
      </main>
    );
  if (!ready) return <main>Loading controlled UI fixture…</main>;
  const funding = mode === "funding",
    connected = !["disconnected", "empty"].includes(mode),
    supported = mode !== "unsupported";
  const m: MarketView = {
    id,
    phase: funding ? "Funding" : "Active",
    backing: "0.2",
    capacity: "322",
    minimum: "0.125",
    maturity: mode === "maturity" ? "200" : "120",
    tip: "150",
    creatorIsMe: true,
    funderIsMe: true,
    allFunded: true,
    settled: false,
    root: hash,
    positions: [
      {
        index: 0,
        owner: hash,
        contribution: "0.125",
        backing: "0.1",
        mine: connected && supported,
        empty: false,
        remaining: true,
      },
      {
        index: 1,
        owner: id,
        contribution: "0.125",
        backing: "0.1",
        mine: false,
        empty: false,
        remaining: true,
      },
    ],
  };
  const txReview = (title: string) =>
    setReview({
      title,
      hash,
      fee: "0.001",
      lines: [
        { label: "Evidence", value: "UI FIXTURE — no real transaction" },
        { label: "Market", value: id },
        ...(title === "Create backed-claim market" ? [
          { label: "Shared market capacity", value: "322 CKB" },
          { label: "Slots", value: fields.slots },
          { label: "Minimum contribution", value: "0.125 CKB per slot" },
          { label: "Backing / creator proceeds", value: "80% reserved / 20% gross at activation" },
          { label: "Maturity block", value: fields.maturity },
        ] : [
          { label: "Buyer pays seller", value: "0.01 CKB" },
          { label: "Protected backing", value: "0.1 CKB" },
        ]),
      ],
      outputs: [
        { capacity: title === "Create backed-claim market" ? "322" : "322.2", lock: "Controlled lock display — no chain state" },
      ],
      button: "Confirm UI fixture",
    });
  const events: Activity[] = ["pending", "committed", "stale"].includes(mode)
    ? [
        {
          label: "Controlled assignment fixture",
          state:
            mode === "pending"
              ? "Pending"
              : mode === "stale"
                ? "Failed"
                : "Committed",
          detail:
            mode === "stale"
              ? "Stale transaction. Refresh, rebuild and give fresh consent."
              : "UI fixture only; not an actual submitted transaction.",
        },
      ]
    : [];
  return (
    <Experience
      fixture
      fields={fields}
      update={(key, value) => {
        setFields((f) => ({ ...f, [key]: value }));
        setReview(null);
      }}
      address={
        connected && supported ? "ckt1_controlled_public_identity_fixture" : ""
      }
      connected={connected}
      busy={mode === "loading"}
      deployment={mode === "nodeploy" ? "Not deployed" : "Configured"}
      market={["empty", "disconnected", "nodeploy"].includes(mode) ? null : m}
      status={
        mode === "unsupported"
          ? "This connected lock is unsupported. Select an ordinary CKB secp256k1 account."
          : mode === "rpc"
            ? "RPC or historical witness unavailable. Signing stopped."
            : mode === "stale"
              ? "Stale transaction: refresh, rebuild and give fresh consent."
              : message
      }
      error={["unsupported", "rpc", "stale"].includes(mode)}
      activity={events}
      review={review}
      onConnect={() =>
        setMessage("Fixture only: no external wallet connected.")
      }
      onCheck={() => setMessage("Fixture only: no wallet qualification.")}
      onRecover={() =>
        setMessage("Fixture only: no chain recovery was executed.")
      }
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
          "Fixture review confirmed. No signature, transaction or broadcast occurred.",
        );
      }}
      onCancel={() => setReview(null)}
    />
  );
}
