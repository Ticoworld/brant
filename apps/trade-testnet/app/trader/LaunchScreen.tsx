"use client";

import {useEffect, useRef, useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {launchMetadataMessage, normalizeLaunchMetadata} from '../../lib/v2-engine/launch-metadata';
import {publicationErrors,publicationRecovery} from '../../lib/v2-engine/launch-publication-errors';
import {requestWalletTransactionSignature} from '../../lib/v2-engine/wallet-signing';
import {verifyInitializationSignature} from '../../lib/v2-engine/initialization-signature';
import {readFundingCell} from '../../lib/v2-engine/funding';
import localFont from 'next/font/local';
import {useLocale} from '../i18n-provider';
import {useAccount} from './account-provider';
import {assertWalletFundingAvailable} from '../../lib/v2-engine/wallet-pending';
import {defaultLaunchTerms, validateLaunchTerms, type LaunchTerms} from '../../lib/v2-engine/launch-terms';
import { LaunchPreflightError, previewLaunch} from './launch-preflight';
import {formatCkb, PUDGE_GENESIS, pudgeRpc} from './rpc';
import TraderShell from './shell';

const geist = localFont({src:'../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',weight:'100 900'});
const field = 'mt-2 min-h-12 w-full !rounded-xl !border-0 !bg-[#1e2523] px-4 text-base focus-visible:!outline-2 focus-visible:!outline-[#7d9e91]';
const primary = 'justify-self-start min-h-12 !rounded-xl !bg-[#a7e9c6] px-6 text-sm font-semibold !text-[#102019] disabled:opacity-40';
const secondary = 'min-h-11 !rounded-xl !border-0 !bg-[#1e2523] px-4 text-sm';
const ckb = (amount: bigint) => formatCkb(amount) + ' CKB';
const launchStages = ['setup', 'issuance', 'purchase'] as const;
const sessionKey = (owner: string) => 'brant-launch-session:' + owner;
type Stage = typeof launchStages[number];
type SessionSummary = {metadata?:{name:string;ticker:string};family?:'atomic'|'legacy';market: string; entries: {state: string}[]};
type Session = {terms?:LaunchTerms;reviewId?:string;market?:string;metadata?:ReturnType<typeof normalizeLaunchMetadata>;family?:'atomic'|'legacy';transaction?:unknown;inputs?:{capacity:string;lock:ccc.ScriptLike;data:string;outPoint:{txHash:string;index:string}}[];published?: boolean; enabled: boolean; entries: {stage: Stage|'atomic'; state: string; txHash: string}[]};

async function launchApi(action: string, payload: object, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(45_000);
  const response = await fetch('/api/v2/launch/' + action, {method: 'POST',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout});
  if (!response.ok){const body=await response.json().catch(()=>({}));throw Error((publicationErrors[body.code as keyof typeof publicationErrors]||(typeof body.error==='string'?body.error:'Launch request failed'))+' '+(publicationRecovery[body.code as keyof typeof publicationRecovery]||'')+(typeof body.diagnosticId==='string'&&/^[0-9a-f-]{36}$/.test(body.diagnosticId)?' Reference: '+body.diagnosticId:''));}
  return response.json();
}

export default function LaunchScreen() {
  const {locale} = useLocale();
  const t = (en: string, zh: string) => locale === 'zh-CN' ? zh : en;
  const account = useAccount();
  const signer = useSigner();
  const currentSigner = useRef(signer);
  currentSigner.current = signer;
  type Workflow={genesis:string;owner:string;mode:'draft'|'review'|'saved'|'execution';family:'atomic'|'legacy';market?:string;reviewId?:string;phase:'draft'|'preparing'|'reviewed'|'wallet'|'submitting'|'submitted'|'publishing'|'completed'|'recoverable'};
  const workflow=useRef<Workflow>({genesis:PUDGE_GENESIS,owner:'',mode:'draft',family:'atomic',phase:'draft'});
  const generation=useRef(0);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [terms,setTerms]=useState<LaunchTerms>({...defaultLaunchTerms});
  const [termsError,setTermsError]=useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [social, setSocial] = useState('');
  const [logo, setLogo] = useState('');
  const [logoFile, setLogoFile] = useState<File>();
  const [publication, setPublication] = useState<{market: string; status: 'saving' | 'published' | 'pending';error?:string}>();
  const [busy, setBusy] = useState(false);
  const [reviewPhase, setReviewPhase] = useState<'wallet' | 'server' | 'slow' | 'long'>('wallet');
  const [retry, setRetry] = useState(0);
  const executionLock = useRef(false);
  const [execution, setExecutionState] = useState('');
  function setExecution(value:string){
    const phases:Record<string,Workflow['phase']>={wallet:'wallet',submitting:'submitting',pending:'submitted',checking:'submitted',publishing:'publishing',paused:'recoverable',error:'recoverable',changed:'recoverable'};
    if(phases[value])workflow.current={...workflow.current,mode:'execution',phase:phases[value]};
    setExecutionState(value);
  }
  const [setupTestResult, setSetupTestResult] = useState('');
  const verifiedSetups = useRef(new Set<string>());
  const [session, setSession] = useState<Session>();
  const [resumedMarket, setResumedMarket] = useState<string>();
  const [savedSessions, setSavedSessions] = useState<SessionSummary[]>([]);
  const [selection, setSelection] = useState<{owner: string; market: string}>();

  const [preparation, setPreparation] = useState<{reviewId?:string;family?:'atomic'|'legacy';inputs?:Session['inputs'];enabled: boolean; market: string; descriptor: object; transaction: unknown; accounting: unknown; terms?:LaunchTerms; owner: string}>();
  const [review, setReview] = useState<{signer: typeof signer; owner: string; result?: Awaited<ReturnType<typeof previewLaunch>>; error?: unknown}>();
  function acceptSession(value:Session){
    workflow.current={genesis:PUDGE_GENESIS,owner:workflow.current.owner,mode:'saved',family:value.family??'legacy',market:value.market,reviewId:value.reviewId,phase:value.published?'completed':value.entries.at(-1)?.state==='submitted'?'submitted':'reviewed'};
    setSession(value);
    if(value.terms)setTerms(value.terms);
    if(value.metadata){setName(value.metadata.name);setTicker(value.metadata.ticker);setDescription(value.metadata.description);setSocial(value.metadata.link);if(value.published&&value.metadata.logoHash&&value.market)setLogo('/api/v2/launch/logo?market='+value.market);}
    if(value.family==='atomic'&&value.market){const market=value.market;setSavedSessions(current=>current.some(s=>s.market===market)?current.map(s=>s.market===market?{...s,entries:value.entries}:s):[{family:'atomic',market,entries:value.entries},...current]);}
  }
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  const active = account.state === 'ready' && review?.owner === account.owner && review.signer === signer ? review : undefined;
  const quote = active?.result;
  const issue = active?.error;
  const steps = [t('Create token','创建代币'), t('Review launch','审核发行'), t('Launch','发行')];
  const stages = session?.family==='atomic'||preparation?.family==='atomic'?[t('Launch token','发行代币')]:[t('Create market','创建市场'), t('Issue tokens','发行代币'), t('Initial purchase','首次购买')];
  const owner = account.state === 'ready' ? account.owner : '';
  const selectedMarket = selection?.owner === owner ? selection.market : undefined;
  const previousOwner=useRef('');
  useEffect(()=>{if(previousOwner.current&&previousOwner.current!==owner){setPreparation(undefined);setReview(undefined);setStep(0);setName('');setTicker('');setDescription('');setSocial('');setLogo('');setLogoFile(undefined);setTerms({...defaultLaunchTerms});}previousOwner.current=owner;},[owner]);
  useEffect(() => {
    if (step !== 1 || !owner || !signer) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
    // The review belongs to this wallet, step and explicit retry.
  }, [step, owner, signer, retry]);
  useEffect(() => {
    workflow.current={genesis:PUDGE_GENESIS,owner,mode:selectedMarket?'saved':'draft',family:'atomic',market:selectedMarket,phase:'draft'};
    setSession(undefined);
    if(selectedMarket){setPreparation(undefined);setReview(undefined);setName('');setTicker('');setDescription('');setSocial('');setLogo('');setLogoFile(undefined);setTerms({...defaultLaunchTerms});}
    setSavedSessions([]);
    setResumedMarket(undefined);
    setPublication(undefined);
    if (!owner) return;
    let active = true;
    void (async () => {
      let sessions:SessionSummary[]=[];
      for(let attempt=0;attempt<3;attempt++){try{sessions=await launchApi('sessions',{owner});break;}catch(error){if(!active)return;if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));}}
      if (!active) return;
      setSavedSessions(sessions);
      const remembered = selectedMarket;
      const market = sessions.find(candidate => candidate.market === remembered)?.market;
      const result = market ? await launchApi('session', {owner, market}) : null;
      if (!active) return;
      if (result && market) {
        localStorage.setItem(sessionKey(owner), market);
        setResumedMarket(market);
        acceptSession(result);
        setStep(2);
        if (result.entries.at(-1)?.state === 'submitted') {
          const reconciled=await launchApi('reconcile', {owner, market}).catch(() => null);
          const latest = reconciled?.family==='atomic'?reconciled:await launchApi('session', {owner, market});
          if (active && latest) acceptSession(latest);
        }
      }
      else if (localStorage.getItem(sessionKey(owner)) === market) localStorage.removeItem(sessionKey(owner));
    })().catch(() => { if (active) setExecution('error'); });
    return () => {active = false;};
  }, [owner, selectedMarket]);

  useEffect(()=>{
    const market=session?.market??resumedMarket;
    if(!owner||!market||session?.published||session?.family!=='atomic')return;
    if(session.entries.at(-1)?.state!=='submitted')return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let attempt=0;
    const poll=async()=>{
      if(controller.signal.aborted)return;
      try{
        const status=await launchApi('status',{owner,market},controller.signal);
        if(controller.signal.aborted)return;
        if(status.state==='published'){const latest=await launchApi('session',{owner,market},controller.signal);if(!controller.signal.aborted){acceptSession(latest);setExecution('');}return;}
        if(status.state==='confirmed'){
          setExecution('publishing');
          const latest=await launchApi('reconcile',{owner,market},controller.signal);
          if(!controller.signal.aborted){acceptSession(latest);setExecution(latest.published?'':'pending');}
          if(latest.published)return;
        }
      }catch{ /* A transport error does not invalidate a submitted transaction. */ }
      if(!controller.signal.aborted)timer=setTimeout(poll,document.hidden?15000:Math.min(10000,1500*2**Math.min(attempt++,3)));
    };
    void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[owner,session?.market,session?.published,session?.entries.at(-1)?.state,resumedMarket]);

  async function retrySavedPublication(){
    const market=workflow.current.market;
    if(!market||!owner||executionLock.current)return;
    executionLock.current=true;setPublication({market,status:'saving'});
    try{await launchApi('retry-publication',{owner,market});setPublication({market,status:'published'});setSession(current=>current&&{...current,published:true});}
    catch(error){setPublication({market,status:'pending',error:error instanceof Error?error.message:'Retry saved publication failed'});}
    finally{executionLock.current=false;}
  }
  async function publishMetadata() {
    const market = workflow.current.market;
    if (!owner || !market || !signer || executionLock.current) return;
    executionLock.current = true;
    setPublication({market, status: 'saving'});
    try {
      const address = await signer.getRecommendedAddressObj();
      if (address.script.hash() !== owner || (await signer.client.getHeaderByNumber(0))?.hash !== PUDGE_GENESIS) {
        throw Error('Wallet changed');
      }
      if (logoFile && logoFile.size > 42_000) throw Error('Token logo exceeds 42 KB');
      const bytes = logoFile ? new Uint8Array(await logoFile.arrayBuffer()) : undefined;
      const originalLogo = bytes ? btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) : undefined;
      const normalized = bytes ? await launchApi('normalize-logo', {logo: originalLogo, logoHash: ccc.hashCkb(bytes)}) : {};
      const logoHash = normalized.logoHash as string | undefined;
      const logoPayload = normalized.logo as string | undefined;
      const metadata = normalizeLaunchMetadata({name, ticker, description, link: social, logoHash});
      const message=launchMetadataMessage({genesis:PUDGE_GENESIS,owner,market},metadata);
      const authorizationKey='brant-launch-publication:'+ccc.hashCkb(new TextEncoder().encode(message));
      const saved=localStorage.getItem(authorizationKey);
      const signature=saved||await signer.signMessageRaw(message);
      if(!/^0x[0-9a-fA-F]{130}$/.test(signature))throw Error('Unsupported metadata authorization response');
      localStorage.setItem(authorizationKey,signature);
      if (currentSigner.current !== signer) throw Error('Wallet changed');
      await launchApi('publish', {owner, market, metadata, signature, logo: logoPayload});
      setPublication({market, status: 'published'});
      setSession(current => current && {...current, published: true});
    } catch(error) {
      const message=error instanceof Error&&Object.values(publicationErrors).some(value=>error.message.startsWith(value))?error.message:'Metadata authorization or delivery failed. Your confirmed token is preserved.';
      setPublication({market, status: 'pending',error:message});
    } finally {
      executionLock.current = false;
    }
  }

  async function execute() {
    if(!signer||!owner||!navigator.locks){setExecution('paused');return;}
    await navigator.locks.request(`roveko-gate2-trade-${owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock){setExecution('paused');return;}
      try{assertWalletFundingAvailable(localStorage,PUDGE_GENESIS,owner);await executeLocked();}
      catch{setExecution('paused');}
    });
  }

  async function executeLocked() {
    if (!signer || !owner || executionLock.current) return;
    executionLock.current = true;
    const savedMarket = workflow.current.market;
    const context=workflow.current;
    if(context.owner!==owner||context.genesis!==PUDGE_GENESIS){executionLock.current=false;return;}
    const prepared = preparation?.owner === owner&&preparation.market===context.market&&preparation.reviewId===context.reviewId ? preparation : undefined;
    let market = context.market;
    let identity = {owner, market};
    let atomicHandled=false;
    const checkWallet = async () => {
      if (currentSigner.current !== signer || !await signer.isConnected() ||
          (await signer.client.getHeaderByNumber(0))?.hash !== PUDGE_GENESIS ||
          (await signer.getRecommendedAddressObj()).script.hash() !== owner) throw Error('Wallet changed');
    };
    try {
      await checkWallet();
      let current: Session | null = market ? await launchApi('session', identity) : null;
      if (savedMarket && !current && step === 2) {
        setExecution('pending');
        return;
      }
      if(current?.family==='atomic'||prepared?.family==='atomic'){
        atomicHandled=true;
        market=current?.family==='atomic'?market:prepared!.market;identity={owner,market};setStep(2);
        let atomic=current?.family==='atomic'?current:undefined;
        const resuming=atomic?.entries.at(-1)?.state==='submitted';
        if(!atomic||atomic.entries.length===0){
          const source=atomic||prepared!;
          if(!source.enabled||!source.inputs||!source.transaction)return;
          const transaction=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(source.transaction as never));
          transaction.inputs.forEach((input,index)=>{const cell=source.inputs![index];if(!cell||input.previousOutput.txHash!==cell.outPoint.txHash||input.previousOutput.index!==BigInt(cell.outPoint.index))throw Error('Atomic review inputs differ');input.cellOutput=ccc.CellOutput.from(cell);input.outputData=ccc.hexFrom(cell.data);});
          await checkWallet();setExecution('wallet');
          const recoveryKey=`brant-atomic-signed:${PUDGE_GENESIS}:${owner}:${market}:${source.reviewId??''}`;
          const retained=localStorage.getItem(recoveryKey);
          const signed=retained?ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(JSON.parse(retained))):await requestWalletTransactionSignature(signer,transaction,()=>{});
          verifyInitializationSignature(transaction,signed,source.inputs!,0,owner);
          localStorage.setItem(recoveryKey,JSON.stringify(cccA.JsonRpcTransformers.transactionFrom(signed)));
          await checkWallet();localStorage.setItem(sessionKey(owner),market!);setResumedMarket(market);setExecution('submitting');
          try{atomic=await launchApi('submit',{...identity,reviewId:source.reviewId,stage:'atomic',signed:cccA.JsonRpcTransformers.transactionFrom(signed)});}catch{const saved=await launchApi('session',identity).catch(()=>null);if(saved&&currentSigner.current===signer)acceptSession(saved);setExecution('pending');return;}
        }
        if(resuming){await launchApi('resubmit',identity);}
        await checkWallet();
        if(atomic&&currentSigner.current===signer)acceptSession(atomic);
        setExecution(atomic?.published?'':'pending');return;
      }
      if (!current && prepared && market !== prepared.market) {
        market = prepared.market;
        identity = {owner, market};
      }
      if (!current && prepared?.enabled) {
        const lock = (await signer.getRecommendedAddressObj()).script;
        const fresh = await launchApi('prepare', {creator: lock});
        if (!fresh.enabled || fresh.market !== prepared.market ||
            JSON.stringify(fresh.descriptor) !== JSON.stringify(prepared.descriptor) ||
            JSON.stringify(fresh.transaction) !== JSON.stringify(prepared.transaction) ||
            JSON.stringify(fresh.accounting) !== JSON.stringify(prepared.accounting)) {
          setRetry(value => value + 1);
          setStep(1);
          setExecution('changed');
          return;
        }
      }
      setStep(2);
      for (let index = 0; index < launchStages.length; index++) {
        await checkWallet();
        if(current?.entries.at(-1)?.state==='submitted'){
          await launchApi('reconcile',identity).catch(()=>null);
          current=await launchApi('session',identity);
          if(current&&currentSigner.current===signer)setSession(current);
        }
        if (current?.entries.filter(entry => entry.state === 'confirmed').length === launchStages.length) break;
        const renewing=current?.entries.at(-1)?.state==='submitted';
        {
          const next = current ? await launchApi(renewing?'pending-review':'next-stage', identity) :
            prepared?.enabled ? {...prepared, stage: 'setup'} : null;
          if (!next || !(current?.enabled ?? prepared?.enabled)) return;
          const transaction = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(next.transaction));
          await Promise.all(transaction.inputs.map(async input => {
            const row = await pudgeRpc('get_live_cell', [{tx_hash: input.previousOutput.txHash,
              index: ccc.numToHex(input.previousOutput.index)}, true]);
            if (row?.status !== 'live' || !row.cell) throw Error('Launch input is no longer live');
            const output = cccA.JsonRpcTransformers.cellOutputTo(row.cell.output);
            input.cellOutput = ccc.CellOutput.from(output);
            input.outputData = row.cell.data.content;
          }));
          transaction.setWitnessArgs(next.stage === 'purchase' ? 2 : 0,
            ccc.WitnessArgs.from({lock: '0x' + '00'.repeat(65)}));
          await checkWallet();
          setExecution('wallet');
          const signed = await requestWalletTransactionSignature(signer, transaction, () => {});
          await checkWallet();
          setExecution('submitting');
          localStorage.setItem(sessionKey(owner), market!);
          try {
            await launchApi(renewing?'resubmit':'submit', {...identity, stage: next.stage, descriptor: current ? undefined : prepared?.descriptor,
              signed: cccA.JsonRpcTransformers.transactionFrom(signed)});
          } catch {
            setExecution('pending');
            return;
          }
        }
        setExecution('checking');
        current = await launchApi('session', identity);
        if (current && currentSigner.current === signer) setSession(current);
        for (let attempt = 0; attempt < 6; attempt++) {
          await checkWallet();
          const receipt = await launchApi('reconcile', identity).catch(() => null);
          current = await launchApi('session', identity);
          if (current && currentSigner.current === signer) setSession(current);
          if (receipt || current?.entries.at(-1)?.state === 'confirmed') break;
          if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!current || current.entries.at(-1)?.state !== 'confirmed') {
          setExecution('pending');
          return;
        }
      }
      setExecution('');
    } catch {
      setExecution('paused');
    } finally {
      if (market&&!atomicHandled) {
        const latest = await launchApi('session', identity).catch(() => null);
        if (latest && currentSigner.current === signer) setSession(latest);
      }
      executionLock.current = false;
    }
  }

  async function refresh(signal: AbortSignal) {
    if (!signer || account.state !== 'ready') return;
    const owner = account.owner;
    const requestGeneration=++generation.current;
    workflow.current={genesis:PUDGE_GENESIS,owner,mode:'review',family:'atomic',phase:'preparing'};
    setBusy(true);
    setReviewPhase('wallet');
    setReview(undefined);
    setPreparation(undefined);
    setSetupTestResult('');
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    let longTimer: ReturnType<typeof setTimeout> | undefined;
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
      const lock = await checkWallet();
      if (signal.aborted) return;
      setReviewPhase('server');
      slowTimer = setTimeout(() => setReviewPhase('slow'), 8000);
      longTimer = setTimeout(() => setReviewPhase('long'), 15000);
      const bytes=logoFile?new Uint8Array(await logoFile.arrayBuffer()):undefined;
      const logoPayload=bytes?btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join('')):undefined;
      const normalized=bytes?await launchApi('normalize-logo',{logo:logoPayload,logoHash:ccc.hashCkb(bytes)},signal):{};
      if(normalized.logo&&!signal.aborted&&requestGeneration===generation.current)setLogo('data:image/png;base64,'+normalized.logo);
      const economics=validateLaunchTerms(terms);
      const prepared = await launchApi('prepare', {...economics,creator: lock,metadata:normalizeLaunchMetadata({name,ticker,description,link:social,logoHash:normalized.logoHash}),logo:normalized.logo}, signal);
      clearTimeout(slowTimer);
      clearTimeout(longTimer);
      setReviewPhase('wallet');
      const values = prepared.accounting;
      const result: Awaited<ReturnType<typeof previewLaunch>> = {usable: BigInt(values.eligibleFunding),
        market: prepared.market, token: prepared.token, accounting: {eligibleFunding: BigInt(values.eligibleFunding),
          locked: BigInt(values.locked), change: BigInt(values.change), curveReserve: BigInt(values.curveReserve), fees: BigInt(values.fees),
          stageFees: {setup: BigInt(values.stageFees.setup), issuance: BigInt(values.stageFees.issuance), purchase: BigInt(values.stageFees.purchase)}}};
      await checkWallet();
      if (signal.aborted||requestGeneration!==generation.current) return;
      workflow.current={genesis:PUDGE_GENESIS,owner,mode:'review',family:prepared.family,market:prepared.market,reviewId:prepared.reviewId,phase:'reviewed'};
      setPreparation({...prepared, owner});
      setReview({signer, owner, result});
    } catch (error) {
      if (!signal.aborted) setReview({signer, owner, error});
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(longTimer);
      if (!signal.aborted) setBusy(false);
    }
  }

  const localSetupTest = process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' &&
    new URLSearchParams(window.location.search).get('diagnostics') === 'setup';
  const setupHash = localSetupTest ? (preparation?.descriptor as {hashes?: {setup: string}} | undefined)?.hashes?.setup : undefined;
  const setupTestKey = owner && setupHash && preparation?.owner === owner ? `${owner}:${setupHash}` : undefined;
  const setupVerified = setupTestKey !== undefined && verifiedSetups.current.has(setupTestKey);

  async function signSetupLocally() {
    if (!localSetupTest || !signer || !quote || !preparation || !setupTestKey ||
        verifiedSetups.current.has(setupTestKey) || executionLock.current) return;
    executionLock.current = true;
    setExecution('wallet');
    setSetupTestResult('');
    let failure = t('Could not verify the connected Pudge wallet.','无法验证已连接的 Pudge 钱包。');
    try {
      const verifyWallet = async () => {
        if (currentSigner.current !== signer || !await signer.isConnected() ||
            (await signer.client.getHeaderByNumber(0))?.hash !== PUDGE_GENESIS ||
            (await signer.getRecommendedAddressObj()).script.hash() !== owner ||
            await pudgeRpc('get_block_hash', ['0x0']) !== PUDGE_GENESIS) throw Error('Wallet identity changed');
      };
      await verifyWallet();
      failure = t('Setup differs from the server review.','准备交易与服务器审核不一致。');
      const descriptor = preparation.descriptor as {hashes: {setup: string}; anchor: {txHash: string; index: string};
        funding: {txHash: string; index: string}[]};
      const reviewed = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(
        preparation.transaction as Parameters<typeof cccA.JsonRpcTransformers.transactionTo>[0]));
      const hash = reviewed.hash();
      if (hash !== descriptor.hashes.setup || reviewed.inputs.length !== descriptor.funding.length ||
          reviewed.inputs.some(({previousOutput}, index) => previousOutput.txHash !== descriptor.funding[index].txHash ||
            previousOutput.index !== BigInt(descriptor.funding[index].index))) throw Error('Setup mismatch');

      failure = t('Setup funding or anchor is spent, unavailable, or belongs to another wallet.','准备资金或锚点已花费、不可用或属于其他钱包。');
      const [anchor, ...inputs] = await Promise.all([descriptor.anchor, ...descriptor.funding]
        .map(point => readFundingCell(pudgeRpc, point, owner)));
      const capacity = inputs.reduce((sum, input) => sum + input.capacity, 0n);
      failure = t('Live capacity or Setup fee differs from the review.','实时容量或准备交易费用与审核不一致。');
      if (capacity + anchor.capacity !== quote.accounting.eligibleFunding ||
          capacity - reviewed.outputs.reduce((sum, output) => sum + output.capacity, 0n) !== quote.accounting.stageFees.setup) {
        throw Error('Setup capacity changed');
      }
      const prepared = reviewed.clone();
      prepared.inputs.forEach((input, index) => {
        input.cellOutput = ccc.CellOutput.from({capacity: inputs[index].capacity, lock: inputs[index].lock as ccc.ScriptLike});
        input.outputData = ccc.hexFrom(inputs[index].data);
      });
      prepared.setWitnessArgs(0, ccc.WitnessArgs.from({lock: '0x' + '00'.repeat(65)}));
      failure = t('The connected Pudge wallet changed before approval.','批准前已连接的 Pudge 钱包发生变化。');
      await verifyWallet();
      failure = t('CCC could not prepare the exact reviewed Setup transaction.','CCC 无法准备与审核完全一致的准备交易。');
      const signed = await requestWalletTransactionSignature(signer, prepared, (stage, received) => {
        if (received) failure = t('The wallet returned an invalid transaction.','钱包返回了无效交易。');
        else if (stage !== 'CCC transaction preparation') failure = t('The wallet declined or failed the signing request.','钱包拒绝签名或签名请求失败。');
      });
      failure = t('The returned transaction, witnesses, or creator signature failed independent verification.','返回的交易、见证或创建者签名未通过独立验证。');
      verifyInitializationSignature(reviewed, signed, inputs.map(input => ({lock: input.lock as ccc.ScriptLike})), 0, owner);
      failure = t('The connected Pudge wallet changed during approval.','批准期间已连接的 Pudge 钱包发生变化。');
      await verifyWallet();
      verifiedSetups.current.add(setupTestKey);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      setSetupTestResult(typeof code === 'number' ? failure + ' (' + code + ')' : failure);
    } finally {
      setExecution('');
      executionLock.current = false;
    }
  }

  const usable = quote?.usable ?? (issue instanceof LaunchPreflightError ? issue.usable : undefined);
  const message = issue instanceof LaunchPreflightError ? {
    funding: t('The available Cells cannot fund this launch. The plan needs a separate eligible anchor and setup funding.','当前可用 Cell 无法满足发行要求。发行计划需要独立的合格锚点和准备资金。'),
    network: t('Connect the same wallet account on Pudge and retry.','请在 Pudge 上连接同一钱包账户后重试。'),
    'proof-origin': t('Launch proofs are unavailable on this site.','此站点暂不提供发行证明。'),
    proof: t('The Pudge initialization proof could not be verified.','无法验证 Pudge 初始化证明。'),
  }[issue.reason] : t('Launch funding or dependencies could not be verified. Retry when Pudge is synchronized.','无法验证发行资金或依赖项。请等待 Pudge 同步后重试。');

  return <TraderShell wide>
    <div className={geist.className + ' pb-[60px] pt-7 text-[#f2f5f4] sm:pt-[34px]'}>
      <header className="mb-[26px]">
        <h1 className="m-0 text-[clamp(32px,3.1vw,46px)] leading-[1.12] font-[650] tracking-[-.055em]">{t('Launch a token','发行代币')}</h1>
        <p className="mb-0 mt-[7px] text-sm text-[#98a7a2]">{t('Create a CKB / xUDT market on Pudge.','在 Pudge 上创建 CKB / xUDT 市场。')}</p>
      </header>
      <ol className="m-0 flex list-none flex-wrap gap-x-5 border-b border-[#28302f] p-0 sm:gap-x-10">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}
          className={'border-b-2 py-3 text-sm ' + (step === index ? 'border-[#a7e9c6] text-[#a7e9c6]' : 'border-transparent text-[#9ba6a2]')}>
          {index + 1}. {label}
        </li>)}
      </ol>
      <div className="mt-8 grid items-start gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] lg:mt-10 lg:gap-[clamp(48px,6vw,120px)]">
        <section className="min-w-0">
          <h2 className="m-0 text-[21px] font-[640] tracking-[-.03em]">{steps[step]}</h2>
          {savedSessions.length > 0 && <label className="mt-4 block text-sm">
            {t('Saved launches', '已保存的发行')}
            <select className={field} disabled={busy || ['wallet','submitting','checking'].includes(execution)} value={selectedMarket ?? resumedMarket ?? ''}
              onChange={event => {
                if (executionLock.current || !event.target.value) return;
                setExecution('');
                setSelection({owner, market: event.target.value});
              }}>
              <option value="">{t('Select a launch', '选择发行')}</option>
              {savedSessions.map(({market, entries,family,metadata}) => <option key={market} value={market}>
                {metadata?metadata.name+' / '+metadata.ticker+' · ':''}{market.slice(0, 14)}…{market.slice(-8)} · {entries.filter(entry => entry.state === 'confirmed').length}/{family==='atomic'?1:3}
              </option>)}
            </select>
          </label>}
          {step===0&&savedSessions.some(s=>s.entries.some(e=>e.state==='submitted'))&&<p role="status">{t('A submitted launch is awaiting recovery.','已提交的发行等待恢复。')} <button className={secondary} onClick={()=>{const pending=savedSessions.find(s=>s.entries.some(e=>e.state==='submitted'));if(pending&&!executionLock.current)setSelection({owner,market:pending.market});}}>{t('Resume pending launch','继续待处理发行')}</button></p>}
          {(session || preparation || step !== 0) && <button className={secondary} disabled={busy || ['wallet','submitting','checking'].includes(execution)} onClick={() => {
            if(executionLock.current)return;
            generation.current++;workflow.current={genesis:PUDGE_GENESIS,owner,mode:'draft',family:'atomic',phase:'draft'};
            setSelection(undefined);setResumedMarket(undefined);setSession(undefined);setPreparation(undefined);setReview(undefined);setPublication(undefined);
            setTerms({...defaultLaunchTerms});setTermsError('');setName('');setTicker('');setDescription('');setSocial('');setLogo('');setLogoFile(undefined);setExecution('');setStep(0);
          }}>{t('Create new token','创建新代币')}</button>}
          {session?.published && session.market && <a className={secondary} href={'/market/'+session.market}>{t('Open market','打开市场')}</a>}
          {step === 0 && <form className="mt-6 grid gap-6 text-sm" onSubmit={event => {event.preventDefault(); try{validateLaunchTerms(terms);setTermsError('');if(name.trim()&&ticker.trim())setStep(1);}catch(error){setTermsError(error instanceof Error?error.message:'Invalid economics');}}}>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 sm:gap-5">
            <label>{t('Token name','代币名称')}<input className={field} required maxLength={40} value={name} onChange={event => setName(event.target.value)}/></label>
            <label>{t('Ticker','代币符号')}<input className={field} required pattern="[A-Z0-9]{1,10}" maxLength={10} value={ticker} onChange={event => setTicker(event.target.value.toUpperCase())}/></label>
            </div>
            <label className="grid cursor-pointer gap-2">
              {t('Token logo (optional)','代币图标（选填）')}
              <input className="peer sr-only" type="file" accept="image/png,image/jpeg,image/webp"
                onChange={event => {const file = event.target.files?.[0]; setLogoFile(file); setLogo(file && ['image/png','image/jpeg','image/webp'].includes(file.type) ? URL.createObjectURL(file) : '');}}/>
              <span className="flex min-h-28 items-center gap-4 rounded-xl bg-[#151a19] p-4 hover:bg-[#1e2523] peer-focus-visible:outline-2 peer-focus-visible:outline-[#6cddb5] sm:px-6">
                {logo ? <img src={logo} alt="" className="size-12 rounded-lg object-cover"/> :
                  <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#254139] text-2xl text-[#a7e9c6]">+</span>}
                <span className="grid gap-1">
                  <strong className="font-medium">{logo ? t('Replace image','更换图片') : t('Choose an image','选择图片')}</strong>
                  <span className="text-[#aab7b3]">PNG, JPG, WebP · 42 KB</span>
                </span>
              </span>
            </label>
            <details className="text-sm"><summary className="cursor-pointer text-[#a8b5ae]">{t('Description and social link','描述和社交链接')}</summary>
              <label className="mt-3 block">{t('Description','描述')}<textarea className={field + ' py-2'} maxLength={240} value={description} onChange={event => setDescription(event.target.value)}/></label>
              <label className="mt-3 block">{t('Social link','社交链接')}<input className={field} type="url" value={social} onChange={event => setSocial(event.target.value)}/></label>
            </details>
            <div className="grid gap-4 sm:grid-cols-2">{([
              ['supply',t('Fixed supply','固定供应量')],['base',t('Starting price (CKB)','起始价格（CKB）')],
              ['increment',t('Price increase per token (CKB)','每枚代币价格增量（CKB）')],['quantity',t('Initial purchase quantity','首次购买数量')],
            ] as const).map(([key,label])=><label key={key}>{label}<input className={field} required inputMode={key==='supply'||key==='quantity'?'numeric':'decimal'} value={terms[key]} onChange={event=>setTerms(current=>({...current,[key]:event.target.value}))}/></label>)}</div>
            {termsError&&<p role="alert">{termsError}</p>}
            <button className={primary} disabled={!name.trim() || !ticker.trim()}>{steps[1]}</button>
          </form>}
          {step === 1 && <div className="mt-6 space-y-5">
            {account.state === 'ready' ? <p className="break-all text-sm text-[#a8b5ae]">{account.address}</p> :
              <p role="status" className="text-sm text-[#a8b5ae]">{account.state === 'wrong-network' ? t('Switch your wallet to Pudge.','请将钱包切换到 Pudge。') : account.state === 'unsupported' ? t('Switch to a supported Pudge wallet.','请切换到受支持的 Pudge 钱包。') : t('Connect your Pudge wallet to check funding.','连接 Pudge 钱包以检查资金。')}</p>}
            <Amount label={t('Selected funding capacity','已选资金容量')} value={usable === undefined ? undefined : ckb(usable)}/>
            <Amount label={t('First purchase','首次购买')} value={(preparation?.terms?.quantity ?? terms.quantity) + ' ' + ticker + (quote?' · '+ckb(quote.accounting.curveReserve):'')}/>
            {quote && <p className="text-sm text-[#a7e9c6]">{t('Verified read-only estimate','经过验证的只读估算')}</p>}
              <Amount label={t('Eligible launch funding','合格发行资金')} value={quote ? ckb(quote.accounting.eligibleFunding) : undefined}/>
              <Amount label={t('Locked after launch','发行后锁定')} value={quote ? ckb(quote.accounting.locked) : undefined}/>
              <Amount label={t('Curve reserve within locked amount','锁定金额中的曲线储备')} value={quote ? ckb(quote.accounting.curveReserve) : undefined}/>
              <Amount label={t('Estimated network fees','预估网络费用')} value={quote ? ckb(quote.accounting.fees) : undefined}/>
              <Amount label={t('Total estimated cost (locked CKB + fees)','预计总成本（锁定 CKB + 手续费）')} value={quote ? ckb(quote.accounting.locked + quote.accounting.fees) : undefined}/>
              <Amount label={t('Expected change from selected inputs','已选输入的预计找零')} value={quote ? ckb(quote.accounting.change) : undefined}/>
            {quote && <details className="break-all text-xs text-[#a8b5ae]"><summary className="cursor-pointer">{t('Advanced','高级详情')}</summary>
                <p>{t('Provisional market ID','暂定市场标识')} {quote.market}</p>
                <p>{t('Provisional token type hash','暂定代币类型哈希')} {quote.token}</p>
                {Object.values(quote.accounting.stageFees).filter((_,index)=>preparation?.family!=='atomic'||index===0).map((fee, index) => <Amount key={stages[index]} label={stages[index]} value={ckb(fee)}/>)}
              </details>}
            {issue != null && <p role="alert" className="text-sm text-[#efb9ac]">{issue instanceof Error?issue.message:message}</p>}
            {process.env.NODE_ENV === 'development' && localSetupTest && quote && preparation?.owner === owner && <div className="space-y-2">
              <p className="break-all text-sm">{t('Setup transaction hash','准备交易哈希')} · {setupHash}</p>
              {setupVerified ? <p role="status" className="text-sm">{t('Signature verified','签名已验证')}</p> :
              <button className={secondary} type="button" disabled={busy || execution === 'wallet'} onClick={() => void signSetupLocally()}>
                {execution === 'wallet' ? t('Awaiting wallet','等待钱包') : t('Sign Setup without broadcasting','签署准备交易（不广播）')}
              </button>}
              {!setupVerified && setupTestResult && <p role="status" className="break-all text-sm">{setupTestResult}</p>}
            </div>}
            {owner && busy && <div role="status" className="flex items-start gap-3 text-sm">
              <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-[#35403b] border-t-[#a7e9c6] motion-safe:animate-spin"/>
              {reviewPhase === 'wallet' ? t('Verifying wallet and network…','正在验证钱包和网络…') :
                reviewPhase === 'server' ? t('Checking launch funding…','正在检查发行资金…') :
                reviewPhase === 'slow' ? t('Still checking live Pudge data…','仍在检查 Pudge 链上数据…') :
                t('Still checking live Pudge data. You can wait or cancel the review.','仍在检查 Pudge 链上数据。你可以等待或取消审核。')}
            </div>}
            {execution === 'changed' && <p role="status">{t('The launch review changed. Review the updated estimate before launching.','发行审核已变更，请在发行前核对最新估算。')}</p>}
            {quote && !preparation?.enabled && <p>{t('Testnet launch execution is not enabled yet.','测试网发行暂未启用。')}</p>}
            <div className="flex flex-wrap gap-2">
              <button className={secondary} disabled={executionLock.current} onClick={() => {if(preparation?.family==='atomic')void launchApi('cancel',{owner,market:preparation.market,reviewId:preparation.reviewId}).then(()=>{setPreparation(undefined);setStep(0);}).catch(error=>setTermsError(String(error)));else setStep(0);}}>{owner && busy && reviewPhase === 'long' ? t('Cancel review','取消审核') : t('Back','返回')}</button>
              {!owner && account.state !== 'wrong-network' && <button className={primary} disabled={['checking','connecting'].includes(account.state)} onClick={account.connect}>{t('Connect wallet','连接钱包')}</button>}
              {owner && issue != null && !busy && <button className={primary} onClick={() => setRetry(value => value + 1)}>{t('Retry','重试')}</button>}
              {quote && <button className={primary} disabled={busy || !preparation?.enabled} onClick={() => void execute()}>{t('Launch token','发行代币')}</button>}
            </div>
          </div>}
          {step === 2 && <div className="mt-5 space-y-4">
            <ol className="space-y-3 pl-5">{stages.map((label, index) => <li key={label} className="border-b border-[#28302f] pb-3">
              <strong className="text-sm">{label}</strong>
              {session?.entries[index] && <details className="mt-1 break-all text-sm text-[#a8b5ae]">
                <summary>{session.entries[index].state === 'confirmed' ? t('Confirmed','已确认') : t('Confirming','确认中')}</summary>
                {session.entries[index].txHash}</details>}
            </li>)}</ol>
            {execution && <p role="status">{{wallet:t('Awaiting wallet','等待钱包'),submitting:t('Submitting','正在提交'),
              publishing:t('Publishing metadata','正在发布元数据'),checking:t('Checking previous transaction','正在检查上一笔交易'),pending:t('Submission is awaiting confirmation.','正在等待提交结果确认。'),
              paused:t('Launch paused. Resume when your wallet is ready.','发行已暂停。钱包就绪后可继续。'),
              error:t('The saved session could not be read.','无法读取已保存的会话。')}[execution]}</p>}
            {!(session?.enabled || preparation?.enabled) && <p className="text-sm text-[#a8b5ae]">{t('Launch execution is disabled.','发行执行已禁用。')}</p>}
            {session?.family==='atomic'&&session.published?<p role="status">{t('Token launched and metadata published','代币已发行，元数据已发布')}</p>:session?.entries.filter(entry => entry.state === 'confirmed').length === launchStages.length ?
              <div className="grid gap-3">
                <p role="status">{t('Launch transactions confirmed','发行交易已确认')}</p>
                <label>{t('Token name','代币名称')}<input className={field} disabled={session.published} value={name} maxLength={80} onChange={event => setName(event.target.value)}/></label>
                <label>{t('Ticker','代币符号')}<input className={field} disabled={session?.published} value={ticker} maxLength={12} onChange={event => setTicker(event.target.value)}/></label>
                {!session.published && <label>{t('Token logo (optional)', '代币图标（选填）')}
                  <input className={field} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      setLogoFile(file);
                      setLogo(file ? URL.createObjectURL(file) : '');
                    }}/>
                </label>}
                {!session.published&&<p>{t('Your wallet will ask you to sign a message to authorize publishing this metadata.','钱包将要求您签署消息以授权发布元数据。')}</p>}
                <button className={primary} disabled={session.published || !owner || !name.trim() || !ticker.trim() || publication?.status === 'saving'}
                  onClick={() => void publishMetadata()}>{t('Publish token metadata','发布代币元数据')}</button>
                {!session.published&&<button className={secondary} disabled={publication?.status==='saving'} onClick={()=>void retrySavedPublication()}>{t('Retry saved publication','重试已保存的发布')}</button>}
                {session.published ? <p role="status">{t('Metadata saved','元数据已保存')}</p> : publication && <p role="status">{{
                  saving: t('Authorizing publication','正在授权发布'),
                  published: t('Metadata saved','元数据已保存'),
                  pending: t('Publication pending. You can retry without relaunching.','发布待完成。您可重试，无需重新发行。'),
                }[publication.status]} {publication.error}</p>}
              </div> :
              <button className={primary} disabled={!owner || !(session?.enabled || preparation?.owner === owner && preparation.enabled) ||
                ['wallet','submitting','checking'].includes(execution)} onClick={() => void execute()}>{t('Resume launch','继续发行')}</button>}
          </div>}
        </section>
        <aside className="min-w-0 space-y-5 border-t border-[#28302f] pt-6 md:border-t-0 md:pt-0">
          <div className="flex min-w-0 items-center gap-4">
            {/* Local image preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img className="size-16 shrink-0 rounded-2xl bg-[#1e2523] object-contain sm:size-20" alt="" src={logo}/> : <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#1e2523] text-xl font-semibold text-[#aab7b3] sm:size-20">{ticker.slice(0, 2) || "—"}</span>}
            <div className="min-w-0 break-words"><h2 className="m-0 text-[clamp(24px,2.3vw,34px)] leading-tight font-[640] tracking-[-.04em]">{name.trim() || t('Token preview','代币预览')}</h2><p className="mb-0 mt-1 text-sm text-[#aab7b3]">{ticker || 'xUDT'} / CKB</p></div>
          </div>
          {description.trim() && <p className="break-words text-sm">{description}</p>}
          {social.trim() && <p className="break-all text-xs text-[#a8b5ae]">{social}</p>}
          <p className="text-sm text-[#a8b5ae]">{t('Draft metadata for this session.','仅在本次会话中保留的元数据草稿。')}</p>
          <Amount label={t('Fixed supply','固定供应量')} value={(preparation?.terms?.supply ?? terms.supply) + ' ' + (ticker || 'xUDT')}/>
          <Amount label={t('Starting price','起始价格')} value={(preparation?.terms?.base ?? terms.base)+' CKB'}/>
          <Amount label={t('Price increase per token','每枚代币价格增量')} value={(preparation?.terms?.increment ?? terms.increment)+' CKB'}/>
        </aside>
      </div>
    </div>
  </TraderShell>;
}

function Amount({label, value}: {label: string; value?: string}) {
  return <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[#28302f] pt-3 text-sm">
    <span className="text-[#a8b5ae]">{label}</span><span className="font-medium tabular-nums">{value ?? <><span className="sr-only">—</span><span aria-hidden="true" className="inline-block h-3 w-20 rounded bg-[#28302f] align-middle"/></>}</span>
  </div>;
}
