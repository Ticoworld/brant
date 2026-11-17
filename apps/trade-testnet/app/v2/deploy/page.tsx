import dynamic from 'next/dynamic';
const Review=dynamic(()=>import('./review'));
export default function Page(){return <Review/>;}
