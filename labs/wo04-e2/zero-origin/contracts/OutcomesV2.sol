// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
interface IERC20V2 { function balanceOf(address) external view returns(uint256); }
contract OutcomesV2 {
 struct Order {bytes32 ethGenesis;bytes32 registry;bytes32 ckbGenesis;bytes32 fundingId;bytes32 ckbMaker;bytes32 ckbRefund;address asset;uint256 amount;address recipient;address maker;uint64 deadline;uint64 ckbAmount;}
 mapping(bytes32=>bytes32) public filled; // ONLY permanent terminal state, slot 0
 bool private entered; // slot 1; no open, expire, cancel, owner, upgrade or selfdestruct
 bytes32 public constant ORDER_DOMAIN=sha256("CKB-E2D-P0-ORDER-V1");
 bytes32 public immutable ETH_GENESIS;bytes32 public immutable REGISTRY;bytes32 public immutable CKB_GENESIS;
 event Filled(bytes32 indexed id,address indexed maker,address indexed recipient,address asset,uint256 amount);
 constructor(bytes32 ethGenesis,bytes32 registry,bytes32 ckbGenesis){require(ethGenesis!=0&&registry!=0&&ckbGenesis!=0);ETH_GENESIS=ethGenesis;REGISTRY=registry;CKB_GENESIS=ckbGenesis;}
 function orderId(Order calldata o) public view returns(bytes32){return sha256(abi.encode(ORDER_DOMAIN,block.chainid,address(this),o));}
 function fill(Order calldata o) external returns(bytes32 id){
  require(!entered,"reentrant");entered=true;
  require(o.ethGenesis==ETH_GENESIS&&o.registry==REGISTRY&&o.ckbGenesis==CKB_GENESIS,"chain");
  require(o.fundingId!=0&&o.ckbMaker!=0&&o.ckbRefund!=0&&o.asset.code.length>0&&o.amount>0&&o.ckbAmount>0&&o.recipient!=address(0)&&o.maker!=address(0)&&o.recipient!=o.maker,"order");
  require(msg.sender==o.maker&&block.timestamp<o.deadline,"maker/deadline");
  id=orderId(o);require(filled[id]==0,"filled");filled[id]=id;
  uint256 beforeBalance=IERC20V2(o.asset).balanceOf(o.recipient);
  (bool ok,bytes memory r)=o.asset.call(abi.encodeWithSignature("transferFrom(address,address,uint256)",o.maker,o.recipient,o.amount));
  require(ok&&(r.length==0||(r.length==32&&abi.decode(r,(bool)))),"transfer");
  uint256 afterBalance=IERC20V2(o.asset).balanceOf(o.recipient);require(afterBalance>=beforeBalance&&afterBalance-beforeBalance==o.amount,"delivery");
  entered=false;emit Filled(id,o.maker,o.recipient,o.asset,o.amount);
 }
}
// Disposable six-decimal USDC-shaped ERC-20 fixture. NOT Circle-issued USDC.
contract ControlledUSDC {
 string public constant name="Isolated Controlled USDC";string public constant symbol="cUSDC";uint8 public constant decimals=6;
 mapping(address=>uint256) public balanceOf;mapping(address=>mapping(address=>uint256)) public allowance;
 address public immutable controller;uint8 public mode;address public callbackTarget;bytes public callback;
 bool public attempted;bool public reentered;bytes public reentryResult;
 constructor(address maker){controller=msg.sender;balanceOf[maker]=1000000000000;balanceOf[address(this)]=1000000000000;}
 function approve(address s,uint256 n)external returns(bool){allowance[msg.sender][s]=n;return true;}
 function configure(uint8 m,address t,bytes calldata b)external{require(msg.sender==controller);mode=m;callbackTarget=t;callback=b;attempted=false;reentered=false;delete reentryResult;}
 function transferFrom(address from,address to,uint256 amount)external returns(bool){
  if(mode==1)return false;if(mode==2)revert("token failure");
  require(balanceOf[from]>=amount&&(from==address(this)||allowance[from][msg.sender]>=amount));
  if(from!=address(this))allowance[from][msg.sender]-=amount;
  if(mode==4){attempted=true;(reentered,reentryResult)=callbackTarget.call(callback);}
  balanceOf[from]-=amount;balanceOf[to]+=mode==3?amount-1:amount;
  if(mode==5)assembly{return(0,0)}
  if(mode==6)assembly{mstore(0,1) return(31,1)}
  return true;
 }
}
