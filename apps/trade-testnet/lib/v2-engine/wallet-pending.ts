/** Wallet funding is shared across markets even though recovery journals are not. */
export function assertWalletFundingAvailable(storage:Pick<Storage,'length'|'key'|'getItem'>,genesis:string,owner:string){
  if(storage.length>1024)throw Error('Wallet recovery storage requires review');
  const prefixes=['roveko-pudge-trade-v1:','roveko-pudge-withdrawal-v1:'].map(prefix=>prefix+genesis.toLowerCase()+':'+owner.toLowerCase());
  for(let index=0;index<storage.length;index++){
    const key=storage.key(index);if(!key)continue;
    for(const prefix of prefixes){
      const suffix=key.slice(prefix.length);
      if(key.startsWith(prefix)&&(suffix===''||/^:0x[0-9a-f]{64}$/.test(suffix))&&storage.getItem(key)!==null)throw Error('A wallet transaction requires reconciliation before spending funding');
    }
  }
}
