// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// EXPERIMENT ONLY. Independent adjudicators, not a production channel protocol.
interface Token { function transferFrom(address,address,uint256) external returns(bool); function transfer(address,uint256) external returns(bool); }
contract PortfolioLeg {
 Token public immutable token; address public immutable alice; address public immutable bob;
 bytes32 public immutable context; uint public immutable leg; uint public immutable window; bool public immutable restart;
 uint public constant total=100; bool public funded; bool public closed; bool public disputing;
 uint public version; uint public x; uint public y; uint public deadline;
 event Registered(uint version,uint x,uint y,uint deadline); event Closed(uint version,uint x,uint y);
 constructor(Token t,address a,address b,bytes32 c,uint l,uint w,bool r){require(a!=b&&a!=address(0)&&b!=address(0)&&l<2&&w>0);token=t;alice=a;bob=b;context=c;leg=l;window=w;restart=r;}
 function fund() external {require(!funded);funded=true;require(token.transferFrom(msg.sender,address(this),total));}
 function stateHash(uint v,uint xx,uint yy) public view returns(bytes32){return keccak256(abi.encode(context,v,xx,yy));}
 function recover(bytes32 h,bytes calldata sig) public pure returns(address){require(sig.length==65,"sig-size");bytes32 r;bytes32 s;uint8 v;assembly {r:=calldataload(sig.offset) s:=calldataload(add(sig.offset,32)) v:=byte(0,calldataload(add(sig.offset,64)))}require(uint(s)<=0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0,"high-s");return ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",h)),v,r,s);}
 function register(uint v,uint xx,uint yy,bytes calldata sa,bytes calldata sb) external {require(funded&&!closed&&xx<=total&&yy<=total,"state");require(!disputing||block.timestamp<deadline,"elapsed");require(!disputing||v>version,"version");bytes32 h=stateHash(v,xx,yy);require(recover(h,sa)==alice&&recover(h,sb)==bob,"signatures");if(!disputing||restart)deadline=block.timestamp+window;disputing=true;version=v;x=xx;y=yy;emit Registered(v,xx,yy,deadline);}
 function close() external {require(funded&&disputing&&!closed&&block.timestamp>=deadline,"close");closed=true;uint a=leg==0?x:y;require(token.transfer(alice,a)&&token.transfer(bob,total-a));emit Closed(version,x,y);}
}
// TRUSTED ATTESTOR CONTROL. Attestation is not a verified CKB consensus proof.
contract SealedFollower {
 Token public immutable token; address public immutable alice; address public immutable bob; address public immutable attestor;
 bytes32 public immutable context; bool public funded; bool public closed; uint public version; uint public x; uint public y;
 constructor(Token t,address a,address b,address w,bytes32 c){token=t;alice=a;bob=b;attestor=w;context=c;}
 function fund() external {require(!funded);funded=true;require(token.transferFrom(msg.sender,address(this),100));}
 function outcomeHash(uint v,uint xx,uint yy) public view returns(bytes32){return keccak256(abi.encode("WO03-SEALED",block.chainid,address(this),context,v,xx,yy));}
 function release(uint v,uint xx,uint yy,bytes calldata sig) external {require(funded&&!closed&&xx<=100&&yy<=100&&sig.length==65,"state");bytes32 r;bytes32 s;uint8 vv;assembly {r:=calldataload(sig.offset) s:=calldataload(add(sig.offset,32)) vv:=byte(0,calldataload(add(sig.offset,64)))}require(uint(s)<=0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0,"high-s");bytes32 h=outcomeHash(v,xx,yy);require(ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",h)),vv,r,s)==attestor,"attestor");closed=true;version=v;x=xx;y=yy;require(token.transfer(alice,yy)&&token.transfer(bob,100-yy));}
}
