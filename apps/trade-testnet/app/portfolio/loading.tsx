import TraderShell from '../trader/shell';
import '../trader/portfolio.css';

export default function Loading(){
  return <TraderShell wide><div role="status" aria-label="Loading portfolio" className="portfolio-overview motion-safe:animate-pulse">
    <div className="portfolio-heading h-[clamp(46px,4.5vw,69px)]">
      <div className="h-9 w-36 rounded bg-[#28302f]"/>
    </div>
    <div className="portfolio-layout" aria-hidden="true">
      <div className="portfolio-surface space-y-6">
        <div className="h-6 w-28 rounded bg-[#28302f]"/>
        <div className="portfolio-balances"><div className="h-16 rounded bg-[#202825]"/><div className="h-16 rounded bg-[#202825]"/></div>
      </div>
      <div className="portfolio-surface space-y-4">
        <div className="h-6 w-24 rounded bg-[#28302f]"/>
        <div className="h-12 rounded bg-[#202825]"/>
      </div>
    </div>
  </div></TraderShell>;
}
