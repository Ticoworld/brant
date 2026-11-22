export type ExternalBalance = {key:string;balance:bigint;expiresAt:number};

export function invalidateExternalBalance(previous:ExternalBalance|null,key:string) {
  return previous?.key===key ? {...previous,expiresAt:0} : previous;
}

export function isExternalBalanceCurrent(balance:ExternalBalance|null,key:string,now:number) {
  return balance?.key===key && balance.expiresAt>now;
}
