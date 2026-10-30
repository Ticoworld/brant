// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Controlled token, not USDC/USDT. Failure switch is only a defensive test fixture.
contract TestToken {
 string public constant name="E1 Controlled Test Token";string public constant symbol="E1TEST";uint8 public constant decimals=6;uint public constant totalSupply=2000000000000;
 mapping(address=>uint)public balanceOf;mapping(address=>mapping(address=>uint))public allowance;bool public fail;address public immutable owner;
 event Transfer(address indexed from,address indexed to,uint amount);event Approval(address indexed owner,address indexed spender,uint amount);
 constructor(address a,address b){owner=a;balanceOf[a]=1000000000000;balanceOf[b]=1000000000000;}
 function failure(bool v)external{require(msg.sender==owner);fail=v;}
 function approve(address s,uint a)external returns(bool){allowance[msg.sender][s]=a;emit Approval(msg.sender,s,a);return true;}
 function transfer(address to,uint n)external returns(bool){require(!fail&&to!=address(0)&&balanceOf[msg.sender]>=n);balanceOf[msg.sender]-=n;balanceOf[to]+=n;emit Transfer(msg.sender,to,n);return true;}
 function transferFrom(address a,address b,uint n)external returns(bool){require(!fail,"controlled-failure");require(b!=address(0)&&allowance[a][msg.sender]>=n&&balanceOf[a]>=n);allowance[a][msg.sender]-=n;balanceOf[a]-=n;balanceOf[b]+=n;emit Transfer(a,b,n);return true;}
}
contract Outcomes {
 struct Trade {address token;address recipient;address maker;uint amount;uint deadline;bytes32 terms;uint8 status;}
 mapping(bytes32=>Trade)public trades; // slot0
 mapping(bytes32=>bytes32)public roots; // slot1
 mapping(bytes32=>bytes32)public leaves; // slot2
 bytes32 public immutable domain;
 event Opened(bytes32 indexed id,bytes32 terms);event Terminal(bytes32 indexed id,uint8 status,bytes32 leaf);event Root(bytes32 indexed batch,bytes32 root);
 constructor(bytes32 d){domain=d;}
 function open(bytes32 id,address token,address recipient,address maker,uint amount,uint deadline,bytes32 ckbGenesis,uint ckbAmount,bytes32 ckbMaker,bytes32 ckbRefund,bytes32 ckbReservation)external {
 require(msg.sender==recipient&&trades[id].status==0&&amount>0&&deadline>block.timestamp&&maker!=address(0));
 bytes32 terms=sha256(abi.encode(domain,id,block.chainid,address(this),token,recipient,maker,amount,deadline,ckbGenesis,ckbAmount,ckbMaker,ckbRefund,ckbReservation));trades[id]=Trade(token,recipient,maker,amount,deadline,terms,1);emit Opened(id,terms);
 }
 function fill(bytes32 id,address token,address recipient,uint amount)external{Trade storage t=trades[id];require(t.status==1&&block.timestamp<t.deadline,"not-open");require(msg.sender==t.maker&&token==t.token&&recipient==t.recipient&&amount==t.amount,"terms");t.status=4;uint beforeBal=TestToken(t.token).balanceOf(t.recipient);require(TestToken(t.token).transferFrom(t.maker,t.recipient,t.amount),"transfer");require(TestToken(t.token).balanceOf(t.recipient)-beforeBal==t.amount,"exact-delivery");t.status=2;_record(id,t);}
 function expire(bytes32 id)external{Trade storage t=trades[id];require(t.status==1&&block.timestamp>=t.deadline,"not-expirable");t.status=3;_record(id,t);}
 function _record(bytes32 id,Trade storage t)internal{bytes32 l=sha256(abi.encodePacked(domain,id,t.terms,t.status));leaves[id]=l;emit Terminal(id,t.status,l);}
 function commit(bytes32 batch,bytes32[]memory ids)external{require(roots[batch]==0&&(ids.length==1||ids.length==2));bytes32 a=leaves[ids[0]];require(a!=0);bytes32 r=a;if(ids.length==2){require(ids[0]!=ids[1]&&leaves[ids[1]]!=0);r=sha256(abi.encodePacked(a,leaves[ids[1]]));}roots[batch]=r;emit Root(batch,r);}
}
