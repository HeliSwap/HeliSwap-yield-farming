// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICampaignFactory {
    event SetFee(uint256 fee);
    event WithdrawFee(address token, uint256 feeAmount, address receiver);
    event SetRewardTokens(address[] whitelistedTokens, bool toWhitelist);
    event CampaignDeployed(address campaign, address stakingToken);

    function WHBAR() external view returns (address);

    function fee() external view returns (uint256);

    function poolsFactory() external view returns (address);

    function campaigns(uint256) external view returns (address);

    function rewardTokens(address) external view returns (bool);

    function farmCampaigns(address) external view returns (address);

    function associatedTokens(address) external view returns (bool);

    function setFee(uint256 _fee) external;

    function setRewardTokens(address[] calldata whitelistedTokens, bool toWhitelist) external;

    function deploy(address _tokenA, address _tokenB) external;

    function withdrawFee(address receiver, address token) external;

    function getCampaignsLength() external view returns (uint256 count);
}
