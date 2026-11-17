import {MarketScreen} from '../../trader/screens';

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <MarketScreen id={id}/>;
}
