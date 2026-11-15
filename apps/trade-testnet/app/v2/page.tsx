import dynamic from 'next/dynamic';
const Market = dynamic(() => import('./screen'));
export default function Page() { return <Market />; }
