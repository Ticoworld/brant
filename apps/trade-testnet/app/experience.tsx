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
function NavIcon({ index }: { index: number }) {
  const paths = [
    "M3 4h18v16H3z M9 4v16 M15 4v16",
    "M4 4h16v16H4z M7 8h10 M7 12h10 M7 16h6",
    "M12 4v16 M4 12h16",
    "M4 18l14-14 M8 4h10v10",
  ];
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={paths[index]} />
    </svg>
  );
}
const short = (s: string) =>
  s.length > 24 ? s.slice(0, 10) + "…" + s.slice(-8) : s;
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      {children}
    </div>
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
    const d = ref.current;
    const before = document.activeElement as HTMLElement;
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
      <div className="dialog-head">
        <span className="eyebrow">TRANSACTION REVIEW</span>
        <button
          className="icon-button"
          aria-label="Close transaction review"
          onClick={onCancel}
          disabled={busy}
        >
          ×
        </button>
      </div>
      <h2 id="review-title">{review.title}</h2>
      <p>
        Check these terms before your wallet opens. A wallet signature
        authorizes this exact transaction.
      </p>
      <dl className="review-lines">
        {review.lines.map((x) => (
          <div key={x.label}>
            <dt>{x.label}</dt>
            <dd>{x.value}</dd>
          </div>
        ))}
        <div>
          <dt>Transaction fee</dt>
          <dd>{review.fee} CKB</dd>
        </div>
      </dl>
      <details>
        <summary>Exact outputs & transaction identity</summary>
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
      <p className="note">
        If inputs were spent or the market changed, this review is discarded.
        Rebuild and give fresh consent. Submission still requires chain
        commitment.
      </p>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Checking…" : review.button}
        </button>
        <button disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
