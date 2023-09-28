// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import './MultiRewards.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IPoolsFactory.sol';
import './interfaces/ICampaignFactory.sol';

/**
 * @title Factory
 * @dev Contract responsible for creating farm campaigns
 * @author HeliSwap
 **/

contract Factory is ICampaignFactory, Owned {
    address public immutable override WHBAR;

    // Flat fee that is charged on campaign creation/extension
    uint256 public override fee;

    // Obtain pool and its tokens when creating a farm campaign
    address public override poolsFactory;

    // Additional tokens that can be used as rewards except the pool ones
    mapping(address => bool) public override rewardTokens;

    // All the campaigns being created
    address[] public override campaigns;

    // Store pool to farm campaign
    mapping(address => address) public override farmCampaigns;

    // Store all associated tokens
    mapping(address => bool) public override associatedTokens;

    constructor(address _whbar, uint256 _fee, address _poolsFactory) Owned(msg.sender) {
        require(_fee <= 1e18, 'Fee out of range');

        WHBAR = _whbar;
        fee = _fee;
        poolsFactory = _poolsFactory;
    }

    /// @notice Set a flat fee that is to be charged on campaign creation/extension
    /// @param _fee The amount of fee
    function setFee(uint256 _fee) external override onlyOwner {
        require(_fee <= 1e18, 'Fee out of range');
        fee = _fee;
        emit SetFee(_fee);
    }

    /// @notice Add/Remove tokens that are allowed to be added as a rewards for every single campaign
    /// @param whitelistedTokens The tokens that are to be allowed/disallowed
    /// @param toWhitelist Flag determining allowing/disallowing
    function setRewardTokens(address[] calldata whitelistedTokens, bool toWhitelist) external override onlyOwner {
        uint256 numberOfTokens = whitelistedTokens.length;
        for (uint256 i = 0; i < numberOfTokens; ) {
            address token = whitelistedTokens[i];
            rewardTokens[token] = toWhitelist;

            _optimisticAssociation(token);

            unchecked {
                ++i;
            }
        }

        emit SetRewardTokens(whitelistedTokens, toWhitelist);
    }

    /// @notice Deploys new instance of the {MultiRewards} contract effectively creating new campaign
    /// @param _tokenA The first token of the pool the campaign is created for
    /// @param _tokenB The second token of the pool the campaign is created for
    function deploy(address _tokenA, address _tokenB) external override {
        address stakingToken = IPoolsFactory(poolsFactory).getPair(_tokenA, _tokenB);
        require(stakingToken != address(0), 'Such a pool does not exists');
        require(farmCampaigns[stakingToken] == address(0), 'Campaign already exists for the given pool');

        MultiRewards newCampaign = new MultiRewards(stakingToken, _tokenA, _tokenB, WHBAR, owner);
        farmCampaigns[stakingToken] = address(newCampaign);
        campaigns.push(address(newCampaign));

        // Associate rewards the fee could be charged in
        _optimisticAssociation(_tokenA);
        _optimisticAssociation(_tokenB);

        emit CampaignDeployed(address(newCampaign), stakingToken);
    }

    /// @notice Withdraw fees being collected by creating/extending campaigns
    /// @param receiver The address to receive the fee being accumulated so far
    /// @param token The currency the fee to be withdrawn in
    function withdrawFee(address receiver, address token) external override onlyOwner {
        uint256 feeAmount = IERC20(token).balanceOf(address(this));
        TransferHelper.safeTransfer(token, receiver, feeAmount);
        emit WithdrawFee(token, feeAmount, receiver);
    }

    /// @notice Get the number of campaigns to be able to loop through them
    function getCampaignsLength() external view override returns (uint256 count) {
        return campaigns.length;
    }

    function _optimisticAssociation(address token) internal {
        if (!associatedTokens[token]) {
            (bool success, bytes memory result) = address(0x167).call(
                abi.encodeWithSignature('associateToken(address,address)', address(this), token)
            );
            require(success, 'HTS Precompile: CALL_EXCEPTION');
            int32 responseCode = abi.decode(result, (int32));
            // Success = 22; Non-HTS token (erc20) = 167
            require(responseCode == 22 || responseCode == 167, 'HTS Precompile: CALL_ERROR');

            associatedTokens[token] = true;
        }
    }
}
