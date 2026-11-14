"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCcc, useSigner } from "@ckb-ccc/connector-react";
import { LanguageSwitcher, useLocale } from "../i18n-provider";

const items = [
  ["/v2", "trade"],
  ["/v2/discover", "discover"],
  ["/v2/portfolio", "portfolio"],
  ["/v2/orders", "openOrders"],
  ["/v2/activity", "activity"],
] as const;

export default function Navigation({ active }: { active: string }) {
  const { t } = useLocale();
  const connector = useCcc();
  const signer = useSigner();
  const [address, setAddress] = useState("");
  useEffect(() => {
    let current = true;
    setAddress("");
    if (signer) signer.getRecommendedAddressObj().then((value) => {
      if (current) setAddress(value.toString());
    }).catch(() => { if (current) setAddress(""); });
    return () => { current = false; };
  }, [signer]);
  return (
    <div className="border-b border-[#2d3a35] bg-[#0e1512]">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-x-4 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
        <Link href="/v2" className="order-1 shrink-0 py-3 font-semibold tracking-wide text-[#eef2ec] no-underline">
          ROVEKO <span className="text-xs font-normal text-[#9ebbad]">/ CKB</span>
        </Link>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-4">
          <button type="button" onClick={() => connector.open()} className="max-w-36 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap rounded border border-[#486153] px-3 py-2 text-xs text-[#dce7dd] hover:bg-[#18261e] sm:max-w-52 sm:text-sm">
            {address ? `${address.slice(0, 10)}…${address.slice(-5)}` : t("connectWallet")}
          </button>
          <LanguageSwitcher />
        </div>
        <nav aria-label={t("primaryNavigation")} className="order-3 -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-1 overflow-x-auto border-t border-[#25312b] px-3 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0">
          {items.map(([href, key]) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-4 text-sm no-underline transition-colors ${active === href ? "border-[#72dfb0] text-[#e8f5ed]" : "border-transparent text-[#9eaaa2] hover:text-[#e8f5ed]"}`}
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <Link href="/v2/deploy" className="order-3 hidden shrink-0 rounded border border-[#486153] px-3 py-2 text-sm text-[#b8e6cc] no-underline hover:bg-[#18261e] sm:inline-flex">
          {t("deployTestMarket")}
        </Link>
      </div>
    </div>
  );
}
