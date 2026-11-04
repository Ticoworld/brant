"use client";
import { useEffect, useRef, useState } from "react";
export type Tab = "Markets" | "My Positions" | "Create Market" | "Activity";
export type Fields = {
  id: string;
  creator: string;
  slots: string;
  maturity: string;
  index: string;
  amount: string;
  buyer: string;
  price: string;
  envelope: string;
};
export type Position = {
  index: number;
  owner: string;
  contribution: string;
  backing: string;
  mine: boolean;
  empty: boolean;
  remaining: boolean;
};
export type MarketView = {
  id: string;
  phase: "Funding" | "Active";
  backing: string;
  capacity: string;
  minimum: string;
  maturity: string;
  tip: string | null;
  creatorIsMe: boolean;
  funderIsMe: boolean;
  allFunded: boolean;
  settled: boolean;
  positions: Position[];
  root: string;
};
export type Activity = {
  label: string;
  state:
    | "Awaiting wallet"
    | "Pending"
    | "Committed"
    | "Unconfirmed"
    | "Failed"
    | "Signed";
  hash?: string;
  detail: string;
};
export type Review = {
  title: string;
  hash: string;
  fee: string;
  lines: { label: string; value: string }[];
  outputs: { capacity: string; lock: string }[];
  button: string;
};
export type ExperienceProps = {
  fields: Fields;
  update: (name: keyof Fields, value: string) => void;
  address: string;
  connected: boolean;
  busy: boolean;
  deployment: "Checking" | "Not deployed" | "Configured" | "Unavailable";
  status: string;
  error: boolean;
  market: MarketView | null;
  activity: Activity[];
  review: Review | null;
  onConnect: () => void;
  onCheck: () => void;
  onRecover: () => void;
  onCreate: () => void;
  onAction: (
    action: "contribute" | "activate" | "refund" | "redeem" | "close",
  ) => void;
  onOffer: (action: "prepare" | "sign" | "submit") => void;
  onConfirm: () => void;
  onCancel: () => void;
  fixture?: boolean;
};
const short = (s: string) =>
  s.length > 24 ? s.slice(0, 8) + "…" + s.slice(-6) : s;
