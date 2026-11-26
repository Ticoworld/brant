import {getProofStatus,prepareProof} from './service.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=getProofStatus;
export const POST=prepareProof;
