"use client";

import {useEffect, useRef, useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {useLocale} from '../i18n-provider';
import {useAccount} from './account-provider';
import {firstPurchaseQuantity, LaunchPreflightError, previewLaunch} from './launch-preflight';
import {formatCkb, PUDGE_GENESIS} from './rpc';
import TraderShell from './shell';

const field = 'mt-2 min-h-11 w-full rounded border border-[#35403b] bg-[#111614] px-3 text-sm';
const panel = 'min-w-0 rounded-md border border-[#28302f] bg-[#111513] p-5 sm:p-7';
const primary = 'min-h-11 rounded bg-[#a7e9c6] px-5 text-sm font-semibold text-[#102019] disabled:opacity-40';
const secondary = 'min-h-11 rounded border border-[#35403b] px-4 text-sm';
const ckb = (amount: bigint) => formatCkb(amount) + ' CKB';

export default function LaunchScreen() {
  const {locale} = useLocale();
  const t = (en: string, zh: string) => locale === 'zh-CN' ? zh : en;
  const account = useAccount();
  const signer = useSigner();
  const currentSigner = useRef(signer);
  currentSigner.current = signer;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [social, setSocial] = useState('');
  const [logo, setLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{signer: typeof signer; owner: string; result?: Awaited<ReturnType<typeof previewLaunch>>; error?: unknown}>();
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  const active = account.state === 'ready' && review?.owner === account.owner && review.signer === signer ? review : undefined;
  const quote = active?.result;
  const issue = active?.error;
  const steps = [t('Create token','创建代币'), t('Review launch','审核发行'), t('Launch','发行')];
  const stages = [t('Create market','创建市场'), t('Issue tokens','发行代币'), t('Initial purchase','首次购买')];

  async function refresh() {
    if (!signer || busy || account.state !== 'ready') return;
    const owner = account.owner;
    setBusy(true);
    setReview(undefined);
    try {
      const checkWallet = async () => {
        const [connected, genesis, address] = await Promise.all([
          signer.isConnected(), signer.client.getHeaderByNumber(0), signer.getRecommendedAddressObj(),
        ]);
        if (!connected || genesis?.hash !== PUDGE_GENESIS || address.script.hash() !== owner || signer !== currentSigner.current) {
          throw new LaunchPreflightError('network');
        }
        return address.script;
      };
      const result = await previewLaunch(await checkWallet());
      await checkWallet();
      setReview({signer, owner, result});
    } catch (error) {
      setReview({signer, owner, error});
    } finally {
      setBusy(false);
    }
  }

  const usable = quote?.usable ?? (issue instanceof LaunchPreflightError ? issue.usable : undefined);
  const message = issue instanceof LaunchPreflightError ? {
    funding: t('The available Cells cannot fund this launch. The plan needs a separate eligible anchor and setup funding.','当前可用 Cell 无法满足发行要求。发行计划需要独立的合格锚点和准备资金。'),
    network: t('Connect the same wallet account on Pudge and retry.','请在 Pudge 上连接同一钱包账户后重试。'),
    'local-proof': t('The Pudge initialization proof service requires a local origin. A verified quote is unavailable here.','Pudge 初始化证明服务仅允许本地来源。此处无法生成经过验证的报价。'),
    proof: t('The local Pudge initialization proof could not be verified.','无法验证本地 Pudge 初始化证明。'),
  }[issue.reason] : t('Launch funding or dependencies could not be verified. Retry when Pudge is synchronized.','无法验证发行资金或依赖项。请等待 Pudge 同步后重试。');

  return <TraderShell>
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="m-0 text-2xl font-semibold">{t('Launch a token','发行代币')}</h1>
        <p className="mb-0 mt-2 text-sm text-[#9ba6a2]">{t('Create a CKB / xUDT market on Pudge.','在 Pudge 上创建 CKB / xUDT 市场。')}</p>
      </header>
      <ol className="m-0 grid list-none grid-cols-3 gap-2 border-b border-[#28302f] p-0">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}
          className={'border-b-2 py-3 text-sm ' + (step === index ? 'border-[#a7e9c6] text-[#a7e9c6]' : 'border-transparent text-[#9ba6a2]')}>
          {index + 1}. {label}
        </li>)}
      </ol>
      <div className="grid items-start gap-4 md:grid-cols-[3fr_2fr]">
        <section className={panel}>
          <h2 className="m-0 text-lg font-semibold">{steps[step]}</h2>
          {step === 0 && <form className="mt-5 grid gap-4" onSubmit={event => {event.preventDefault(); if (name.trim() && ticker.trim()) setStep(1);}}>
            <label>{t('Token name','代币名称')}<input className={field} required maxLength={40} value={name} onChange={event => setName(event.target.value)}/></label>
            <label>{t('Ticker','代币符号')}<input className={field} required pattern="[A-Z0-9]{1,10}" maxLength={10} value={ticker} onChange={event => setTicker(event.target.value.toUpperCase())}/></label>
            <label>{t('Token logo (optional)','代币图标（选填）')}<input className="mt-2 block w-full text-sm text-[#a8b5ae]" type="file" accept="image/png,image/jpeg,image/webp"
              onChange={event => {const file = event.target.files?.[0]; setLogo(file && ['image/png','image/jpeg','image/webp'].includes(file.type) ? URL.createObjectURL(file) : '');}}/></label>
            <details className="text-sm"><summary className="cursor-pointer text-[#a8b5ae]">{t('Description and social link','描述和社交链接')}</summary>
              <label className="mt-3 block">{t('Description','描述')}<textarea className={field + ' py-2'} maxLength={240} value={description} onChange={event => setDescription(event.target.value)}/></label>
              <label className="mt-3 block">{t('Social link','社交链接')}<input className={field} type="url" value={social} onChange={event => setSocial(event.target.value)}/></label>
            </details>
            <button className={primary} disabled={!name.trim() || !ticker.trim()}>{steps[1]}</button>
          </form>}
          {step === 1 && <div className="mt-5 space-y-4">
            {account.state === 'ready' ? <p className="break-all text-sm text-[#a8b5ae]">{account.address}</p> :
              <p role="status" className="text-sm text-[#a8b5ae]">{account.state === 'wrong-network' ? t('Switch your wallet to Pudge.','请将钱包切换到 Pudge。') : account.state === 'unsupported' ? t('Switch to a supported Pudge wallet.','请切换到受支持的 Pudge 钱包。') : t('Connect your Pudge wallet to check funding.','连接 Pudge 钱包以检查资金。')}</p>}
            {usable !== undefined && <Amount label={t('Usable CKB','可用 CKB')} value={ckb(usable)}/>}
            <Amount label={t('First purchase','首次购买')} value={firstPurchaseQuantity + ' ' + ticker + ' · 91 CKB'}/>
            {quote && <>
              <p className="text-sm text-[#a7e9c6]">{t('Verified read-only estimate','经过验证的只读估算')}</p>
              <Amount label={t('Eligible launch funding','合格发行资金')} value={ckb(quote.accounting.eligibleFunding)}/>
              <Amount label={t('Locked after launch','发行后锁定')} value={ckb(quote.accounting.locked)}/>
              <Amount label={t('Curve reserve within locked amount','锁定金额中的曲线储备')} value={ckb(quote.accounting.curveReserve)}/>
              <Amount label={t('Estimated network fees','预估网络费用')} value={ckb(quote.accounting.fees)}/>
              <Amount label={t('Expected remaining usable CKB','预计剩余可用 CKB')} value={ckb(quote.accounting.change)}/>
              <details className="break-all text-xs text-[#a8b5ae]"><summary className="cursor-pointer">{t('Advanced','高级详情')}</summary>
                <p>{t('Provisional market ID','暂定市场标识')} {quote.market}</p>
                <p>{t('Provisional token type hash','暂定代币类型哈希')} {quote.token}</p>
                {Object.values(quote.accounting.stageFees).map((fee, index) => <Amount key={stages[index]} label={stages[index]} value={ckb(fee)}/>)}
              </details>
            </>}
            {issue != null && <p role="alert" className="text-sm text-[#efb9ac]">{message}</p>}
            <button className={primary} type="button" disabled={busy || ['checking','connecting'].includes(account.state)}
              onClick={account.state === 'ready' ? () => void refresh() : account.connect}>
              {busy ? t('Verifying…','正在验证…') : account.state === 'ready' ? quote ? t('Refresh estimate','刷新估算') : t('Check launch funding','检查发行资金') : t('Connect wallet','连接钱包')}
            </button>
            <div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setStep(0)}>{t('Back','返回')}</button>
              <button className={secondary} onClick={() => setStep(2)}>{t('View launch stages','查看发行步骤')}</button></div>
          </div>}
          {step === 2 && <div className="mt-5 space-y-4">
            <ol className="space-y-3 pl-5">{stages.map(label => <li key={label} className="border-b border-[#28302f] pb-3">
              <strong className="text-sm">{label}</strong>
              <p className="mb-0 mt-1 text-sm text-[#a8b5ae]">{t('Wallet approval → canonical confirmation','钱包批准 → 链上确认')}</p>
            </li>)}</ol>
            <p className="text-sm text-[#a8b5ae]">{t('Launch execution requires wallet submission and durable recovery support.','发行执行需要钱包提交和持久化恢复支持。')}</p>
            <div className="flex gap-2"><button className={secondary} onClick={() => setStep(1)}>{t('Back','返回')}</button>
              <button className={primary} disabled>{steps[2]}</button></div>
          </div>}
        </section>
        <aside className={panel + ' space-y-4'}>
          <div className="flex min-w-0 items-center gap-3">
            {/* Local image preview or approved Brant artwork. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-12 w-12 shrink-0 rounded-md border border-[#35403b] bg-[#1a211e] object-contain p-1" alt="" src={logo || '/brand/brant-symbol-white.svg'}/>
            <div className="min-w-0 break-words"><h2 className="m-0 text-lg font-semibold">{name.trim() || t('Token preview','代币预览')}</h2><p className="m-0 text-sm text-[#a8b5ae]">{ticker || 'xUDT'} / CKB</p></div>
          </div>
          {description.trim() && <p className="break-words text-sm">{description}</p>}
          {social.trim() && <p className="break-all text-xs text-[#a8b5ae]">{social}</p>}
          <p className="text-sm text-[#a8b5ae]">{t('Draft metadata for this session.','仅在本次会话中保留的元数据草稿。')}</p>
          <Amount label={t('Fixed supply','固定供应量')} value={'2,000 ' + (ticker || 'xUDT')}/>
          <Amount label={t('Starting price','起始价格')} value="10 CKB"/>
          <Amount label={t('Price increase per token','每枚代币价格增量')} value="1 CKB"/>
        </aside>
      </div>
    </div>
  </TraderShell>;
}

function Amount({label, value}: {label: string; value: string}) {
  return <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 border-t border-[#28302f] pt-2 text-sm">
    <span className="text-[#a8b5ae]">{label}</span><span className="font-medium tabular-nums">{value}</span>
  </div>;
}
