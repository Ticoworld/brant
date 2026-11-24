import type {ccc} from '@ckb-ccc/core';
import type {deriveMarketIdentity} from './initialization.ts';
import type {Point} from './lineage.ts';

/** Downstream identity only; constructors remain inside the distinct chain verifiers. */
export type VerifiedMarketRecord={
  genesis:string;
  marketScriptHash:string;
  routeId:string;
  creatorLockHash:string;
  tokenTypeHash:string;
  scripts:ReturnType<typeof deriveMarketIdentity>;
  dependencies:ccc.CellDepLike[];
  stages:Record<'setup'|'issuance'|'purchase',{txHash:string;blockHash:string}>;
  initial:[Point,Point,Point,Point];
  issuanceCapacityFloor:string;
  metadata:{name:string;symbol:string;description:string;metadata:string;typeHash:string;logo?:string};
};
