import TraderShell from '../trader/shell';

export default function Loading(){
  return <TraderShell><div role="status" aria-label="Loading portfolio" className="space-y-4 motion-safe:animate-pulse">
    <div className="h-6 w-28 rounded bg-[#28302f]"/>
    <div className="h-14 border-y border-[#28302f] bg-[#111615]"/>
    <div className="h-14 border-b border-[#28302f] bg-[#111615]"/>
  </div></TraderShell>;
}
