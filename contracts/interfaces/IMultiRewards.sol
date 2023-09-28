// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface IMultiRewards {
    event RewardEnabled(uint256 duration);
    event RewardAdded(address indexed token, uint256 reward, uint256 duration);
    event Staked(address indexed user, uint256 amount, uint256 totalStakedByUser, uint256 totalStaked);
    event Withdrawn(address indexed user, uint256 amount, uint256 totalStakedByUser, uint256 totalSupply);
    event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward);

    function WHBAR() external view returns (address);

    function factory() external view returns (address);

    function stakingToken() external view returns (address);

    function rewardTokens(uint256) external view returns (address);

    function rewardData(address) external view returns (uint256, uint256, uint256, uint256);

    function hasRewardTokenAdded(address) external view returns (bool);

    function whitelistedRewardTokens(address) external view returns (bool);

    function rewards(address, address) external view returns (uint256);

    function userRewardPerTokenPaid(address, address) external view returns (uint256);

    function periodFinish() external view returns (uint256);

    function rewardsDuration() external view returns (uint256);

    function enableReward(uint256 _duration) external;

    function notifyRewardAmount(address _token, uint256 _reward, uint256 _notifyRewardAmount) external;

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;

    function pause() external;

    function unpause() external;

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken(address _rewardsToken) external view returns (uint256);

    function earned(address account, address _rewardsToken) external view returns (uint256);

    function getRewardForDuration(address _rewardsToken) external view returns (uint256);
}
