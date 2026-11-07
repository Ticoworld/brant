// Funding must never consume a data-bearing cell or a known code outpoint.
export function isPlainFundingCell(cell:{output:{type?:unknown};output_data?:string;out_point?:{tx_hash:string;index:string}},code?:{txHash:string;index:unknown}){
 if(cell.output.type||cell.output_data!=='0x'||!cell.out_point)return false;
 return !code||cell.out_point.tx_hash.toLowerCase()!==code.txHash.toLowerCase()||BigInt(cell.out_point.index)!==BigInt(String(code.index));
}
