import TraderNavigation from './navigation';

export default function TraderShell({children}:{children:React.ReactNode}){
  return <div className="min-h-screen bg-[#0b0d0e] text-[#edf1ef]"><TraderNavigation/><main className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 xl:px-8">{children}</main></div>;
}