function CellMark({ seed = 0 }: { seed?: number }) {
  return (
    <svg
      className="cell-mark"
      width="32"
      height="34"
      viewBox="0 0 34 36"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 2h9l3 3v10H3V2Z" fill="currentColor" />
      <path
        d="M21 2h9l3 3v10H21V2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={seed % 2 ? "currentColor" : "none"}
      />
      <path d="M12 22h9l3 3v10H12V22Z" fill="currentColor" opacity=".65" />
      <path d="M9 17v2h18v-2M18 19v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function totalBacking(rows: Position[]) {
  let n = 0n;
  for (const r of rows) {
    const [a, b = ""] = r.backing.split(".");
    n += BigInt(a) * 100000000n + BigInt(b.padEnd(8, "0"));
  }
  return (
    n / 100000000n +
    "." +
    (n % 100000000n).toString().padStart(8, "0")
  ).replace(/\.?0+$/, "");
}
function Icon({
  name,
}: {
  name: "search" | "arrow" | "close" | "plus" | "refresh" | "wallet" | "file";
}) {
  const d = {
    search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5-2 5 5",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    close: "m6 6 12 12M6 18 18 6",
    plus: "M12 4v16M4 12h16",
    refresh:
      "M20 7v5h-5M4 17v-5h5M5 8a7 7 0 0 1 12-3l3 4M4 15l3 4a7 7 0 0 0 12-3",
    wallet: "M3 6h17v14H3V6Zm0 0 13-3v3m0 6h5v4h-5v-4",
    file: "M5 3h9l5 5v13H5V3Zm9 0v5h5M8 13h8m-8 4h6",
  }[name];
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
function ReviewDialog({
  review,
  busy,
  onConfirm,
  onCancel,
}: {
  review: Review;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current,
      before = document.activeElement as HTMLElement;
    d?.showModal();
    return () => {
      d?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="review-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="dialog-heading">
        <h2 id="review-title">{review.title}</h2>
        <button
          className="icon-button"
          aria-label="Close transaction review"
          onClick={onCancel}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      <dl className="review-lines">
        {review.lines.map((x) => (
          <div key={x.label}>
            <dt>{x.label}</dt>
            <dd>{x.value}</dd>
          </div>
        ))}
        <div>
          <dt>Network fee</dt>
          <dd>{review.fee} CKB</dd>
        </div>
      </dl>
      <details>
        <summary>Transaction details</summary>
        <code>{review.hash}</code>
        {review.outputs.map((o, i) => (
          <div className="output" key={i}>
            <b>
              Output {i} · {o.capacity} CKB
            </b>
            <code>{o.lock}</code>
          </div>
        ))}
      </details>
      <p className="hint">
        Approve only these terms. Changed inputs require a new review and fresh
        signatures.
      </p>
      <div className="dialog-actions">
        <button onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Checking…" : review.button}
        </button>
      </div>
    </dialog>
  );
}
function Amount({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="amount-field" htmlFor={id}>
      <span>{label}</span>
      <div>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          disabled={disabled}
          autoComplete="off"
        />
        <span className="asset">
          <span className="asset-mark" aria-hidden="true">
            <img src="/assets/ckb.svg" alt="" width="12" height="12" />
          </span>
          CKB
        </span>
      </div>
    </label>
  );
}
function net(value: string) {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return "—";
  const [a, b = ""] = value.split(".");
  const n = BigInt(a) * 100000000n + BigInt(b.padEnd(8, "0")) - 100000n;
  if (n < 0n) return "—";
  return (
    n / 100000000n +
    "." +
    (n % 100000000n).toString().padStart(8, "0")
  ).replace(/\.?0+$/, "");
}
export default function Experience(p: ExperienceProps) {
  const [tab, setTab] = useState<Tab>("Markets"),
    [action, setAction] = useState<"redeem" | "sell" | "import">("redeem"),
    [shareError, setShareError] = useState("");
  const f = p.fields,
    m = p.market,
    locked = p.busy || !p.address || p.deployment !== "Configured",
    selected = m?.positions.find((r) => r.index === Number(f.index));
  const mature =
    !!m &&
    (m.maturity === "0" ||
      (m.tip !== null && BigInt(m.tip) >= BigInt(m.maturity)));
  const change =
    (key: keyof Fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      p.update(key, e.target.value);
  const initialStatus = /^Connect a supported|^Controlled local view/.test(
    p.status,
  );
  const eligible =
    m?.positions.filter(
      (r) => r.mine && !r.empty && (m.phase === "Funding" || r.remaining),
    ) ?? [];
  function select(r: Position) {
    p.update("index", String(r.index));
    if (window.matchMedia("(max-width:720px)").matches)
      requestAnimationFrame(() => {
        const panel = document.getElementById("position-actions");
        panel?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
        panel?.focus({ preventScroll: true });
      });
    p.update(
      "amount",
      m?.phase === "Active" ? r.backing : (m?.minimum ?? "0.125"),
    );
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([f.envelope], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "trade-assignment.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const blocker = locked ? (
    <p className="blocker">
      {!p.address
        ? "Connect and verify your wallet."
        : "Contract deployment pending approval."}
    </p>
  ) : null;
  const terms = (
    <details className="terms-disclosure">
      <summary>Market terms</summary>
      <dl>
        <div>
          <dt>Initial CKB backing</dt>
          <dd>80% of contributions</dd>
        </div>
        <div>
          <dt>Creator proceeds</dt>
          <dd>20% gross at activation</dd>
        </div>
        <div>
          <dt>Maturity</dt>
          <dd>
            {m?.maturity === "0"
              ? "No added delay"
              : m
                ? "Block " + m.maturity
                : "Set at creation"}
          </dd>
        </div>
        <div>
          <dt>Receiving capacity</dt>
          <dd>61 CKB retained in a plain secp Cell</dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd>Public history + live market Cell</dd>
        </div>
      </dl>
      <p>
        CKB backing does not protect the USD value. No guaranteed buyer,
        immediate settlement or unconditional small withdrawal.
      </p>
    </details>
  );
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Trade home">
          <CellMark />
          trade<span className="network">CKB TESTNET</span>
        </a>
        <nav className="navigation" aria-label="Main navigation">
          {(
            ["Markets", "My Positions", "Activity", "Create Market"] as Tab[]
          ).map((t) => (
            <button
              key={t}
              aria-current={t === tab ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t === "My Positions" ? (
                "Positions"
              ) : t === "Create Market" ? (
                <>
                  <Icon name="plus" />
                  Create market
                </>
              ) : (
                t
              )}
            </button>
          ))}
        </nav>
        <div className="wallet-area">
          <button
            className={p.address ? "wallet-connected" : "primary"}
            disabled={p.busy}
            onClick={p.onConnect}
          >
            {p.address ? short(p.address) : "Connect wallet"}
          </button>
        </div>
      </header>
      <main id="workspace" tabIndex={-1} aria-busy={p.busy}>
        {p.fixture && (
          <div className="fixture-banner">
            CONTROLLED LOCAL UI FIXTURE · no wallet, liquidity or Pudge
            execution
          </div>
        )}
        {p.connected && !p.address && (
          <div className="wallet-check">
            <span>Wallet verification required</span>
            <button onClick={p.onCheck} disabled={p.busy}>
              Check wallet compatibility
            </button>
          </div>
        )}
        <div
          className={
            "status-bar " +
            (p.error ? "status-error" : "") +
            (initialStatus && !p.busy && !p.error ? " sr-only" : "")
          }
          role={p.error ? "alert" : "status"}
        >
          {p.busy && <span className="spinner" aria-hidden="true" />}
          <p>{p.status}</p>
        </div>
        {tab === "Markets" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Markets</h1>
              </div>
              <form
                className="market-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  p.onRecover();
                }}
              >
                <Icon name="search" />
                <label className="sr-only" htmlFor="market-id">
                  Market link or identity
                </label>
                <input
                  id="market-id"
                  disabled={p.busy}
                  value={f.id}
                  onChange={change("id")}
                  placeholder="Paste market link or ID"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="search-submit"
                  disabled={p.busy || !f.id.trim()}
                  aria-label="Open market"
                >
                  <Icon name="arrow" />
                </button>
              </form>
            </div>
            <div className="market-toolbar">
              <span className="filter-selected">Backed claims</span>
            </div>
            <div className="table-wrap">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Status</th>
                    <th className="number">CKB backing</th>
                    <th className="number optional-col">Participants</th>
                    <th className="optional-col">Maturity</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {m ? (
                    <tr>
                      <td>
                        <span className="market-name">
                          <span className="market-token" aria-hidden="true">
                            <CellMark seed={m.positions.length} />
                          </span>
                          <span>
                            <b>CKB claim market</b>
                            <small>{short(m.id)}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            "phase " + (m.phase === "Active" ? "positive" : "")
                          }
                        >
                          {m.phase}
                        </span>
                      </td>
                      <td className="number">{m.backing}</td>
                      <td className="number optional-col">
                        {m.positions.filter((r) => !r.empty).length} /{" "}
                        {m.positions.length}
                      </td>
                      <td className="optional-col">
                        {m.maturity === "0"
                          ? "No delay"
                          : "Block " + m.maturity}
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={() => setTab("My Positions")}
                          aria-label="View positions"
                        >
                          <Icon name="arrow" />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">
                          <Icon name="search" />
                          <h2>No market selected</h2>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>
                {m
                  ? p.fixture
                    ? "Controlled presentation state"
                    : "Verified from committed history"
                  : "No public market directory connected"}
              </span>
              {m && (
                <button
                  className="text-button"
                  disabled={p.busy}
                  onClick={p.onRecover}
                >
                  <Icon name="refresh" />
                  Refresh
                </button>
              )}
            </div>
          </>
        )}
        {tab === "My Positions" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Positions</h1>
                {m && (
                  <span className="subtle">
                    {short(m.id)} <span className="separator">/</span> {m.phase}
                  </span>
                )}
              </div>
              {m && (
                <button
                  className="text-button"
                  onClick={p.onRecover}
                  disabled={p.busy}
                >
                  <Icon name="refresh" />
                  Refresh
                </button>
              )}
            </div>
            {!m ? (
              <div className="standalone-empty">
                <Icon name="wallet" />
                <h2>No market selected</h2>
                <p>Open a market to view your positions.</p>
                <button onClick={() => setTab("Markets")}>Open market</button>
              </div>
            ) : (
              <div className="position-workspace">
                <section
                  className="position-book"
                  aria-label="Market positions"
                >
                  <div className="inventory-strip">
                    <div>
                      <span className="micro-label">OWNED POSITIONS</span>
                      <strong>
                        {p.address
                          ? String(eligible.length).padStart(2, "0")
                          : "—"}
                      </strong>
                    </div>
                    <div className="inventory-value">
                      <span className="micro-label">
                        YOUR BACKING · THIS MARKET
                      </span>
                      <strong>
                        {p.address ? totalBacking(eligible) : "—"}{" "}
                        <small>CKB</small>
                      </strong>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="position-table">
                      <thead>
                        <tr>
                          <th>Claim</th>
                          <th>Owner</th>
                          <th className="number optional-col">Contributed</th>
                          <th className="number">Backing</th>
                          <th>
                            <span className="sr-only">Select</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.positions.map((r) => (
                          <tr
                            key={r.index}
                            className={
                              r.index === Number(f.index) ? "selected-row" : ""
                            }
                          >
                            <td>
                              <span className="claim-identity">
                                <span className="claim-glyph">
                                  <CellMark seed={r.index} />
                                </span>
                                <b>#{r.index}</b>
                              </span>
                              <small>
                                {r.empty
                                  ? "Open"
                                  : m.phase === "Funding"
                                    ? "Funding"
                                    : !r.remaining
                                      ? "Redeemed"
                                      : mature
                                        ? "Ready"
                                        : "Locked"}
                              </small>
                            </td>
                            <td>
                              {r.empty ? (
                                "—"
                              ) : r.mine ? (
                                <span className="owner-you">You</span>
                              ) : (
                                <span title={r.owner}>Other owner</span>
                              )}
                            </td>
                            <td className="number optional-col">
                              {r.empty ? "—" : r.contribution}
                            </td>
                            <td className="number">{r.backing}</td>
                            <td>
                              <button
                                className="row-action"
                                aria-label={"Select claim " + r.index}
                                aria-pressed={Number(f.index) === r.index}
                                onClick={() => select(r)}
                              >
                                <Icon name="arrow" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="book-foot">
                    <span>{m.backing} CKB reserved</span>
                    <span>{m.positions.length} slots</span>
                  </div>
                  {terms}
                  {(m.creatorIsMe || m.funderIsMe) && (
                    <details>
                      <summary>Market controls</summary>
                      <div className="actions">
                        <button
                          disabled={
                            locked ||
                            !m.creatorIsMe ||
                            m.phase !== "Funding" ||
                            !m.allFunded
                          }
                          onClick={() => p.onAction("activate")}
                        >
                          Review activation
                        </button>
                        <button
                          disabled={locked || !m.funderIsMe || !m.settled}
                          onClick={() => p.onAction("close")}
                        >
                          Review closure
                        </button>
                      </div>
                    </details>
                  )}
                </section>
                <section
                  id="position-actions"
                  tabIndex={-1}
                  className="action-panel"
                  aria-label="Position actions"
                >
                  <div className="ticket-heading">
                    <span className="ticket-identity">
                      <CellMark seed={Number(f.index)} />
                      <span>Claim #{f.index}</span>
                    </span>
                    <span className="phase">
                      {selected?.mine
                        ? "You own this"
                        : selected?.empty
                          ? "Open slot"
                          : "Other owner"}
                    </span>
                  </div>
                  {m.phase === "Active" ? (
                    <div className="action-tabs">
                      <button
                        aria-pressed={action === "redeem"}
                        onClick={() => setAction("redeem")}
                      >
                        Redeem
                      </button>
                      <button
                        aria-pressed={action === "sell"}
                        onClick={() => setAction("sell")}
                      >
                        Sell
                      </button>
                      <button
                        aria-pressed={action === "import"}
                        onClick={() => setAction("import")}
                      >
                        Import offer
                      </button>
                    </div>
                  ) : (
                    <div className="ticket-label">Contribution</div>
                  )}
                  {m.phase === "Funding" || action === "redeem" ? (
                    <>
                      <Amount
                        id="claim-amount"
                        label={
                          m.phase === "Funding"
                            ? "You contribute"
                            : "Redeem amount"
                        }
                        value={f.amount}
                        onChange={(v) => p.update("amount", v)}
                        disabled={p.busy}
                      />
                      <dl className="ticket-summary">
                        <div>
                          <dt>Available backing</dt>
                          <dd>{selected?.backing ?? "—"} CKB</dd>
                        </div>
                        <div>
                          <dt>Network fee</dt>
                          <dd>0.001 CKB</dd>
                        </div>
                        {m.phase === "Active" ? (
                          <div className="total">
                            <dt>You receive</dt>
                            <dd>{net(f.amount)} CKB</dd>
                          </div>
                        ) : (
                          <>
                            <div>
                              <dt>Minimum contribution</dt>
                              <dd>{m.minimum} CKB</dd>
                            </div>
                            <div>
                              <dt>Initial backing</dt>
                              <dd>80%</dd>
                            </div>
                          </>
                        )}
                      </dl>
                      {m.phase === "Funding" ? (
                        <>
                          <button
                            className="primary wide"
                            disabled={locked || !selected?.empty}
                            onClick={() => p.onAction("contribute")}
                          >
                            Review contribution
                          </button>
                          {selected?.mine && !selected.empty && (
                            <button
                              className="wide"
                              disabled={locked}
                              onClick={() => p.onAction("refund")}
                            >
                              Review refund
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            className="primary wide"
                            disabled={
                              locked ||
                              !selected?.mine ||
                              !selected.remaining ||
                              !mature
                            }
                            onClick={() => p.onAction("redeem")}
                          >
                            Review redemption
                          </button>
                          {!mature && (
                            <p className="blocker">
                              Available after block {m.maturity}.
                            </p>
                          )}
                        </>
                      )}
                      {blocker}
                      <details>
                        <summary>Settlement details</summary>
                        <p>
                          Fee deducted from gross redemption. Remaining backing
                          must be zero or greater than 0.01 CKB. A funded
                          receiving Cell and committed history are required.
                        </p>
                        <dl>
                          <div>
                            <dt>Maturity block</dt>
                            <dd>{m.maturity}</dd>
                          </div>
                          <div>
                            <dt>Observed height</dt>
                            <dd>{m.tip ?? "Not checked"}</dd>
                          </div>
                        </dl>
                      </details>
                    </>
                  ) : (
                    <>
                      <label htmlFor="buyer-address">
                        Buyer address
                        <input
                          disabled={p.busy}
                          id="buyer-address"
                          value={f.buyer}
                          onChange={change("buyer")}
                          placeholder="ckt1…"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>
                      <Amount
                        id="sale-price"
                        label="Sale price"
                        value={f.price}
                        onChange={(v) => p.update("price", v)}
                        disabled={p.busy}
                      />
                      <dl className="ticket-summary">
                        <div>
                          <dt>Backing transferred</dt>
                          <dd>{selected?.backing ?? "—"} CKB</dd>
                        </div>
                        <div>
                          <dt>Buyer pays network fee</dt>
                          <dd>0.001 CKB</dd>
                        </div>
                      </dl>
                      {action === "sell" ? (
                        <button
                          className="primary wide"
                          disabled={
                            locked ||
                            !selected?.mine ||
                            !selected.remaining ||
                            !f.buyer
                          }
                          onClick={() => p.onOffer("prepare")}
                        >
                          Prepare offer
                        </button>
                      ) : (
                        <>
                          <label className="file-label" htmlFor="offer-file">
                            <Icon name="file" />
                            Choose offer file
                            <input
                              id="offer-file"
                              type="file"
                              disabled={p.busy}
                              accept="application/json,.json"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2000000) {
                                  setShareError("Offer exceeds 2 MB.");
                                  return;
                                }
                                p.update("envelope", await file.text());
                                setShareError("");
                              }}
                            />
                          </label>
                          <details>
                            <summary>Paste offer instead</summary>
                            <label htmlFor="offer-json" className="sr-only">
                              Assignment proposal
                            </label>
                            <textarea
                              id="offer-json"
                              disabled={p.busy}
                              value={f.envelope}
                              onChange={change("envelope")}
                              rows={5}
                              spellCheck={false}
                            />
                          </details>
                          <button
                            className="wide"
                            disabled={locked || !f.envelope}
                            onClick={() => p.onOffer("sign")}
                          >
                            Review & add signature
                          </button>
                          <button
                            className="primary wide"
                            disabled={locked || !f.envelope}
                            onClick={() => p.onOffer("submit")}
                          >
                            Review & submit
                          </button>
                        </>
                      )}
                      {shareError && (
                        <p role="alert" className="error-text">
                          {shareError}
                        </p>
                      )}
                      {f.envelope && (
                        <div className="offer-ready">
                          <span>Offer file ready</span>
                          <button onClick={download}>Save offer file</button>
                        </div>
                      )}
                      {blocker}
                      <details>
                        <summary>How assignment works</summary>
                        <p>
                          Agree a price with a buyer. Save and share the offer
                          file. Both owners review and sign the same
                          transaction. Return the signed file to submit. No
                          guaranteed buyer.
                        </p>
                        <p>
                          A changed root or spent input requires a new offer and
                          both signatures. Importing or signing a file does not
                          complete a sale.
                        </p>
                      </details>
                    </>
                  )}
                </section>
              </div>
            )}
          </>
        )}
        {tab === "Create Market" && (
          <div className="creation">
            <div className="creation-heading">
              <span className="subtle">New market</span>
              <h1>Create Market</h1>
            </div>
            <div className="creation-grid">
              <section className="creation-form">
                <label htmlFor="slots">
                  Participant slots
                  <input
                    disabled={p.busy}
                    id="slots"
                    type="number"
                    min="1"
                    max="1024"
                    value={f.slots}
                    onChange={change("slots")}
                  />
                </label>
                <p className="hint">0.125 CKB minimum per slot.</p>
                <label htmlFor="maturity">
                  Maturity block
                  <input
                    disabled={p.busy}
                    id="maturity"
                    type="number"
                    min="0"
                    value={f.maturity}
                    onChange={change("maturity")}
                  />
                </label>
                <p className="hint">0 adds no redemption delay.</p>
                <label htmlFor="creator">
                  Creator address <span className="subtle">Optional</span>
                  <input
                    disabled={p.busy}
                    id="creator"
                    value={f.creator}
                    onChange={change("creator")}
                    placeholder="Your connected wallet"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <div
                  className="allocation-bar"
                  role="img"
                  aria-label="80% reserved backing, 20% gross creator proceeds"
                >
                  <span />
                  <span />
                </div>
                <div className="fixed-policy">
                  <div>
                    <span>Initial backing</span>
                    <b>80%</b>
                  </div>
                  <div>
                    <span>Creator proceeds</span>
                    <b>20% gross</b>
                  </div>
                </div>
                <button
                  className="primary wide"
                  disabled={locked}
                  onClick={p.onCreate}
                >
                  Review market creation
                </button>
                {blocker}
              </section>
              <aside className="funding-summary">
                <h2>Required funding</h2>
                <strong>
                  383.001 <span>CKB</span>
                </strong>
                <dl>
                  <div>
                    <dt>Market capacity</dt>
                    <dd>322 CKB</dd>
                  </div>
                  <div>
                    <dt>Wallet capacity retained</dt>
                    <dd>61 CKB</dd>
                  </div>
                  <div>
                    <dt>Network fee</dt>
                    <dd>0.001 CKB</dd>
                  </div>
                </dl>
                <details>
                  <summary>Funding & terms</summary>
                  <p>
                    Capacity is not a spent fee. Market capacity returns only at
                    lawful closure. Code deployment separately requires 17,889
                    CKB of occupied capacity.
                  </p>
                  <p>
                    All slots must be funded before activation. The creator
                    receives 20% gross; 80% stays reserved in CKB. Creator
                    activation requires a funded plain Cell. No USD protection
                    or guaranteed buyer.
                  </p>
                </details>
              </aside>
            </div>
          </div>
        )}
        {tab === "Activity" && (
          <>
            <div className="page-heading">
              <h1>Activity</h1>
              <span className="subtle">This session</span>
            </div>
            <div className="activity-table">
              <div className="activity-table-head">
                <span>Transaction</span>
                <span>Status</span>
              </div>
              {!p.activity.length ? (
                <div className="empty">
                  <Icon name="refresh" />
                  <h2>No activity yet</h2>
                  <p>Transactions from this session appear here.</p>
                </div>
              ) : (
                p.activity.map((a, i) => (
                  <article key={i}>
                    <div>
                      <b>{a.label}</b>
                      <details>
                        <summary>Details</summary>
                        <p>{a.detail}</p>
                      </details>
                      {a.hash && (
                        <a
                          href={
                            "https://pudge.explorer.nervos.org/transaction/" +
                            a.hash
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View transaction on explorer <Icon name="arrow" />{" "}
                          <span className="sr-only">{a.hash}</span>
                        </a>
                      )}
                    </div>
                    <span
                      className={
                        "phase " + (a.state === "Committed" ? "positive" : "")
                      }
                    >
                      {a.state}
                    </span>
                  </article>
                ))
              )}
            </div>
          </>
        )}
        <footer>
          <div>
            <span className="connection-dot" />
            Pudge testnet<span className="footer-divider">·</span>Test CKB only
          </div>
          <details className="advanced">
            <summary>Details & diagnostics</summary>
            <p>
              Contract:{" "}
              {p.deployment === "Not deployed"
                ? "Deployment not approved"
                : p.deployment === "Configured"
                  ? "Deployment configured"
                  : p.deployment === "Checking"
                    ? "Checking configuration…"
                    : "Configuration unavailable"}
              . Signing requires an approved, verified code Cell.
            </p>
            <p>
              Ordinary CKB secp256k1 only. Other locks are unsupported for this
              covenant.
            </p>
            <code>{p.address || "Wallet not checked"}</code>
            {p.connected && (
              <button onClick={p.onCheck} disabled={p.busy}>
                Check wallet compatibility
              </button>
            )}
            {m && (
              <>
                <p>Market / current root</p>
                <code>{m.id}</code>
                <code>{m.root}</code>
                <p>Selected owner</p>
                <code>{selected?.owner ?? "None"}</code>
              </>
            )}
            <p>
              Public history and receiving capacity are required for recovery.
              Session activity clears on refresh. No real liquidity or
              production readiness is claimed.
            </p>
          </details>
        </footer>
      </main>
      {p.review && (
        <ReviewDialog
          review={p.review}
          busy={p.busy}
          onConfirm={p.onConfirm}
          onCancel={p.onCancel}
        />
      )}
    </div>
  );
}
