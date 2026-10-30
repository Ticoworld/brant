// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// WO04 TEST ONLY. Not USDC/USDT, no issuer/freeze/fee-on-transfer behavior.
contract TestDollar {
 string public constant name="WO04 Test Dollar"; string public constant symbol="WO04TEST"; uint8 public constant decimals=6;
 uint256 public totalSupply; mapping(address=>uint256) public balanceOf; mapping(address=>mapping(address=>uint256)) public allowance;
 event Transfer(address indexed from,address indexed to,uint256 amount);
 constructor(address a,address b){totalSupply=2000000000000;balanceOf[a]=1000000000000;balanceOf[b]=1000000000000;emit Transfer(address(0),a,balanceOf[a]);emit Transfer(address(0),b,balanceOf[b]);}
 function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
 function transfer(address to,uint256 amount) external returns(bool){_move(msg.sender,to,amount);return true;}
 function transferFrom(address from,address to,uint256 amount) external returns(bool){require(allowance[from][msg.sender]>=amount,"allowance");allowance[from][msg.sender]-=amount;_move(from,to,amount);return true;}
 function _move(address from,address to,uint256 amount) internal {require(to!=address(0)&&balanceOf[from]>=amount,"balance");balanceOf[from]-=amount;balanceOf[to]+=amount;emit Transfer(from,to,amount);}
}