export default function Experience(p: ExperienceProps) {
  const [tab, setTab] = useState<Tab>("Markets"),
    [offerStep, setOfferStep] = useState<"create" | "import">("create"),
    [shareError, setShareError] = useState("");
  const f = p.fields,
    m = p.market,
    locked = p.busy || !p.address || p.deployment !== "Configured";
  const change =
    (key: keyof Fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      p.update(key, e.target.value);
  const pos = m?.positions.filter((x) => x.mine && !x.empty) ?? [];
  const selected = m?.positions.find((x) => x.index === Number(f.index));
  const mature =
    !!m &&
    (m.maturity === "0" ||
      (m.tip !== null && BigInt(m.tip) >= BigInt(m.maturity)));
  const noActions = (
    <p className="note">
      {!p.address
        ? "Connect and check a supported wallet to continue."
        : p.deployment !== "Configured"
          ? "Contract deployment approval is still required. No signing is enabled."
          : null}
    </p>
  );
  function download() {
    const blob = new Blob([f.envelope], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trade-assignment.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Trade home">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          Trade<span className="pilot-label">TESTNET PILOT</span>
        </a>
        <div className="wallet-area">
          <span className="network">
            <i />
            Pudge
          </span>
          <button
            className={p.address ? "wallet-connected" : "primary"}
            onClick={p.onConnect}
            disabled={p.busy}
          >
            {p.address
              ? short(p.address)
              : p.connected
                ? "Choose wallet"
                : "Connect testnet wallet"}
          </button>
        </div>
      </header>
      <div className="workspace">
        <nav aria-label="Main navigation" className="navigation">
          {(
            ["Markets", "My Positions", "Create Market", "Activity"] as Tab[]
          ).map((t, i) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              <NavIcon index={i} />
              {t}
            </button>
          ))}
          <div className="nav-foot">
            <span className="eyebrow">CURRENT EXPERIENCE</span>
            <p>CKB-backed claims</p>
            <small>Not an xUDT token exchange.</small>
          </div>
        </nav>
        <main id="workspace" tabIndex={-1} aria-busy={p.busy}>
          {p.fixture && (
            <div className="fixture-banner">
              CONTROLLED LOCAL UI FIXTURE · no wallet, liquidity or Pudge
              execution
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">TRADE / {tab.toUpperCase()}</span>
              <h1>{tab}</h1>
              <p>
                {tab === "Markets"
                  ? "Open a market. Inspect its backing. Keep control of your claim."
                  : tab === "My Positions"
                    ? "Your authenticated ownership and available settlement actions."
                    : tab === "Create Market"
                      ? "Set clear terms for a bounded CKB-backed claim market."
                      : "Follow wallet requests and chain confirmation."}
              </p>
            </div>
            <span className="badge">
              {p.deployment === "Not deployed"
                ? "Deployment not approved"
                : p.deployment === "Configured"
                  ? "Deployment configured"
                  : p.deployment === "Checking"
                    ? "Checking configuration…"
                    : "Configuration unavailable"}
            </span>
          </div>
          {p.connected && !p.address && (
            <div className="notice">
              <div>
                <b>Check this wallet before continuing</b>
                <p>
                  Only ordinary CKB secp256k1 accounts are supported in this
                  pilot. Other connected wallet types are rejected.
                </p>
              </div>
              <button onClick={p.onCheck} disabled={p.busy}>
                Check wallet compatibility
              </button>
            </div>
          )}
          <div
            className={"status-bar " + (p.error ? "status-error" : "")}
            role={p.error ? "alert" : "status"}
          >
            <span aria-hidden="true">{p.busy ? "◌" : p.error ? "!" : "•"}</span>
            <p>{p.status}</p>
          </div>
          {tab === "Markets" && (
            <>
              <div className="intro-card">
                <div>
                  <span className="eyebrow">BOUNDED FINANCIAL CLAIMS</span>
                  <h2>A claim with defined CKB backing.</h2>
                  <p>
                    At activation, 80% of each contribution stays reserved for
                    claim holders. The creator receives 20% gross. Ownership can
                    be sold to a consenting buyer.
                  </p>
                  <button onClick={() => setTab("Create Market")}>
                    View creation terms
                  </button>
                </div>
                <div className="policy">
                  <strong>
                    80<span>%</span>
                  </strong>
                  <span>fixed initial CKB backing</span>
                  <small>No USD protection or guaranteed buyer.</small>
                </div>
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Open a market</h2>
                    <p>
                      Use a shared market link or its identity. Automatic
                      discovery is not available.
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.onRecover();
                  }}
                  className="inline-form"
                >
                  <label htmlFor="market-id">
                    Market link or identity
                    <input
                      disabled={p.busy}
                      id="market-id"
                      value={f.id}
                      onChange={change("id")}
                      placeholder="Paste a market link or 0x identity"
                      spellCheck={false}
                    />
                  </label>
                  <button className="primary" disabled={p.busy || !f.id.trim()}>
                    Open market
                  </button>
                </form>
                {!m ? (
                  <Empty title="No market opened">
                    <p>
                      No live markets or liquidity are implied by this screen.
                      <br />
                      Open a known market to verify its current state.
                    </p>
                  </Empty>
                ) : (
                  <>
                    <div className="market-summary">
                      <div>
                        <span className="badge positive">{m.phase}</span>
                        <h3>Backed claim market</h3>
                        <p>
                          {m.positions.filter((x) => !x.empty).length} of{" "}
                          {m.positions.length} slots enrolled
                        </p>
                      </div>
                      <dl>
                        <div>
                          <dt>Remaining backing</dt>
                          <dd>{m.backing} CKB</dd>
                        </div>
                        <div>
                          <dt>Shared capacity</dt>
                          <dd>{m.capacity} CKB</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() => setTab("My Positions")}
                      >
                        View positions
                      </button>
                      <button onClick={p.onRecover} disabled={p.busy}>
                        Refresh from chain
                      </button>
                    </div>
                    <details>
                      <summary>Market identity & proof</summary>
                      <p>Market</p>
                      <code>{m.id}</code>
                      <p>Current root</p>
                      <code>{m.root}</code>
                    </details>
                  </>
                )}
              </section>
              <div className="context-row">
                <p>
                  <b>Before you participate</b> CKB backing is not dollar-price
                  protection. Receiving capacity and public transaction history
                  are required for recovery.
                </p>
                <p>
                  <b>Testnet only</b> This bounded demonstration is not a
                  complete asset launch or liquid trading venue.
                </p>
              </div>
            </>
          )}
          {tab === "My Positions" && (
            <>
              {!m ? (
                <section className="panel">
                  <Empty title="Open a market first">
                    <p>
                      Your positions are verified from the selected market's
                      public history, not a global portfolio index.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setTab("Markets")}
                    >
                      Find a market
                    </button>
                  </Empty>
                </section>
              ) : (
                <>
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>
                          {p.address ? "Your claims" : "Market positions"}
                        </h2>
                        <p>
                          {!p.address
                            ? "Check your connected wallet to identify claims you own."
                            : pos.length
                              ? `${pos.length} claim ${pos.length === 1 ? "record belongs" : "records belong"} to this checked wallet.`
                              : "No claims belong to this checked wallet in this market."}
                        </p>
                      </div>
                      <button onClick={p.onRecover} disabled={p.busy}>
                        Refresh
                      </button>
                    </div>
                    <div className="position-list">
                      {m.positions.map((r) => (
                        <article
                          className={"position " + (r.mine ? "owned" : "")}
                          key={r.index}
                        >
                          <div>
                            <span className="eyebrow">CLAIM {r.index}</span>
                            <h3>
                              {r.empty
                                ? "Available slot"
                                : r.mine
                                  ? "Owned by you"
                                  : "Another owner"}
                            </h3>
                            <details className="owner-detail">
                              <summary>Owner identity</summary>
                              <code>{r.owner}</code>
                            </details>
                            <span className="muted">
                              {r.empty
                                ? "Not funded"
                                : `Contributed ${r.contribution} CKB`}
                            </span>
                          </div>
                          <div>
                            <span className="muted">Remaining backing</span>
                            <strong>
                              {r.backing} <small>CKB</small>
                            </strong>
                            <span className="muted">
                              {r.empty
                                ? "Open for contribution"
                                : !r.remaining && m.phase === "Active"
                                  ? "Fully redeemed"
                                  : m.phase === "Funding"
                                    ? "Refund available before activation"
                                    : mature
                                      ? "Maturity condition reached"
                                      : "Waiting for maturity"}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              p.update("index", String(r.index));
                              p.update(
                                "amount",
                                m.phase === "Active" ? r.backing : m.minimum,
                              );
                            }}
                            aria-pressed={Number(f.index) === r.index}
                          >
                            {Number(f.index) === r.index
                              ? "Selected"
                              : "Select"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Manage claim {f.index}</h2>
                        <p>
                          {m.phase === "Funding"
                            ? "Contribute to an empty slot, or refund a claim you own."
                            : "Redeem your backing, or arrange a paid ownership transfer."}
                        </p>
                      </div>
                      <span className="badge">{m.phase}</span>
                    </div>
                    <div className="two-col">
                      <div>
                        <label htmlFor="claim-index">
                          Claim index
                          <input
                            disabled={p.busy}
                            id="claim-index"
                            type="number"
                            min="0"
                            max={m.positions.length - 1}
                            value={f.index}
                            onChange={change("index")}
                          />
                        </label>
                        <label htmlFor="claim-amount">
                          {m.phase === "Funding"
                            ? "Contribution"
                            : "Gross redemption"}{" "}
                          · CKB
                          <input
                            disabled={p.busy}
                            id="claim-amount"
                            inputMode="decimal"
                            value={f.amount}
                            onChange={change("amount")}
                          />
                        </label>
                        <p className="field-hint">
                          {m.phase === "Funding"
                            ? `Minimum ${m.minimum} CKB. Backing is 80%; creator proceeds are 20% gross at activation.`
                            : "The 0.001 CKB transaction fee is deducted from your gross redemption. Remaining backing must be zero or exceed 0.01 CKB."}
                        </p>
                        <div className="actions">
                          {m.phase === "Funding" ? (
                            <>
                              <button
                                className="primary"
                                disabled={locked || !selected?.empty}
                                onClick={() => p.onAction("contribute")}
                              >
                                Review contribution
                              </button>
                              <button
                                disabled={
                                  locked || !selected?.mine || selected.empty
                                }
                                onClick={() => p.onAction("refund")}
                              >
                                Review refund
                              </button>
                            </>
                          ) : (
                            <button
                              className="primary"
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
                          )}
                        </div>
                        {noActions}
                      </div>
                      <div className="terms">
                        <h3>Settlement conditions</h3>
                        <dl>
                          <div>
                            <dt>Redemption maturity</dt>
                            <dd>
                              {m.maturity === "0"
                                ? "No additional block delay"
                                : `Block ${m.maturity}`}
                            </dd>
                          </div>
                          <div>
                            <dt>Observed chain height</dt>
                            <dd>{m.tip ?? "Not checked"}</dd>
                          </div>
                          <div>
                            <dt>Receiving wallet</dt>
                            <dd>Plain secp Cell, at least 61 CKB retained</dd>
                          </div>
                          <div>
                            <dt>Recovery</dt>
                            <dd>Committed history + latest live market</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </section>
                  {m.phase === "Active" && (
                    <section className="panel">
                      <div className="section-head">
                        <div>
                          <h2>Sell or assign your claim</h2>
                          <p>
                            Agree a price with a real buyer. Both owners
                            authorize the same transaction; no buyer or
                            liquidity is guaranteed.
                          </p>
                        </div>
                      </div>
                      <div className="segmented">
                        <button
                          aria-pressed={offerStep === "create"}
                          onClick={() => setOfferStep("create")}
                        >
                          1. Create offer
                        </button>
                        <button
                          aria-pressed={offerStep === "import"}
                          onClick={() => setOfferStep("import")}
                        >
                          2. Import & sign
                        </button>
                      </div>
                      <div className="two-col">
                        <div>
                          <label htmlFor="buyer-address">
                            Buyer's CKB testnet address
                            <input
                              disabled={p.busy}
                              id="buyer-address"
                              value={f.buyer}
                              onChange={change("buyer")}
                              placeholder="ckt1…"
                              spellCheck={false}
                            />
                          </label>
                          <label htmlFor="sale-price">
                            Buyer pays seller · CKB
                            <input
                              disabled={p.busy}
                              id="sale-price"
                              inputMode="decimal"
                              value={f.price}
                              onChange={change("price")}
                            />
                          </label>
                          <p className="field-hint">
                            The buyer also pays the 0.001 CKB transaction fee.
                            The authenticated backing transfers with the right.
                          </p>
                          {offerStep === "create" ? (
                            <button
                              className="primary"
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
                              <label className="file-label">
                                Import offer file
                                <input
                                  disabled={p.busy}
                                  type="file"
                                  accept="application/json,.json"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 2000000) {
                                        setShareError(
                                          "Offer file exceeds 2 MB.",
                                        );
                                        return;
                                      }
                                      p.update("envelope", await file.text());
                                      setShareError("");
                                    }
                                  }}
                                />
                              </label>
                              <details>
                                <summary>Or paste an offer</summary>
                                <label htmlFor="offer-json">
                                  Assignment proposal
                                  <textarea
                                    disabled={p.busy}
                                    id="offer-json"
                                    value={f.envelope}
                                    onChange={change("envelope")}
                                    rows={5}
                                    spellCheck={false}
                                  />
                                </label>
                              </details>
                              <div className="actions">
                                <button
                                  disabled={locked || !f.envelope}
                                  onClick={() => p.onOffer("sign")}
                                >
                                  Review & add signature
                                </button>
                                <button
                                  className="primary"
                                  disabled={locked || !f.envelope}
                                  onClick={() => p.onOffer("submit")}
                                >
                                  Review & submit
                                </button>
                              </div>
                            </>
                          )}
                          {shareError && <p role="alert">{shareError}</p>}
                        </div>
                        <ol className="steps">
                          <li>
                            <b>Agree</b>
                            <span>
                              Set the market, claim, buyer and exact price.
                            </span>
                          </li>
                          <li>
                            <b>Review & share</b>
                            <span>
                              Save the offer file and send it privately to the
                              buyer. Import does not imply consent.
                            </span>
                          </li>
                          <li>
                            <b>Both sign</b>
                            <span>
                              Each wallet checks the same terms. Return the
                              signed file to finish.
                            </span>
                          </li>
                          <li>
                            <b>Wait for commitment</b>
                            <span>
                              Changed or spent inputs require a new offer and
                              fresh signatures.
                            </span>
                          </li>
                        </ol>
                      </div>
                      {f.envelope && (
                        <div className="offer-ready">
                          <div>
                            <b>Offer file ready</b>
                            <p>
                              May be unsigned or partially signed. Only chain
                              commitment completes the sale. Signatures
                              authorize the exact enclosed transaction.
                            </p>
                          </div>
                          <button onClick={download}>Save offer file</button>
                        </div>
                      )}
                      {noActions}
                    </section>
                  )}
                  {(m.creatorIsMe || m.funderIsMe) && (
                    <section className="panel">
                      <h2>Market administration</h2>
                      <p>
                        Creator proceeds are available only when all slots and
                        the goal are funded. Capacity returns only after all
                        liabilities are settled.
                      </p>
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
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {tab === "Create Market" && (
            <div className="create-grid">
              <section className="panel">
                <h2>Define your market</h2>
                <p>
                  Fixed backing terms. No royalties, yield or dynamic floor.
                </p>
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
                <p className="field-hint">
                  1–1,024 slots. Each requires at least 0.125 test CKB. All
                  slots must be funded before activation.
                </p>
                <label htmlFor="creator">
                  Creator's testnet address{" "}
                  <span className="muted">optional</span>
                  <input
                    disabled={p.busy}
                    id="creator"
                    value={f.creator}
                    onChange={change("creator")}
                    placeholder="Use my checked wallet"
                    spellCheck={false}
                  />
                </label>
                <label htmlFor="maturity">
                  Redemption maturity block
                  <input
                    disabled={p.busy}
                    id="maturity"
                    type="number"
                    min="0"
                    value={f.maturity}
                    onChange={change("maturity")}
                  />
                </label>
                <p className="field-hint">
                  Absolute CKB block height. 0 adds no block delay; this value
                  is fixed at creation.
                </p>
                <button
                  className="primary wide"
                  disabled={locked}
                  onClick={p.onCreate}
                >
                  Review market creation
                </button>
                {noActions}
              </section>
              <section className="panel terms">
                <span className="eyebrow">FUNDING BREAKDOWN</span>
                <h2>Capacity is not a fee.</h2>
                <dl>
                  <div>
                    <dt>Shared market capacity</dt>
                    <dd>322 CKB</dd>
                  </div>
                  <div>
                    <dt>Wallet capacity retained</dt>
                    <dd>At least 61 CKB</dd>
                  </div>
                  <div>
                    <dt>Creation fee</dt>
                    <dd>0.001 CKB</dd>
                  </div>
                  <div>
                    <dt>Minimum suitable input</dt>
                    <dd>383.001 CKB</dd>
                  </div>
                </dl>
                <hr />
                <dl>
                  <div>
                    <dt>Initial backing</dt>
                    <dd>80% of contributions</dd>
                  </div>
                  <div>
                    <dt>Creator proceeds</dt>
                    <dd>20% gross at activation</dd>
                  </div>
                </dl>
                <p className="note">
                  Code deployment is a separate prerequisite: 17,889 CKB
                  occupied code capacity in this configured version. It is not
                  included in the market budget or assumed recoverable. Market
                  capacity returns only at lawful closure.
                </p>
                <p className="note">
                  The creator needs a funded plain wallet Cell to activate. The
                  backing is denominated in CKB, not USD.
                </p>
              </section>
            </div>
          )}
          {tab === "Activity" && (
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>This session</h2>
                  <p>
                    Actual wallet requests and submissions appear here.
                    Refreshing the browser clears this session list; use market
                    recovery for ownership.
                  </p>
                </div>
              </div>
              {!p.activity.length ? (
                <Empty title="No transactions in this session">
                  <p>
                    Nothing has been signed or submitted here. Public market
                    history is recovered when you open a known market.
                  </p>
                </Empty>
              ) : (
                <ol className="activity-list">
                  {p.activity.map((a, i) => (
                    <li key={i}>
                      <div className="activity-top">
                        <b>{a.label}</b>
                        <span
                          className={
                            "badge " +
                            (a.state === "Committed" ? "positive" : "")
                          }
                        >
                          {a.state}
                        </span>
                      </div>
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
                          View transaction on explorer ↗{" "}
                          <span className="sr-only">{a.hash}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <details className="advanced">
            <summary>Advanced · wallet, contract & recovery</summary>
            <dl>
              <div>
                <dt>Checked wallet address</dt>
                <dd>
                  <code>{p.address || "Not checked"}</code>
                </dd>
              </div>
              <div>
                <dt>Wallet policy</dt>
                <dd>
                  Ordinary CKB secp256k1 only. OmniLock, JoyID, ACP and other
                  modes are not qualified for this covenant.
                </dd>
              </div>
              <div>
                <dt>Deployment status</dt>
                <dd>
                  {p.deployment}. No public signing until the exact code Cell is
                  approved and verified.
                </dd>
              </div>
            </dl>
            {p.connected && (
              <button onClick={p.onCheck} disabled={p.busy}>
                Check wallet compatibility
              </button>
            )}
            <p>
              State recovery verifies committed witnesses against the latest
              live market. Missing archives or stale inputs stop signing. Lost
              local receipts do not replace the need for public history.
            </p>
            {m && (
              <>
                <code>{m.id}</code>
                <code>{m.root}</code>
              </>
            )}
          </details>
          <footer>
            Trade · CKB testnet research pilot. No real funds, guaranteed
            liquidity or production readiness.
          </footer>
        </main>
      </div>
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
