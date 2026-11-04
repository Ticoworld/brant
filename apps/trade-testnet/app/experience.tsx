"use client";
import { useEffect, useRef, useState } from "react";
import type { PageRoute } from "../lib/market-reader";
export type Tab = PageRoute["view"];
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
  contributed: string;
  goal: string;
  initialBacking: string;
  creatorAllocation: string;
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
  route: PageRoute;
  onNavigate: (view: PageRoute["view"]) => void;
  onOpenMarket: (value: string) => void;
  onSelectPosition: (index: number) => void;
  onClearPosition: () => void;
  markets: MarketView[];
  discovery: {
    state: "idle" | "complete" | "partial" | "unavailable";
    message: string;
    scanned: number;
    next?: string;
  };
  onDiscover: (more?: boolean) => void;
  loadingMarket: boolean;
  readAvailable: boolean;
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
        {review.lines
          .filter((x) => !/^0x[0-9a-fA-F]{64}$/.test(x.value))
          .map((x) => (
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
        <summary>Transaction details & identities</summary>
        {review.lines
          .filter((x) => /^0x[0-9a-fA-F]{64}$/.test(x.value))
          .map((x) => (
            <div key={x.label}>
              <p>{x.label}</p>
              <code>{x.value}</code>
            </div>
          ))}
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
          placeholder="0"
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
function shannons(value: string) {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return null;
  const [a, b = ""] = value.split(".");
  return BigInt(a) * 100000000n + BigInt(b.padEnd(8, "0"));
}
function money(value: bigint) {
  return (
    value / 100000000n +
    "." +
    (value % 100000000n).toString().padStart(8, "0")
  ).replace(/\.?0+$/, "");
}
function ratio(value: string, total: string) {
  const n = shannons(value),
    d = shannons(total);
  return n !== null && d && d > 0n
    ? Math.min(100, Number((n * 10000n) / d) / 100)
    : 0;
}
function MarketSearch({ p }: { p: ExperienceProps }) {
  return (
    <form
      className="market-search"
      onSubmit={(e) => {
        e.preventDefault();
        p.onOpenMarket(p.fields.id);
      }}
    >
      <Icon name="search" />
      <label className="sr-only" htmlFor="market-id">
        Market link or identity
      </label>
      <input
        id="market-id"
        value={p.fields.id}
        onChange={(e) => p.update("id", e.target.value)}
        placeholder="Open market by link or ID"
        disabled={p.busy}
        autoComplete="off"
        spellCheck={false}
      />
      <button aria-label="Open market" disabled={p.busy || !p.fields.id.trim()}>
        <Icon name="arrow" />
      </button>
    </form>
  );
}
function PositionTable({
  p,
  m,
  onlyMine = false,
}: {
  p: ExperienceProps;
  m: MarketView;
  onlyMine?: boolean;
}) {
  const rows = onlyMine
    ? m.positions.filter((r) => r.mine && !r.empty)
    : m.positions;
  return (
    <div className="table-wrap">
      <table className="position-table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Owner</th>
            <th className="number optional-col">Contributed · CKB</th>
            <th className="number">Backing · CKB</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr
                key={r.index}
                className={p.route.claim === r.index ? "selected-row" : ""}
              >
                <td>
                  <b>#{r.index + 1}</b>
                  <small>
                    {r.empty
                      ? "Available"
                      : m.phase === "Funding"
                        ? "Funding"
                        : !r.remaining
                          ? "Settled"
                          : m.maturity === "0" ||
                              (m.tip !== null &&
                                BigInt(m.tip) >= BigInt(m.maturity))
                            ? "Redeemable"
                            : "Before maturity"}
                  </small>
                </td>
                <td>{r.empty ? "—" : r.mine ? "You" : "Another wallet"}</td>
                <td className="number optional-col">
                  {r.empty ? "—" : r.contribution}
                </td>
                <td className="number">{r.backing}</td>
                <td>
                  <button
                    className="row-action"
                    disabled={p.busy}
                    aria-label={"Open position " + (r.index + 1)}
                    onClick={() => p.onSelectPosition(r.index)}
                  >
                    {r.empty && m.phase === "Funding"
                      ? "Contribute"
                      : r.mine && r.remaining
                        ? "Manage"
                        : "View"}
                    <Icon name="arrow" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>
                <p>No positions belonging to this checked wallet.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Offer({
  p,
  m,
  r,
  buy,
}: {
  p: ExperienceProps;
  m: MarketView;
  r: Position;
  buy: boolean;
}) {
  const [error, setError] = useState(""),
    [importing, setImporting] = useState(buy);
  const f = p.fields,
    locked = p.busy || p.deployment !== "Configured";
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
  return (
    <>
      <div className="offer-mode">
        {!buy && (
          <>
            <button
              aria-pressed={!importing}
              onClick={() => setImporting(false)}
            >
              Create offer
            </button>
            <button aria-pressed={importing} onClick={() => setImporting(true)}>
              Import offer
            </button>
          </>
        )}
      </div>
      <label htmlFor="buyer-address">
        {buy ? "Receiving wallet" : "Buyer address"}
        <input
          id="buyer-address"
          value={f.buyer}
          onChange={(e) => p.update("buyer", e.target.value)}
          placeholder="ckt1…"
          disabled={p.busy}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <Amount
        id="sale-price"
        label={buy ? "Agreed purchase price" : "Sale price"}
        value={f.price}
        onChange={(v) => p.update("price", v)}
        disabled={p.busy}
      />
      <dl className="action-accounting">
        <div>
          <dt>Backing transferred</dt>
          <dd>{r.backing} CKB</dd>
        </div>
        <div>
          <dt>Buyer pays network fee</dt>
          <dd>0.001 CKB</dd>
        </div>
      </dl>
      {!importing && !buy ? (
        <button
          className="primary wide"
          disabled={locked || !f.buyer}
          onClick={() => p.onOffer("prepare")}
        >
          Prepare offer
        </button>
      ) : (
        <>
          <label className="file-label" htmlFor="offer-file">
            <Icon name="file" />
            Import offer file
            <input
              id="offer-file"
              type="file"
              accept="application/json,.json"
              disabled={p.busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2000000) {
                  setError("Offer exceeds 2 MB.");
                  return;
                }
                p.update("envelope", await file.text());
                setError("");
              }}
            />
          </label>
          <details>
            <summary>Paste offer JSON</summary>
            <label className="sr-only" htmlFor="offer-json">
              Assignment proposal
            </label>
            <textarea
              id="offer-json"
              value={f.envelope}
              onChange={(e) => p.update("envelope", e.target.value)}
              rows={5}
              disabled={p.busy}
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
      {error && <p role="alert">{error}</p>}
      {f.envelope && (
        <div className="offer-ready">
          <span>Offer file ready</span>
          <button onClick={download}>Save offer file</button>
        </div>
      )}
      <p className="material-note">
        A sale requires a consenting buyer and both signatures. Signed files are
        not settlement. Changed inputs require fresh review.
      </p>
    </>
  );
}
function PositionAction({
  p,
  m,
  r,
}: {
  p: ExperienceProps;
  m: MarketView;
  r: Position;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  const [mode, setMode] = useState<"redeem" | "sell">(
    r.mine ? "redeem" : "sell",
  );
  const f = p.fields,
    locked = p.busy || p.deployment !== "Configured";
  const mature =
    m.maturity === "0" ||
    (m.tip !== null && BigInt(m.tip) >= BigInt(m.maturity));
  const active = m.phase === "Active";
  const value = shannons(f.amount),
    remaining = shannons(r.backing) ?? 0n;
  const valid =
    value !== null &&
    value > 100000n &&
    value <= remaining &&
    (remaining - value === 0n || remaining - value > 1000000n);
  return (
    <section
      ref={panel}
      className="position-action"
      id="position-actions"
      tabIndex={-1}
      aria-label="Selected position"
    >
      <div className="position-action-head">
        <div>
          <span className="subtle">Position</span>
          <h2>#{r.index + 1}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close position"
          onClick={() => {
            p.onClearPosition();
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-label="Open position ' + (r.index + 1) + '"]',
                )
                ?.focus(),
            );
          }}
          disabled={p.busy}
        >
          <Icon name="close" />
        </button>
      </div>
      <dl className="ownership-lines">
        <div>
          <dt>Owner</dt>
          <dd>
            {r.empty
              ? "Unfunded"
              : r.mine
                ? "Your checked wallet"
                : "Another wallet"}
          </dd>
        </div>
        <div>
          <dt>{active ? "Remaining backing" : "Contribution"}</dt>
          <dd>{active ? r.backing : r.contribution} CKB</dd>
        </div>
      </dl>
      {!p.address ? (
        <div className="connect-position">
          <p>
            {r.empty
              ? "Connect a supported wallet to contribute."
              : "Connect a supported wallet to manage or acquire this position."}
          </p>
          <button
            className="primary wide"
            disabled={p.busy}
            onClick={p.connected ? p.onCheck : p.onConnect}
          >
            {p.connected ? "Check wallet compatibility" : "Connect wallet"}
          </button>
        </div>
      ) : !active ? (
        r.empty ? (
          <>
            <Amount
              id="claim-amount"
              label="Contribution"
              value={f.amount}
              onChange={(v) => p.update("amount", v)}
              disabled={p.busy}
            />
            <dl className="action-accounting">
              <div>
                <dt>Reserved backing · 80%</dt>
                <dd>{value !== null ? money((value * 4n) / 5n) : "—"} CKB</dd>
              </div>
              <div>
                <dt>Creator gross · 20%</dt>
                <dd>
                  {value !== null ? money(value - (value * 4n) / 5n) : "—"} CKB
                </dd>
              </div>
              <div>
                <dt>Network fee · additional</dt>
                <dd>0.001 CKB</dd>
              </div>
              <div>
                <dt>Minimum contribution</dt>
                <dd>{m.minimum} CKB</dd>
              </div>
            </dl>
            <button
              className="primary wide"
              disabled={
                locked || value === null || value < (shannons(m.minimum) ?? 0n)
              }
              onClick={() => p.onAction("contribute")}
            >
              Review contribution
            </button>
            <p className="material-note">
              20% is allocated to the creator at activation. You may refund
              before activation.
            </p>
          </>
        ) : r.mine ? (
          <>
            <p className="material-note">
              Funding is still open. You can refund this full contribution
              before activation.
            </p>
            <dl className="action-accounting">
              <div>
                <dt>Gross refund</dt>
                <dd>{r.contribution} CKB</dd>
              </div>
              <div>
                <dt>Network fee · deducted</dt>
                <dd>0.001 CKB</dd>
              </div>
              <div className="total">
                <dt>You receive</dt>
                <dd>{net(r.contribution)} CKB</dd>
              </div>
            </dl>
            <button
              className="primary wide"
              disabled={locked}
              onClick={() => p.onAction("refund")}
            >
              Review refund
            </button>
          </>
        ) : (
          <p className="material-note">
            Only this position's current owner can refund it. Secondary
            assignment is available only after activation.
          </p>
        )
      ) : !r.remaining ? (
        <p className="material-note">
          This position is fully settled. No backing remains to redeem or
          transfer.
        </p>
      ) : (
        <>
          {r.mine && (
            <div className="action-tabs">
              <button
                aria-pressed={mode === "redeem"}
                onClick={() => setMode("redeem")}
              >
                Redeem
              </button>
              <button
                aria-pressed={mode === "sell"}
                onClick={() => setMode("sell")}
              >
                Sell
              </button>
            </div>
          )}
          {r.mine && mode === "redeem" ? (
            <>
              <Amount
                id="claim-amount"
                label="Gross redemption"
                value={f.amount}
                onChange={(v) => p.update("amount", v)}
                disabled={p.busy}
              />
              <dl className="action-accounting">
                <div>
                  <dt>Network fee · deducted</dt>
                  <dd>0.001 CKB</dd>
                </div>
                <div className="total">
                  <dt>You receive</dt>
                  <dd>{net(f.amount)} CKB</dd>
                </div>
              </dl>
              {mature ? (
                <button
                  className="primary wide"
                  disabled={locked || !valid}
                  onClick={() => p.onAction("redeem")}
                >
                  Review redemption
                </button>
              ) : (
                <p className="maturity-notice">
                  Redemption opens at block {m.maturity}.{" "}
                  {m.tip === null
                    ? "Current height could not be checked."
                    : "Current height: " + m.tip + "."}{" "}
                  Sale remains possible.
                </p>
              )}
              <p className="material-note">
                Fee comes from the gross amount. Any remaining backing must be
                zero or greater than 0.01 CKB.
              </p>
            </>
          ) : (
            <>
              <h3>{r.mine ? "Sell this position" : "Acquire with an offer"}</h3>
              <Offer
                key={r.mine ? "seller" : "buyer"}
                p={p}
                m={m}
                r={r}
                buy={!r.mine}
              />
            </>
          )}
        </>
      )}
      {p.address && p.deployment !== "Configured" && (
        <p className="blocker">
          Public signing is disabled pending deployment approval.
        </p>
      )}
      <p className="receiving-note">
        Settlement needs a plain wallet Cell retaining at least 61 CKB. Recovery
        requires public transaction history.
      </p>
      <details>
        <summary>Position identity</summary>
        <p>On-chain slot: {r.index}</p>
        <p>Market</p>
        <code>{m.id}</code>
        <p>Owner lock</p>
        <code>{r.owner}</code>
        <p>Current commitment</p>
        <code>{m.root}</code>
      </details>
    </section>
  );
}
export default function Experience(p: ExperienceProps) {
  const f = p.fields,
    m = p.market;
  const selected =
    m && p.route.claim !== undefined
      ? m.positions.find((r) => r.index === p.route.claim)
      : undefined;
  const initial = /^Connect a supported|^Controlled local view/.test(p.status);
  const update =
    (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      p.update(key, e.target.value);
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="Trade home"
          onClick={(e) => {
            e.preventDefault();
            p.onNavigate("Markets");
          }}
        >
          <CellMark />
          trade<span className="network">CKB TESTNET</span>
        </a>
        <nav className="navigation" aria-label="Main navigation">
          {(
            ["Markets", "My Positions", "Activity", "Create Market"] as const
          ).map((v) => (
            <button
              key={v}
              disabled={p.busy}
              aria-current={
                p.route.view === v ||
                (v === "Markets" && p.route.view === "Market")
                  ? "page"
                  : undefined
              }
              onClick={() => p.onNavigate(v)}
            >
              {v === "My Positions" ? (
                "Positions"
              ) : v === "Create Market" ? (
                <>
                  <Icon name="plus" />
                  Create market
                </>
              ) : (
                v
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
            <button disabled={p.busy} onClick={p.onCheck}>
              Check wallet compatibility
            </button>
          </div>
        )}
        <div
          role={p.error ? "alert" : "status"}
          className={
            "status-bar " +
            (p.error ? "status-error" : "") +
            (initial && !p.busy && !p.error ? " sr-only" : "")
          }
        >
          {p.busy && <span className="spinner" aria-hidden="true" />}
          <p>{p.status}</p>
        </div>
        {p.route.view === "Markets" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Markets</h1>
                <span className="subtle">Verified CKB-backed claims</span>
              </div>
              <MarketSearch p={p} />
            </div>
            <div className="directory-tools">
              <span>{p.markets.length} verified in this session</span>
              <button
                disabled={p.busy || !p.readAvailable}
                onClick={() => p.onDiscover(false)}
              >
                <Icon name="refresh" />
                Find markets
              </button>
            </div>
            {!p.readAvailable && (
              <p className="material-note">
                The public contract is not configured. Discovery and signing
                remain unavailable until deployment is verified.
              </p>
            )}
            <div className="table-wrap">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Phase</th>
                    <th className="number">Backing · CKB</th>
                    <th className="number optional-col">Funded slots</th>
                    <th className="optional-col">Maturity</th>
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.markets.length ? (
                    p.markets.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <a
                            className="market-name"
                            href={"/market/" + x.id}
                            onClick={(e) => {
                              e.preventDefault();
                              p.onOpenMarket(x.id);
                            }}
                          >
                            <span className="market-token" aria-hidden="true">
                              <img
                                src="/assets/ckb.svg"
                                alt=""
                                width="14"
                                height="14"
                              />
                            </span>
                            <span>
                              <b>CKB-backed claims</b>
                              <small>{x.positions.length} positions</small>
                            </span>
                          </a>
                        </td>
                        <td>
                          <span className="phase">{x.phase}</span>
                        </td>
                        <td className="number">{x.backing}</td>
                        <td className="number optional-col">
                          {x.positions.filter((r) => !r.empty).length} /{" "}
                          {x.positions.length}
                        </td>
                        <td className="optional-col">
                          {x.maturity === "0"
                            ? "No added delay"
                            : "Block " + x.maturity}
                        </td>
                        <td>
                          <button
                            className="row-action"
                            disabled={p.busy}
                            aria-label={"Open market " + x.id}
                            onClick={() => p.onOpenMarket(x.id)}
                          >
                            <Icon name="arrow" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty">
                          <Icon name="search" />
                          <h2>No verified markets yet</h2>
                          <p>
                            Open a market link, or search the configured
                            deployment.
                          </p>
                          <button
                            onClick={() =>
                              document.getElementById("market-id")?.focus()
                            }
                          >
                            Open a market link
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="discovery-result" role="status">
              {p.discovery.message}
              {p.discovery.next && (
                <button disabled={p.busy} onClick={() => p.onDiscover(true)}>
                  Load next page
                </button>
              )}
            </div>
            <p className="directory-scope">
              Discovery checks 20 live Cells per page from this contract. Every
              listed market is independently reconstructed; an indexer result
              alone is not accepted.
            </p>
          </>
        )}
        {p.route.view === "Market" && (
          <>
            {p.loadingMarket ? (
              <section className="workspace-loading" role="status">
                <span className="spinner" />
                <h1>Opening market</h1>
                <p>Checking its live state and committed history.</p>
              </section>
            ) : !m ? (
              <section className="workspace-error">
                <h1>Market unavailable</h1>
                <p>
                  No verified state is loaded. No position actions are enabled.
                </p>
                <div className="actions">
                  <button onClick={() => p.onNavigate("Markets")}>
                    Back to Markets
                  </button>
                  <button
                    className="primary"
                    disabled={p.busy}
                    onClick={p.onRecover}
                  >
                    Retry recovery
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="market-heading">
                  <div>
                    <button
                      className="breadcrumb"
                      disabled={p.busy}
                      onClick={() => p.onNavigate("Markets")}
                    >
                      Markets /
                    </button>
                    <h1>CKB-backed claims</h1>
                    <p>
                      Transferable CKB claims, not launched tokens. Resale
                      requires a buyer.
                    </p>
                  </div>
                  <div className="market-heading-actions">
                    <span className="phase">{m.phase}</span>
                    <button
                      className="text-button"
                      disabled={p.busy}
                      onClick={p.onRecover}
                    >
                      <Icon name="refresh" />
                      Refresh
                    </button>
                  </div>
                </div>
                <section
                  className="market-ledger"
                  aria-label="Market financial state"
                >
                  <dl>
                    <div>
                      <dt>Contributed</dt>
                      <dd>
                        {m.contributed}
                        <small>CKB</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Backing remaining</dt>
                      <dd>
                        {m.backing}
                        <small>CKB</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Creator gross allocation</dt>
                      <dd>
                        {m.creatorAllocation}
                        <small>CKB</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Redemption maturity</dt>
                      <dd>
                        {m.maturity === "0"
                          ? "No added delay"
                          : "Block " + m.maturity}
                      </dd>
                    </div>
                  </dl>
                  <div className="financial-proportion">
                    <div>
                      <span>
                        {m.phase === "Funding"
                          ? "Funding target"
                          : "Backing remaining / initial"}
                      </span>
                      <b>
                        {m.phase === "Funding"
                          ? m.contributed + " / " + m.goal
                          : m.backing + " / " + m.initialBacking}{" "}
                        CKB
                      </b>
                    </div>
                    <div
                      className="proportion-track"
                      role="progressbar"
                      aria-label={
                        m.phase === "Funding"
                          ? "Funding progress"
                          : "Backing remaining"
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={ratio(
                        m.phase === "Funding" ? m.contributed : m.backing,
                        m.phase === "Funding" ? m.goal : m.initialBacking,
                      )}
                    >
                      <span
                        style={{
                          width:
                            ratio(
                              m.phase === "Funding" ? m.contributed : m.backing,
                              m.phase === "Funding" ? m.goal : m.initialBacking,
                            ) + "%",
                        }}
                      />
                    </div>
                    <small>
                      {m.phase === "Funding"
                        ? "80% initial backing; 20% gross creator proceeds at activation. Owner refunds remain possible until then."
                        : "Initial backing: 80% of contributions. The creator’s 20% was released at activation. CKB backing, not a USD guarantee."}
                    </small>
                  </div>
                </section>
                <div
                  className={
                    "market-workspace " + (selected ? "with-selection" : "")
                  }
                >
                  <section
                    className="positions-section"
                    aria-label="Authenticated market positions"
                  >
                    <div className="section-line">
                      <h2>Positions</h2>
                      <span>
                        {m.positions.filter((r) => !r.empty).length} /{" "}
                        {m.positions.length} funded
                      </span>
                    </div>
                    <PositionTable p={p} m={m} />
                    {p.route.claim !== undefined && !selected && (
                      <p role="alert">
                        This position does not exist in the current market.{" "}
                        <button onClick={p.onClearPosition}>
                          Clear selection
                        </button>
                      </p>
                    )}
                    <div className="market-permissions">
                      {p.address &&
                        m.creatorIsMe &&
                        m.phase === "Funding" &&
                        (m.allFunded ? (
                          <button
                            className="primary"
                            disabled={p.busy || p.deployment !== "Configured"}
                            onClick={() => p.onAction("activate")}
                          >
                            Review activation
                          </button>
                        ) : (
                          <p>
                            As creator, you can activate once every slot and the
                            funding goal are met.
                          </p>
                        ))}
                      {p.address && m.funderIsMe && m.settled && (
                        <button
                          disabled={p.busy || p.deployment !== "Configured"}
                          onClick={() => p.onAction("close")}
                        >
                          Review closure
                        </button>
                      )}
                    </div>
                    <details className="market-terms">
                      <summary>Terms & receiving requirements</summary>
                      <dl>
                        <div>
                          <dt>Fixed initial backing</dt>
                          <dd>80% of contributions</dd>
                        </div>
                        <div>
                          <dt>Creator proceeds</dt>
                          <dd>20% gross at activation</dd>
                        </div>
                        <div>
                          <dt>Shared capacity</dt>
                          <dd>
                            {m.capacity} CKB, returned only at lawful closure
                          </dd>
                        </div>
                        <div>
                          <dt>Wallet receiving capacity</dt>
                          <dd>A plain secp Cell must retain 61 CKB</dd>
                        </div>
                        <div>
                          <dt>Action fee</dt>
                          <dd>0.001 CKB; exact source shown in review</dd>
                        </div>
                      </dl>
                      <p>
                        No guaranteed buyer, USD floor or immediate settlement.
                        Redemption needs actual maturity; recovery needs
                        committed history and the current live Cell.
                      </p>
                    </details>
                    <details>
                      <summary>Advanced market identity</summary>
                      <p>Market identifier</p>
                      <code>{m.id}</code>
                      <p>Current root</p>
                      <code>{m.root}</code>
                      <a href={"/market/" + m.id}>Market permalink</a>
                      <p>
                        {p.fixture
                          ? "Controlled presentation state."
                          : "Reconstructed from committed history and a live Cell."}
                      </p>
                    </details>
                  </section>
                  {selected && (
                    <PositionAction
                      key={m.id + ":" + selected.index + ":" + p.address}
                      p={p}
                      m={m}
                      r={selected}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
        {p.route.view === "My Positions" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Positions</h1>
                <span className="subtle">
                  In markets verified during this session
                </span>
              </div>
            </div>
            {!p.address ? (
              <div className="empty">
                <Icon name="wallet" />
                <h2>Connect and check your wallet</h2>
                <p>
                  Ownership is matched against the authenticated owner lock.
                </p>
                <button onClick={p.connected ? p.onCheck : p.onConnect}>
                  {p.connected
                    ? "Check wallet compatibility"
                    : "Connect wallet"}
                </button>
              </div>
            ) : !p.markets.some((x) =>
                x.positions.some((r) => r.mine && !r.empty),
              ) ? (
              <div className="empty">
                <h2>No positions in opened markets</h2>
                <button onClick={() => p.onNavigate("Markets")}>
                  Open a market
                </button>
              </div>
            ) : (
              p.markets
                .filter((x) => x.positions.some((r) => r.mine && !r.empty))
                .map((x) => (
                  <section className="owned-market" key={x.id}>
                    <div className="section-line">
                      <h2>CKB-backed claims</h2>
                      <button onClick={() => p.onOpenMarket(x.id)}>
                        Open market
                      </button>
                    </div>
                    <div className="owned-positions">
                      {x.positions
                        .filter((r) => r.mine && !r.empty)
                        .map((r) => (
                          <button
                            key={r.index}
                            onClick={() =>
                              p.onOpenMarket(
                                "/market/" + x.id + "?claim=" + r.index,
                              )
                            }
                          >
                            Position #{r.index + 1}
                            <span>{r.backing} CKB backing</span>
                            <Icon name="arrow" />
                          </button>
                        ))}
                    </div>
                  </section>
                ))
            )}
          </>
        )}
        {p.route.view === "Create Market" && (
          <div className="creation">
            <div className="creation-heading">
              <h1>Create Market</h1>
            </div>
            <div className="creation-grid">
              <section className="creation-form">
                <label htmlFor="slots">
                  Participant slots
                  <input
                    id="slots"
                    type="number"
                    min="1"
                    max="1024"
                    value={f.slots}
                    onChange={update("slots")}
                    disabled={p.busy}
                  />
                </label>
                <p className="hint">
                  0.125 CKB minimum per slot; all slots must fund before
                  activation.
                </p>
                <label htmlFor="maturity">
                  Maturity block
                  <input
                    id="maturity"
                    type="number"
                    min="0"
                    value={f.maturity}
                    onChange={update("maturity")}
                    disabled={p.busy}
                  />
                </label>
                <p className="hint">
                  0 adds no block delay. The condition is fixed at creation.
                </p>
                <label htmlFor="creator">
                  Creator address <span className="subtle">Optional</span>
                  <input
                    id="creator"
                    value={f.creator}
                    onChange={update("creator")}
                    placeholder="Use my checked wallet"
                    disabled={p.busy}
                  />
                </label>
                <div className="fixed-policy">
                  <div>
                    <span>Initial backing</span>
                    <b>80%</b>
                  </div>
                  <div>
                    <span>Creator gross proceeds</span>
                    <b>20%</b>
                  </div>
                </div>
                <button
                  className="primary wide"
                  disabled={
                    p.busy || !p.address || p.deployment !== "Configured"
                  }
                  onClick={p.onCreate}
                >
                  Review market creation
                </button>
                <p className="blocker">
                  {!p.address
                    ? "Connect and verify a supported wallet."
                    : p.deployment !== "Configured"
                      ? "Deployment approval is required before signing."
                      : ""}
                </p>
              </section>
              <aside className="funding-summary">
                <h2>Required suitable input</h2>
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
                <p>
                  Code deployment is separate: 17,889 CKB occupied capacity.
                  Market capacity returns only after all obligations are
                  settled.
                </p>
                <p>
                  Contributions fund the backing and creator allocation
                  separately. CKB backing is not USD protection; no resale
                  liquidity is guaranteed.
                </p>
              </aside>
            </div>
          </div>
        )}
        {p.route.view === "Activity" && (
          <>
            <div className="page-heading">
              <h1>Activity</h1>
              <span className="subtle">This session · clears on refresh</span>
            </div>
            <div className="activity-table">
              <div className="activity-table-head">
                <span>Transaction</span>
                <span>Status</span>
              </div>
              {p.activity.length ? (
                p.activity.map((a, i) => (
                  <article key={i}>
                    <div>
                      <b>{a.label}</b>
                      <p>{a.detail}</p>
                      {a.hash && (
                        <a
                          href={
                            "https://pudge.explorer.nervos.org/transaction/" +
                            a.hash
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View transaction on explorer <Icon name="arrow" />
                          <span className="sr-only">{a.hash}</span>
                        </a>
                      )}
                    </div>
                    <span className="phase">{a.state}</span>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <Icon name="refresh" />
                  <h2>No activity yet</h2>
                </div>
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
              . Signing requires an approved and verified code Cell.
            </p>
            <p>
              Ordinary CKB secp256k1 only. OmniLock, JoyID and alternative
              authority modes are not qualified for this covenant.
            </p>
            <code>{p.address || "Wallet not checked"}</code>
            {p.connected && (
              <button onClick={p.onCheck} disabled={p.busy}>
                Check wallet compatibility
              </button>
            )}
            <p>
              Public history and receiving capacity are required for recovery.
              No production readiness or actual liquidity is claimed.
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
