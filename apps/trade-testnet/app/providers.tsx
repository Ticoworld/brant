"use client";

import {Provider} from '@ckb-ccc/connector-react';
import {Toaster} from 'sonner';
import {ccc} from '@ckb-ccc/core';
import AccountProvider from './trader/account-provider';
import ConnectorClientBridge from './trader/connector-client-bridge';
import {rovekoSignersController} from './trader/signers';

const client=ccc.ClientPublicTestnet.open({urls:['https://testnet.ckb.dev/']}).value;

export default function AppProviders({children}:{children:React.ReactNode}){
  return <Provider name="ROVEKO" defaultClient={client} clientOptions={[{name:'CKB Pudge',client}]} signersController={rovekoSignersController}>
    <AccountProvider><ConnectorClientBridge/>{children}<Toaster theme="dark" position="bottom-right" offset={20} mobileOffset={{bottom:16,left:12,right:12}} toastOptions={{style:{background:'#141a19',borderColor:'#39423f',color:'#edf1ef'}}}/></AccountProvider>
  </Provider>;
}
