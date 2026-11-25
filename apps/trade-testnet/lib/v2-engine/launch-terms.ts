export type LaunchTerms={supply:string;base:string;increment:string;quantity:string};
export const defaultLaunchTerms:LaunchTerms={supply:'2000',base:'10',increment:'1',quantity:'7'};
export function decimalCkb(value:string):bigint{
 if(!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value))throw Error('Enter a CKB amount with at most eight decimal places');
 const [whole,fraction='']=value.split('.');
 return BigInt(whole)*100000000n+BigInt(fraction.padEnd(8,'0'));
}
export function launchBudgetTerms(value:unknown){
 if(typeof value!=='string'||value.length>30)throw Error('Enter an initial purchase amount in CKB');
 const budget=decimalCkb(value);
 const {supply,base,increment}=defaultLaunchTerms;
 const limit=BigInt(supply), start=decimalCkb(base), step=decimalCkb(increment);
 if(budget<start)throw Error('Initial purchase requires at least '+base+' CKB');
 const cost=(quantity:bigint)=>start*quantity+step*quantity*(quantity-1n)/2n;
 let low=1n,high=limit-1n;
 while(low<high){const mid=(low+high+1n)/2n;if(cost(mid)<=budget)low=mid;else high=mid-1n;}
 return {supply:limit,base:start,increment:step,quantity:low,cost:cost(low)};
}
export function validateLaunchTerms(terms:LaunchTerms){
 if(!/^[1-9]\d{0,9}$/.test(terms.supply)||!/^[1-9]\d{0,9}$/.test(terms.quantity))throw Error('Supply and initial purchase must be positive whole tokens');
 const supply=BigInt(terms.supply),quantity=BigInt(terms.quantity),base=decimalCkb(terms.base),increment=decimalCkb(terms.increment);
 const reserve=base*quantity+increment*quantity*(quantity-1n)/2n;
 if(supply>0xffffffffn||quantity>=supply||base<=0n||increment<=0n||base>0xffffffffffffffffn||increment>0xffffffffffffffffn||reserve>0xffffffffffffffffn-30000000000n)throw Error('Economic parameters exceed the supported launch bounds');
 return {supply:String(supply),quantity:String(quantity),base:String(base),increment:String(increment)};
}
