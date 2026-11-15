"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCcc, useSigner } from "@ckb-ccc/connector-react";
import { LanguageSwitcher, useLocale } from "../i18n-provider";

const items = [
  ["/", "discover"],
  ["/portfolio", "portfolio"],
  ["/activity", "activity"],
  ["/launch", "launch"],
] as const;

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0"><circle cx="8.75" cy="8.75" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export default function Navigation({ active }: { active: string }) {
  const { t } = useLocale();
  const connector = useCcc();
  const signer = useSigner();
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [uiDemo, setUiDemo] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setUiDemo(process.env.NODE_ENV !== "production" && params.get("uiDemo") === "1");
    let current = true;
    setAddress("");
    if (signer) signer.getRecommendedAddressObj().then((value) => {
      if (current) setAddress(value.toString());
    }).catch(() => { if (current) setAddress(""); });
    return () => { current = false; };
  }, [signer]);
  return (
    <header className="relative z-10 border-b border-[#252527] bg-[#0b0b0c]">
      <div className="flex min-h-[52px] w-full flex-wrap items-center gap-x-5 px-3 sm:flex-nowrap sm:px-5 lg:px-6">
        <Link href={uiDemo ? "/?uiDemo=1" : "/"} style={{ color: "#f2f2f3" }} className="order-1 inline-flex shrink-0 items-center gap-2 py-2 text-[19px] font-bold tracking-normal no-underline">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[21px] text-[#68d796]"><path d="M4 5.5 12 2l8 3.5v9L12 22l-8-7.5v-9Z" fill="currentColor"/><path d="M8 12h8M12 8v8" stroke="#0b0b0c" strokeWidth="1.6" strokeLinecap="round"/></svg>
          <span>ROVEKO</span>
        </Link>
        <nav aria-label={t("primaryNavigation")} className="order-3 -mx-3 flex w-[calc(100%+1.5rem)] min-w-0 items-center gap-0 overflow-x-auto border-t border-[#202022] px-2 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0">
          {items.map(([href, key]) => (
            <Link
              key={href}
              href={uiDemo ? `${href}${href.includes("?") ? "&" : "?"}uiDemo=1` : href}
              aria-current={active === href ? "page" : undefined}
              style={{ color: active === href ? "#63d994" : "#a0a0a5" }}
              className={`shrink-0 px-3 py-[18px] text-[13px] font-medium no-underline transition-colors ${active === href ? "text-[#63d994]" : "text-[#a0a0a5] hover:text-[#f0f0f1]"}`}
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <form action="/" method="get" className="order-4 flex h-[30px] w-full items-center gap-1.5 border-b border-[#29292c] bg-transparent px-2 text-[#8b8b90] transition-colors focus-within:border-[#85858a] sm:order-3 sm:ml-auto sm:w-[160px]">
          <SearchIcon />
          <input name="q" value={query} onChange={(event) => setQuery(event.target.value)} className="!h-full !min-h-0 !min-w-0 !flex-1 !rounded-none !border-0 !bg-transparent !p-0 text-[11px] text-[#e6e6e8] !outline-none !outline-offset-0 placeholder:text-[#77777d] focus:!ring-0 focus-visible:!outline-none" placeholder={t("searchMarkets")} aria-label={t("searchMarkets")} />
          {uiDemo && <input type="hidden" name="uiDemo" value="1" />}
        </form>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-4 sm:ml-0">
          <span className="hidden items-center gap-1.5 px-1 text-[11px] font-medium text-[#b1b1b5] md:inline-flex"><i aria-hidden="true" className="size-1.5 rounded-full bg-[#68d796]" />CKB</span>
          <button type="button" onClick={() => connector.open()} style={{ minHeight: 32, padding: "7px 12px", border: 0, borderRadius: 6, backgroundColor: "#efeff0", color: "#101012" }} className="max-w-36 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold transition-colors hover:bg-white sm:max-w-52 sm:text-xs">
            {address ? `${address.slice(0, 10)}…${address.slice(-5)}` : t("connectWallet")}
          </button>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

export function UtilityBar() {
  const { t } = useLocale();
  return (
    <footer className="mt-auto flex min-h-8 items-center justify-between gap-3 border-t border-[#252a28] bg-[#090a0a] px-3 text-[11px] text-[#858b88] sm:px-5">
      <span className="flex min-w-0 items-center gap-2 whitespace-nowrap"><i aria-hidden="true" className="size-1.5 rounded-full bg-[#d7b46a]" />{t("pudgeTestnet")} <span className="text-[#515653]">·</span> {t("deploymentUnverified")}</span>
      <span className="truncate text-right">{t("testCkbOnly")}</span>
    </footer>
  );
}
