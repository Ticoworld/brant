import TraderNavigation from './navigation';

export default function TraderShell({children, wide=false}:{children:React.ReactNode;wide?:boolean}){
  return <div className="min-h-screen bg-[#0b0d0e] text-[#edf1ef]"><TraderNavigation/><main className={wide ? "mx-auto w-[calc(100%-clamp(32px,3vw,64px))] max-w-[2200px]" : "mx-auto w-full max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 xl:px-8"}>{children}</main></div>;
}
