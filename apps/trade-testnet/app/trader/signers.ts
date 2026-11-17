import {SignersController} from '@ckb-ccc/connector-react';

const refreshSigners=SignersController.prototype.refresh;
SignersController.prototype.refresh=async function(...args:Parameters<typeof refreshSigners>){
  const [client,onUpdate]=args;
  if(!client||typeof client.addressPrefix!=='string'){onUpdate([]);return;}
  await refreshSigners.apply(this,args);
};

class RovekoSignersController extends SignersController{
  override async refresh(...args:Parameters<SignersController['refresh']>){
    const [client,onUpdate]=args;
    if(!client||typeof client.addressPrefix!=='string'){onUpdate([]);return;}
    await super.refresh(...args);
  }
}

export const rovekoSignersController=new RovekoSignersController();
