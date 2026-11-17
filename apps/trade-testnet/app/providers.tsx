"use client";

import {Provider} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import AccountProvider from './trader/account-provider';
import ConnectorClientBridge from './trader/connector-client-bridge';
import {rovekoSignersController} from './trader/signers';

const client=ccc.ClientPublicTestnet.open({urls:['https://testnet.ckb.dev/']}).value;

export default function AppProviders({children}:{children:React.ReactNode}){
  return <Provider name="ROVEKO" defaultClient={client} clientOptions={[{name:'CKB Pudge',client}]} signersController={rovekoSignersController}>
    <AccountProvider><ConnectorClientBridge/>{children}</AccountProvider>
  </Provider>;
}
