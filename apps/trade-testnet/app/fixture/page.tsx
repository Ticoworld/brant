'use client';
import {useEffect} from 'react';
import * as market from '../../lib/market';
export default function Fixture(){useEffect(()=>{if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE==='1')(window as any).tradeFixture=market;},[]);return <main>{process.env.NEXT_PUBLIC_LOCAL_FIXTURE==='1'?'Local browser builder fixture — signing remains in the Node test harness. No keys are sent to this browser.':'Local fixture disabled'}</main>}
