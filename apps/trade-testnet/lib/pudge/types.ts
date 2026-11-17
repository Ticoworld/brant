export type PageRoute = {
  view: "Markets" | "Market" | "My Positions" | "Create Market" | "Activity";
  id?: string;
  claim?: number;
};

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
  freshness?: "cached" | "verified";
  observedAt?: number;
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
};
