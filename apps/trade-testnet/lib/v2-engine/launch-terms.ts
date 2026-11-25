export type LaunchTerms={supply:string;base:string;increment:string;quantity:string};
export const defaultLaunchTerms:LaunchTerms={supply:'2000',base:'10',increment:'1',quantity:'7'};
export function decimalCkb(value:string):bigint{
 if(!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value))throw Error('Enter a CKB amount with at most eight decimal places');
 const [whole,fraction='']=value.split('.');
 return BigInt(whole)*100000000n+BigInt(fraction.padEnd(8,'0'));
}
export function validateLaunchTerms(terms:LaunchTerms){
 if(!/^[1-9]\d{0,9}$/.test(terms.supply)||!/^[1-9]\d{0,9}$/.test(terms.quantity))throw Error('Supply and initial purchase must be positive whole tokens');
 const supply=BigInt(terms.supply),quantity=BigInt(terms.quantity),base=decimalCkb(terms.base),increment=decimalCkb(terms.increment);
 const reserve=base*quantity+increment*quantity*(quantity-1n)/2n;
 if(supply>0xffffffffn||quantity>=supply||base<=0n||increment<=0n||base>0xffffffffffffffffn||increment>0xffffffffffffffffn||reserve>0xffffffffffffffffn-30000000000n)throw Error('Economic parameters exceed the supported launch bounds');
 return {supply:String(supply),quantity:String(quantity),base:String(base),increment:String(increment)};
}
