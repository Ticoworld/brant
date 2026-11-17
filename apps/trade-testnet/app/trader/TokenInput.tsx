"use client";

export default function TokenInput({id,label,value,unit,balance,placeholder,disabled,readOnly=false,inputMode='decimal',onChange,actions}:{id:string;label:string;value:string;unit:string;balance?:string;placeholder?:string;disabled?:boolean;readOnly?:boolean;inputMode?:'decimal'|'numeric';onChange:(value:string)=>void;actions?:{label:string;value:string;disabled?:boolean}[]}){
  return <div className="rounded-[4px] border border-[#303a37] bg-[#101514] px-4 pb-3 pt-3 transition-colors focus-within:border-[#6d9583]">
    <div className="flex items-center justify-between gap-3 text-[11px]"><label htmlFor={id} className="text-[#9ba6a2]">{label}</label>{balance!==undefined&&<span className="tabular-nums text-[#8d9994]">{balance}</span>}</div>
    <div className="mt-1 flex items-center gap-3">
      <input id={id} value={value} onChange={event=>onChange(event.target.value)} inputMode={inputMode} placeholder={placeholder||'0'} disabled={disabled} readOnly={readOnly} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[28px] font-medium leading-10 tabular-nums text-[#f1f5f3] outline-none placeholder:text-[#424c48] focus-visible:outline-none disabled:opacity-60"/>
      <span className="inline-flex shrink-0 items-center gap-2 border-l border-[#303a37] pl-3 text-sm font-semibold text-[#dce5e1]"><i aria-hidden="true" className={`size-2 rounded-full ${unit==='CKB'?'bg-[#5ed4df]':'bg-[#72dfb0]'}`}/>{unit}</span>
    </div>
    {actions?.length? <div className="mt-2 flex flex-wrap gap-1.5">{actions.map(action=><button key={action.label} type="button" disabled={disabled||action.disabled} onClick={()=>onChange(action.value)} className="min-h-7 rounded-[3px] border border-[#38433f] px-2 text-[10px] font-medium text-[#b9c4c0] hover:border-[#5b7167] hover:bg-[#1a2420]">{action.label}</button>)}</div>:null}
  </div>;
}
