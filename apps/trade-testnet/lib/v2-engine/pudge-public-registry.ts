import type {DeploymentAttempt} from './deployment-journal.ts';
import type {WizardJournal} from './wizard-journal.ts';

export const PUDGE_GATE2_GENESIS='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
export const PUDGE_GATE2_REGISTRY_ID='pudge-xudt';
export const PUDGE_GATE2_INITIALIZATION='0xc37029b982276a7c3e126a5658510fda1cd5f2963caf650b04f397a8484c7d2a';
export const PUDGE_GATE2_BUY='0x9dc5231cf75ea73c9bd0936991a0081135313fd3969467e03cf5d80a1506d823';
export const PUDGE_GATE2_SELL='0xea70571107f6e338a8a9f5eae28e691dd144281b08f10924d847a2e548b758a0';
export const PUDGE_GATE2_OWNER='0xc47b33f79bb3439876bf5be3af7d790eca8ae73779346297b5290ad73e4436ca';
export const PUDGE_GATE2_CODES={
  custody:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',
  market:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',
  custodyMarker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',
  marker:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',
  ownerLock:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53',
  xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
} as const;

export const PUDGE_GATE2_STAGE_TXS={
  code:'0x573be2deb4bd7cd28679e5f30a194b2774fd674bd4d96844898cc25dcc49897e',
  setup:'0x5828118243a8f242d4c0fa0138a09fe9732f9343c1108ca77994ea5f70d8f045',
  issuance:'0x49f5af81fb84245541ce889f208f84f6deae0f8ad6f0e5d3aa6db739ff2df833',
} as const;
export const PUDGE_GATE2_ANCHOR={txHash:'0xc034f9650ddbbd1c3a9d747ad1bff116c7c9e4dc3e8f4ac4f3d99dc2db175877',index:'0x1'};
export const PUDGE_GATE2_XUDT_DEP={outPoint:{txHash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:'0x0'},depType:'code' as const};

export const PUDGE_GATE2_ATTEMPT:DeploymentAttempt={
  version:1,
  genesis:PUDGE_GATE2_GENESIS,
  owner:PUDGE_GATE2_OWNER,
  txHash:PUDGE_GATE2_STAGE_TXS.code,
  codeHashes:[PUDGE_GATE2_CODES.custody,PUDGE_GATE2_CODES.market,PUDGE_GATE2_CODES.custodyMarker,PUDGE_GATE2_CODES.marker,PUDGE_GATE2_CODES.ownerLock],
  state:'confirmed',
  blockHash:'0xdb023a0983abeb22e3c5edde612eada7a5a4138dc6483d3fadcecb2c58b99b39',
  anchor:PUDGE_GATE2_ANCHOR,
};

export const PUDGE_GATE2_JOURNAL:WizardJournal={
  version:1,
  genesis:PUDGE_GATE2_GENESIS,
  owner:PUDGE_GATE2_OWNER,
  entries:[
    {stage:'code',txHash:PUDGE_GATE2_STAGE_TXS.code,state:'confirmed',blockHash:'0xdb023a0983abeb22e3c5edde612eada7a5a4138dc6483d3fadcecb2c58b99b39'},
    {stage:'setup',txHash:PUDGE_GATE2_STAGE_TXS.setup,state:'confirmed',blockHash:'0x6349f70d9fab998e80cf9f3c1cdf581bbea007118d1e8c6f4771e4306b247083'},
    {stage:'issuance',txHash:PUDGE_GATE2_STAGE_TXS.issuance,state:'confirmed',blockHash:'0xea16fd7dfa0c10c5e37b3c46cb0c2960e23cc7b263fb0711eb72b15232673ce5'},
    {stage:'purchase',txHash:PUDGE_GATE2_INITIALIZATION,state:'confirmed',blockHash:'0xe407b48867d65f10d9f2a5c30383e37e44c0188b7c9071390cec78a8bfc6b026'},
  ],
};
