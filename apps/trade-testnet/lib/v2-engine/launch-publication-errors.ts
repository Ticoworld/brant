export const publicationErrors={
  publication_signature:'Metadata authorization could not be verified.',
  publication_chain:'Launch receipts could not be verified. Retry publication.',
  publication_logo:'The token image could not be validated.',
  publication_storage:'Metadata could not be saved. Retry publication.',
} as const;
export class LaunchPublicationError extends Error{
  readonly code:keyof typeof publicationErrors;
  constructor(code:keyof typeof publicationErrors){super(publicationErrors[code]);this.code=code;}
}
export async function publicationStep<T>(code:keyof typeof publicationErrors,work:()=>T|Promise<T>):Promise<T>{
  try{return await work();}catch{throw new LaunchPublicationError(code);}
}

export const publicationRecovery={
 publication_signature:'Reconnect the original creator wallet and retry metadata authorization. Do not relaunch the token.',
 publication_chain:'Retry saved publication after the RPC service recovers. No new launch transaction is needed.',
 publication_logo:'Select a PNG, JPEG or WebP within 512 pixels and 42 KB, then normalize it before authorization.',
 publication_storage:'Retry saved publication. If it keeps failing, provide the diagnostic reference to the operator.',
} as const;
