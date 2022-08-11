pragma solidity 0.5.17;

import './MultiRewards.sol';

contract MultiRewardsFactory is Owned {
  MultiRewards[] public multiRewardsArray;

  constructor() public Owned(msg.sender) {}

  event MultirewardsContractDeployed(address multiRewardsCont);

  function deploy(address _owner, address _stakingToken) external onlyOwner {
    MultiRewards newMultiRewardsContract = new MultiRewards(_owner, _stakingToken);
    multiRewardsArray.push(newMultiRewardsContract);

    emit MultirewardsContractDeployed(address(newMultiRewardsContract));
  }

  function getMultirewardsContractsCount() public view returns (uint256 count) {
    return multiRewardsArray.length;
  }
}
