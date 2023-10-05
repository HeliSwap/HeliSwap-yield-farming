// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import './Owned.sol';

import './interfaces/IWHBAR.sol';
import './interfaces/IMultiRewards.sol';
import './interfaces/ICampaignFactory.sol';
import './libraries/TransferHelper.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

/**
 * @title MultiRewards
 * @dev Contract responsible for distributing farm rewards among the stakers
 * @author HeliSwap
 **/

contract MultiRewards is IMultiRewards, Owned, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    address public override WHBAR;

    // The factory address needed to obtain fee and additional reward tokens
    address public override factory;

    struct Reward {
        uint256 rewardRate;
        uint256 periodFinish;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    // Pool LP token that is staked for receiving rewards
    address public override stakingToken;

    // The reward tokens already in usage for the campaign
    address[] public override rewardTokens;

    // The data per reward token needed to track accumulation
    mapping(address => Reward) public override rewardData;

    // Validate if a token is to be added for the first time in the campaign
    mapping(address => bool) public override hasRewardTokenAdded;

    // Tokens that are allowed to be used as rewards
    mapping(address => bool) public override whitelistedRewardTokens;

    // user -> reward token -> amount
    mapping(address => mapping(address => uint256)) public override rewards;
    mapping(address => mapping(address => uint256)) public override userRewardPerTokenPaid;

    // End date of the current active campaign
    uint256 public override periodFinish;

    // Duration of the current active campaign
    uint256 public override rewardsDuration;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /// @notice Update global rewards trackers, user rewards accumulated so far and
    /// user tracker so the next time he updates his position, only the new
    /// rewards to be accumulated
    modifier updateReward(address account) {
        for (uint256 i; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            rewardData[token].rewardPerTokenStored = rewardPerToken(token);
            rewardData[token].lastUpdateTime = lastTimeRewardApplicable(rewardData[token].periodFinish);
            if (account != address(0)) {
                rewards[account][token] = earned(account, token);
                userRewardPerTokenPaid[account][token] = rewardData[token].rewardPerTokenStored;
            }
        }
        _;
    }

    constructor(address _stakingToken, address _tokenA, address _tokenB, address _whbar, address _owner) Owned(_owner) {
        stakingToken = _stakingToken;
        WHBAR = _whbar;
        whitelistedRewardTokens[_tokenA] = true;
        whitelistedRewardTokens[_tokenB] = true;

        factory = msg.sender;
    }

    /// @notice Pre-configure a campaign
    /// @param _duration The duration of the campaign
    /// dev: That function can be front-runned. So when one calls after that notifyReward
    /// dev: we advice to obtain the duration before that to be sure it is
    /// dev: the expected one or to adjust the desired rewards amount
    function enableReward(uint256 _duration) external override nonReentrant {
        require(block.timestamp > periodFinish, 'Reward period still active');
        require(_duration > 0 && _duration < 13, 'Reward duration out of range');

        rewardsDuration = _duration * 30 days;
        emit RewardEnabled(rewardsDuration);
    }

    /// @notice Run/extend a campaign
    /// @param _token The token the amount is to be distributed in
    /// @param _reward The amount that is to be distributed by the campaign
    /// @param _duration Needed as one can front-run the enableReward and change the duration
    function notifyRewardAmount(
        address _token,
        uint256 _reward,
        uint256 _duration
    ) external override nonReentrant updateReward(address(0)) {
        require(rewardsDuration > 0, 'Campaign not configured yet');
        require(_duration * 30 days == rewardsDuration, 'APR estimated could be wrong');
        require(
            whitelistedRewardTokens[_token] || ICampaignFactory(factory).rewardTokens(_token),
            'Not whitelisted reward token'
        );

        // If the token is added for the first time as a reward
        if (!hasRewardTokenAdded[_token]) {
            rewardTokens.push(_token);
            hasRewardTokenAdded[_token] = true;
            _optimisticAssociation(_token);
        }

        // Handle the transfer of reward tokens via `transferFrom` to reduce the number
        // of transactions required and ensure correctness of the reward amount
        TransferHelper.safeTransferFrom(_token, msg.sender, address(this), _reward);

        // Charge fee
        uint256 fee = (ICampaignFactory(factory).fee() * _reward) / 1e18;
        TransferHelper.safeTransfer(_token, factory, fee);
        _reward -= fee;

        if (block.timestamp >= periodFinish) {
            periodFinish = block.timestamp.add(rewardsDuration);
        }

        uint256 remaining = periodFinish.sub(block.timestamp);
        if (block.timestamp >= rewardData[_token].periodFinish) {
            rewardData[_token].rewardRate = _reward.div(remaining);
            rewardData[_token].periodFinish = periodFinish;
        } else {
            uint256 leftover = remaining.mul(rewardData[_token].rewardRate);
            rewardData[_token].rewardRate = _reward.add(leftover).div(remaining);
        }

        require(rewardData[_token].rewardRate > 0, 'Too little rewards for the duration');

        rewardData[_token].lastUpdateTime = block.timestamp;

        emit RewardAdded(_token, _reward, rewardsDuration);
    }

    /// @notice Stake Pool LP tokens for receiving rewards
    /// @param amount The amount to be staked
    function stake(uint256 amount) external override nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, 'Cannot stake 0');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        TransferHelper.safeTransferFrom(stakingToken, msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, _balances[msg.sender], _totalSupply);
    }

    /// @notice Withdraw staked Pool LP tokens
    /// @param amount The amount to be withdrawn
    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) {
        require(amount > 0, 'Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        TransferHelper.safeTransfer(stakingToken, msg.sender, amount);

        emit Withdrawn(msg.sender, amount, _balances[msg.sender], _totalSupply);
    }

    /// @notice Claim the latest rewards that have been accumulated so far
    function getReward() public override nonReentrant updateReward(msg.sender) {
        for (uint256 i; i < rewardTokens.length; i++) {
            address _rewardsToken = rewardTokens[i];
            uint256 reward = rewards[msg.sender][_rewardsToken];
            if (reward > 0) {
                rewards[msg.sender][_rewardsToken] = 0;
                if (_rewardsToken == WHBAR) {
                    IWHBAR(WHBAR).withdraw(reward);
                    TransferHelper.safeTransferNative(msg.sender, reward);
                } else {
                    TransferHelper.safeTransfer(_rewardsToken, msg.sender, reward);
                }
                emit RewardPaid(msg.sender, _rewardsToken, reward);
            }
        }
    }

    /// @notice Exit the campaign and claim all the rewards
    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /// @notice Pause the campaign in case of problems
    function pause() external override onlyOwner {
        _pause();
    }

    /// @notice Unpause the campaign
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @notice Return the number of staked tokens
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /// @notice Return the balance of rewards
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /// @notice Return when the rewards have been accumulated lastly
    function lastTimeRewardApplicable(uint256 tokenPeriodFinish) public view override returns (uint256) {
        return block.timestamp < tokenPeriodFinish ? block.timestamp : tokenPeriodFinish;
    }

    /// @notice Calculate how much rewards have been accumulated for a given reward token
    function rewardPerToken(address _rewardsToken) public view override returns (uint256) {
        if (_totalSupply == 0) {
            return rewardData[_rewardsToken].rewardPerTokenStored;
        }
        return
            rewardData[_rewardsToken].rewardPerTokenStored.add(
                lastTimeRewardApplicable(rewardData[_rewardsToken].periodFinish)
                    .sub(rewardData[_rewardsToken].lastUpdateTime)
                    .mul(rewardData[_rewardsToken].rewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
            );
    }

    /// @notice Calculate how much an account has earned so far
    function earned(address account, address _rewardsToken) public view override returns (uint256) {
        return
            _balances[account]
                .mul(rewardPerToken(_rewardsToken).sub(userRewardPerTokenPaid[account][_rewardsToken]))
                .div(1e18)
                .add(rewards[account][_rewardsToken]);
    }

    /// @notice Get total APR for a given token
    function getRewardForDuration(address _rewardsToken) external view override returns (uint256) {
        return rewardData[_rewardsToken].rewardRate.mul(rewardsDuration);
    }

    function _optimisticAssociation(address token) internal {
        (bool success, bytes memory result) = address(0x167).call(
            abi.encodeWithSignature('associateToken(address,address)', address(this), token)
        );
        require(success, 'HTS Precompile: CALL_EXCEPTION');
        int32 responseCode = abi.decode(result, (int32));
        // Success = 22; Non-HTS token (erc20) = 167
        require(responseCode == 22 || responseCode == 167, 'HTS Precompile: CALL_ERROR');
    }

    /// @dev Fallback function in case of WHBAR rewards. See {@getRewards}
    receive() external payable {}
}
