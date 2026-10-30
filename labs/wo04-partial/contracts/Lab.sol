// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
interface Token {function transferFrom(address,address,uint)external returns(bool);function transfer(address,uint)external returns(bool);}
library CK {
 function hash(bytes memory data) internal view returns(bytes32 z){bytes memory h=hex"28c9bdf267e6096a3ba7ca8485ae67bb2bf894fe72f36e3cf1361d5f3af54fa5d182e6ad7f520e511f6c3e2b8c68059b08d623d6cfbce57e0c4d0a3e71ac9333";uint blocks=(data.length+127)/128;if(blocks==0)blocks=1;for(uint i;i<blocks;i++){bytes memory b=new bytes(128);uint n=data.length-i*128;if(n>128)n=128;for(uint j;j<n;j++)b[j]=data[i*128+j];bytes memory counter=new bytes(8);uint used=i*128+n;for(uint j;j<8;j++)counter[j]=bytes1(uint8(used>>(8*j)));bytes memory arg=abi.encodePacked(uint32(12),h,b,counter,bytes8(0),bytes1(i+1==blocks?0x01:0x00));(bool ok,bytes memory out)=address(9).staticcall(arg);require(ok&&out.length==64,"blake2f");h=out;}assembly{z:=mload(add(h,32))}}
 function le(bytes memory b,uint p,uint n)internal pure returns(uint z){require(p+n<=b.length,"bounds");for(uint i;i<n;i++)z|=uint(uint8(b[p+i]))<<(8*i);}
 function part(bytes memory b,uint p,uint n)internal pure returns(bytes memory o){require(p+n<=b.length,"slice");o=new bytes(n);for(uint i;i<n;i++)o[i]=b[p+i];}
 function word(bytes memory b,uint p)internal pure returns(bytes32 z){require(p+32<=b.length);assembly{z:=mload(add(add(b,32),p))}}
}
// Real inclusion verifier against an explicitly supplied checkpoint. NO CONSENSUS/FORK-CHOICE VERIFICATION.
contract CheckpointOutcome {
 bytes32 public immutable root;bytes32 public immutable sourceInput;uint public immutable sourceIndex;bytes32 public immutable context;bytes32 public immutable lockA;bytes32 public immutable lockB;
 constructor(bytes32 r,bytes32 op,uint idx,bytes32 c,bytes32 a,bytes32 b){root=r;sourceInput=op;sourceIndex=idx;context=c;lockA=a;lockB=b;}
 function hash(bytes memory b)external view returns(bytes32){return CK.hash(b);}
 function outcome(bytes memory raw,uint index,bytes32[]memory lemmas,bytes32 witnessesRoot)public view returns(bytes memory s){bytes32 leaf=CK.hash(raw);for(uint i;i<lemmas.length;i++){require(index>0,"path-length");leaf=index%2==1?CK.hash(abi.encodePacked(leaf,lemmas[i])):CK.hash(abi.encodePacked(lemmas[i],leaf));index=(index-1)/2;}require(index==0&&CK.hash(abi.encodePacked(leaf,witnessesRoot))==root,"inclusion");
 require(CK.le(raw,0,4)==raw.length,"raw-size");uint ins=CK.le(raw,16,4);require(CK.le(raw,ins,4)==1&&CK.word(raw,ins+12)==sourceInput&&CK.le(raw,ins+44,4)==sourceIndex,"source-outpoint");
 uint od=CK.le(raw,24,4);uint h=CK.le(raw,od+4,4);require(h==16,"three-data");uint p=od+CK.le(raw,od+12,4);require(CK.le(raw,p,4)==112&&p+116==raw.length,"state-size");s=CK.part(raw,p+4,112);require(CK.word(s,0)==context,"session");require(CK.le(s,64,8)<=CK.le(s,48,8)&&CK.le(s,72,8)<=CK.le(s,56,8),"totals");
 uint outs=CK.le(raw,20,4);require(CK.le(raw,outs+4,4)==16,"three-outputs");for(uint i;i<3;i++){uint o=outs+CK.le(raw,outs+4+i*4,4);uint l=CK.le(raw,o+8,4);uint end=CK.le(raw,o+12,4);require(CK.hash(CK.part(raw,o+l,end-l))==(i==1?lockB:lockA),"recipient");uint amount=CK.le(raw,o+16,8);if(i==0)require(amount>=CK.le(s,64,8)&&amount-CK.le(s,64,8)<=1000000,"amount-A");if(i==1)require(amount==CK.le(s,48,8)-CK.le(s,64,8),"amount-B");if(i==2)require(amount==20000000000,"marker");}
 }
}
contract CheckpointPayout {
 Token public immutable token;CheckpointOutcome public immutable verifier;address public immutable alice;address public immutable bob;uint public total;bool public paid;
 constructor(Token t,CheckpointOutcome v,address a,address b){token=t;verifier=v;alice=a;bob=b;}
 function fund(uint n)external{require(!paid);total+=n;require(token.transferFrom(msg.sender,address(this),n));}
 function release(bytes memory raw,uint idx,bytes32[]memory lemmas,bytes32 wr)external{require(!paid);bytes memory s=verifier.outcome(raw,idx,lemmas,wr);require(CK.le(s,56,8)==total,"funded-total");paid=true;uint a=CK.le(s,72,8);require(token.transfer(alice,a)&&token.transfer(bob,total-a));}
}
contract InventoryControl {
 Token public immutable token;address public immutable alice;address public immutable bob;bytes32 public immutable context;uint public total;uint public epoch;bool public paid;uint public serial;
 struct Pending {address owner;uint amount;}mapping(uint=>Pending)public pending;
 constructor(Token t,address a,address b,bytes32 c){token=t;alice=a;bob=b;context=c;}
 function fund(uint n)external{require(!paid&&total==0);total=n;require(token.transferFrom(msg.sender,address(this),n));}
 function depositPending(uint n)external returns(uint id){require(!paid&&n>0);id=++serial;pending[id]=Pending(msg.sender,n);require(token.transferFrom(msg.sender,address(this),n));}
 function cancel(uint id)external{Pending memory p=pending[id];require(p.owner==msg.sender&&p.amount>0);delete pending[id];require(token.transfer(p.owner,p.amount));}
 function activate(uint id,bytes memory state,bytes memory sa,bytes memory sb)external{Pending memory p=pending[id];require(!paid&&p.amount>0&&CK.word(state,0)==context&&CK.le(state,32,8)>epoch&&CK.le(state,56,8)==total+p.amount,"activate");bytes32 h=keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",sha256(abi.encode(state,id,p.owner,p.amount,address(this),block.chainid))));require(rec(h,sa)==alice&&rec(h,sb)==bob,"sig");epoch=CK.le(state,32,8);total+=p.amount;delete pending[id];}
 // Only a LOCAL authorization control, not a cross-chain finality verifier.
 function exit(bytes memory state,bytes memory sa,bytes memory sb)external{require(!paid&&state.length==112&&CK.word(state,0)==context&&CK.le(state,32,8)>=epoch&&CK.le(state,56,8)==total,"funds");bytes32 h=keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",sha256(state)));require(rec(h,sa)==alice&&rec(h,sb)==bob,"sig");paid=true;uint a=CK.le(state,72,8);require(a<=total&&token.transfer(alice,a)&&token.transfer(bob,total-a));}
 function rec(bytes32 h,bytes memory sig)public pure returns(address){require(sig.length==65);bytes32 r;bytes32 s;uint8 v;assembly{r:=mload(add(sig,32))s:=mload(add(sig,64))v:=byte(0,mload(add(sig,96)))}return ecrecover(h,v,r,s);}
}
contract AdaptorWitnessControl {
 Token public immutable token;address public immutable alice;address public immutable bob;bytes32 public immutable context;uint public total;bool public paid;
 constructor(Token t,address a,address b,bytes32 c){token=t;alice=a;bob=b;context=c;}
 function fund(uint n)external{require(!paid);total+=n;require(token.transferFrom(msg.sender,address(this),n));}
 function release(bytes memory state,bytes32 secret,bytes32 secretHash,bytes memory sa,bytes memory sb)external{require(!paid&&state.length==112&&CK.word(state,0)==context&&keccak256(abi.encodePacked(secret))==secretHash&&CK.le(state,56,8)==total,"terms");bytes32 d=sha256(abi.encode(state,secretHash,address(this),block.chainid,alice,bob));bytes32 h=keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",d));require(rec(h,sa)==alice&&rec(h,sb)==bob,"sig");paid=true;uint a=CK.le(state,72,8);require(a<=total&&token.transfer(alice,a)&&token.transfer(bob,total-a));}
 function rec(bytes32 h,bytes memory sig)internal pure returns(address){require(sig.length==65);bytes32 r;bytes32 s;uint8 v;assembly{r:=mload(add(sig,32))s:=mload(add(sig,64))v:=byte(0,mload(add(sig,96)))}return ecrecover(h,v,r,s);}
}
contract OptimisticOutcome {
 Token public immutable token;CheckpointOutcome public immutable verifier;address public immutable alice;address public immutable bob;uint public immutable bond;uint public immutable window;uint public total;bytes32 public proposal;uint public proposedA;address public proposer;uint public deadline;bool public paid;
 constructor(Token t,CheckpointOutcome v,address a,address b,uint bnd,uint win){require(bnd>0&&win>0);token=t;verifier=v;alice=a;bob=b;bond=bnd;window=win;}
 function fund(uint n)external{require(!paid&&proposer==address(0));total+=n;require(token.transferFrom(msg.sender,address(this),n));}
 function propose(bytes memory state)external payable{require(!paid&&proposer==address(0)&&msg.value>=bond&&state.length==112&&CK.word(state,0)==verifier.context()&&CK.le(state,56,8)==total&&CK.le(state,72,8)<=total,"proposal");proposer=msg.sender;proposal=sha256(state);proposedA=CK.le(state,72,8);deadline=block.timestamp+window;}
 function challenge(bytes memory raw,uint idx,bytes32[]memory lemmas,bytes32 wr)external{require(!paid&&proposer!=address(0)&&block.timestamp<deadline,"challenge-time");bytes memory s=verifier.outcome(raw,idx,lemmas,wr);require(CK.le(s,56,8)==total&&sha256(s)!=proposal,"not-false");address old=proposer;proposer=address(0);proposal=0;uint funds=address(this).balance;(bool ok,)=msg.sender.call{value:funds}("");require(ok);old;}
 function finalize()external{require(!paid&&proposer!=address(0)&&block.timestamp>=deadline,"finalize");paid=true;require(token.transfer(alice,proposedA)&&token.transfer(bob,total-proposedA));(bool ok,)=proposer.call{value:address(this).balance}("");require(ok);}
}
