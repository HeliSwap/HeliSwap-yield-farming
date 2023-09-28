import { expect } from 'chai';
import { ethers } from 'hardhat';
import { smock } from '@defi-wonderland/smock';

describe('MultiRewards', function () {
    this.timeout(60_000);

    let signers: any;
    let factory: any;
    let whbar: any;
    let campaign: any;
    let pool: any;
    let poolsFactory: any;
    let tokenA: any;
    let tokenB: any;

    const FEE = ethers.utils.parseEther('0.1');
    const FEE_DIVIDER = ethers.utils.parseEther('1');

    beforeEach(async () => {
        signers = await ethers.getSigners();
        const optimisticContract = await smock.fake([
            {
                'inputs': [
                    {
                        'internalType': 'address',
                        'name': 'associatee',
                        'type': 'address'
                    },
                    {
                        'internalType': 'address',
                        'name': 'token',
                        'type': 'address'
                    }
                ],
                'name': 'associateToken',
                'outputs': [
                    {
                        'internalType': 'uint256',
                        'name': '',
                        'type': 'uint256'
                    }
                ],
                'stateMutability': 'nonpayable',
                'type': 'function'
            }
        ],
            {
                address: '0x0000000000000000000000000000000000000167',
            });

        // // @ts-ignore
        optimisticContract.associateToken.returns(167);

        const whbarFactory = await ethers.getContractFactory('MockWHBAR');
        whbar = await (await whbarFactory.deploy()).deployed();

        const tokenFactory = await ethers.getContractFactory('MockToken');
        pool = await (await tokenFactory.deploy()).deployed();
        tokenA = await (await tokenFactory.deploy()).deployed();
        tokenB = await (await tokenFactory.deploy()).deployed();

        poolsFactory = await smock.fake([
            {
                'inputs': [
                    {
                        'internalType': 'address',
                        'name': '',
                        'type': 'address'
                    },
                    {
                        'internalType': 'address',
                        'name': '',
                        'type': 'address'
                    }
                ],
                'name': 'getPair',
                'outputs': [
                    {
                        'internalType': 'address',
                        'name': '',
                        'type': 'address'
                    }
                ],
                'stateMutability': 'view',
                'type': 'function'
            },
        ]);

        // @ts-ignore
        poolsFactory.getPair.returns(pool.address);

        const Factory = await ethers.getContractFactory('Factory');
        factory = await (await Factory.deploy(
            whbar.address, FEE, poolsFactory.address
        )).deployed();

        await factory.deploy(tokenA.address, tokenB.address);

        campaign = await ethers.getContractAt('MultiRewards', await factory.campaigns(0));
    });

    describe('Deployment', () => {
        it('Should be deployed correctly', async () => {
            expect(await campaign.stakingToken()).to.be.equal(pool.address);
            expect(await campaign.WHBAR()).to.be.equal(whbar.address);
            expect(await campaign.whitelistedRewardTokens(tokenA.address)).to.be.equal(true);
            expect(await campaign.whitelistedRewardTokens(tokenB.address)).to.be.equal(true);
            expect(await campaign.factory()).to.be.equal(factory.address);
        });
    });

    describe('Enable campaign', () => {
        it('Should set campaign duration', async () => {
            await campaign.enableReward(2);
            expect(await campaign.rewardsDuration()).to.be.equal(2 * 30 * 24 * 60 * 60);
        });

        it('Should revert in case the campaign is running', async () => {
            await campaign.enableReward(2);

            await tokenA.mint(signers[0].address, ethers.utils.parseEther('1'));
            await tokenA.approve(campaign.address, ethers.utils.parseEther('1'));

            await campaign.notifyRewardAmount(tokenA.address, ethers.utils.parseEther('1'), 2);

            await expect(campaign.enableReward(2)).to.be.revertedWith('Reward period still active');
        });

        it('Should revert in case the duration is zero or more than a year', async () => {
            await expect(campaign.enableReward(0)).to.be.revertedWith('Reward duration out of range');
            await expect(campaign.enableReward(13)).to.be.revertedWith('Reward duration out of range');
        });
    });

    describe('Notify campaign', () => {
        it('Should run a campaign', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);

            await campaign.notifyRewardAmount(tokenA.address, reward, 2);

            const blockStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const data = await campaign.rewardData(tokenA.address);
            expect(data[0]).to.be.equal(realRewards.div(2 * 30 * 24 * 60 * 60));
            expect(data[1]).to.be.equal(await campaign.periodFinish());
            expect(data[2]).to.be.equal(blockStamp);
            expect(data[3]).to.be.equal(0);

            expect(await campaign.rewardTokens(0)).to.be.equal(tokenA.address);
            expect(await campaign.hasRewardTokenAdded(tokenA.address)).to.be.equal(true);

            expect(await tokenA.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenA.balanceOf(campaign.address)).to.be.equal(realRewards);
        });

        it('Should extend a campaign', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);
            await campaign.notifyRewardAmount(tokenA.address, reward, 2);

            await ethers.provider.send('evm_increaseTime', [60 * 24 * 60 * 60]); // skip 2 months
            await ethers.provider.send('evm_mine', []);

            await campaign.enableReward(2);

            const reward2 = ethers.utils.parseEther('15');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, ethers.utils.parseEther('15'));
            await tokenA.approve(campaign.address, ethers.utils.parseEther('15'));
            await campaign.notifyRewardAmount(tokenA.address, ethers.utils.parseEther('15'), 2);

            const blockStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const data = await campaign.rewardData(tokenA.address);
            expect(data[0]).to.be.equal(realRewards2.div(60 * 24 * 60 * 60));
            expect(data[1]).to.be.equal(await campaign.periodFinish());
            expect(data[2]).to.be.equal(blockStamp);
            expect(data[3]).to.be.equal(0);

            expect(await campaign.rewardTokens(0)).to.be.equal(tokenA.address);
            expect(await campaign.hasRewardTokenAdded(tokenA.address)).to.be.equal(true);

            expect(await tokenA.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenA.balanceOf(factory.address)).to.be.equal(fee.add(fee2));

            expect(await tokenA.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenA.balanceOf(campaign.address)).to.be.equal(realRewards.add(realRewards2));
        });

        it('Should add multiple reward tokens for a single campaign', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);
            await campaign.notifyRewardAmount(tokenA.address, reward, 2);

            let blockStamp = (await ethers.provider.getBlock('latest')).timestamp;
            let data = await campaign.rewardData(tokenA.address);
            expect(data[0]).to.be.equal(realRewards.div(2 * 30 * 24 * 60 * 60));
            expect(data[1]).to.be.equal(await campaign.periodFinish());
            expect(data[2]).to.be.equal(blockStamp);
            expect(data[3]).to.be.equal(0);

            expect(await campaign.rewardTokens(0)).to.be.equal(tokenA.address);
            expect(await campaign.hasRewardTokenAdded(tokenA.address)).to.be.equal(true);

            expect(await tokenA.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenA.balanceOf(campaign.address)).to.be.equal(realRewards);

            const reward2 = ethers.utils.parseEther('1');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenB.mint(signers[0].address, reward2);
            await tokenB.approve(campaign.address, reward2);
            await campaign.notifyRewardAmount(tokenB.address, reward2, 2);

            blockStamp = (await ethers.provider.getBlock('latest')).timestamp;
            data = await campaign.rewardData(tokenB.address);
            expect(data[0]).to.be.equal(
                realRewards2
                    .div(
                        await campaign.periodFinish() - blockStamp
                    )
            );
            expect(data[1]).to.be.equal(await campaign.periodFinish());
            expect(data[2]).to.be.equal(blockStamp);
            expect(data[3]).to.be.equal(0);

            expect(await campaign.rewardTokens(1)).to.be.equal(tokenB.address);
            expect(await campaign.hasRewardTokenAdded(tokenB.address)).to.be.equal(true);

            expect(await tokenB.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenB.balanceOf(campaign.address)).to.be.equal(realRewards2);

        });

        it('Should add a few times rewards for a given token in single campaign run', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);
            await campaign.notifyRewardAmount(tokenA.address, reward, 2);

            const rewardRate = (await campaign.rewardData(tokenA.address))[0];
            await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            const reward2 = ethers.utils.parseEther('1');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, reward2);
            await tokenA.approve(campaign.address, reward2);
            await campaign.notifyRewardAmount(tokenA.address, reward2, 2);

            const blockStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const data = await campaign.rewardData(tokenA.address);
            const leftOver = rewardRate.mul(await campaign.periodFinish() - blockStamp);
            expect(data[0]).to.be.equal(
                leftOver.add(realRewards2).div(await campaign.periodFinish() - blockStamp)
            );
            expect(data[1]).to.be.equal(await campaign.periodFinish());
            expect(data[2]).to.be.equal(blockStamp);
            expect(data[3]).to.be.equal(0);

            expect(await campaign.rewardTokens(0)).to.be.equal(tokenA.address);
            expect(await campaign.hasRewardTokenAdded(tokenA.address)).to.be.equal(true);

            expect(await tokenA.balanceOf(signers[2].address)).to.be.equal(0);
            expect(await tokenA.balanceOf(campaign.address)).to.be.equal(realRewards.add(realRewards2));
        });

        it('Should revert if the campaign has not been configured yet', async () => {
            await expect(
                campaign.notifyRewardAmount(ethers.constants.AddressZero, ethers.utils.parseEther('1'), 2)
            ).to.be.revertedWith('Campaign not configured yet');
        });

        it('Should revert if the rewards token is not a whitelisted one', async () => {
            await campaign.enableReward(2);

            await expect(
                campaign.notifyRewardAmount(ethers.constants.AddressZero, ethers.utils.parseEther('1'), 2)
            ).to.be.revertedWith('Not whitelisted reward token');
        });

        it('Should revert if the amount of rewards is too little making the rate 0', async () => {
            await campaign.enableReward(2);

            await tokenA.mint(signers[0].address, ethers.utils.parseEther('1'));
            await tokenA.approve(campaign.address, ethers.utils.parseEther('1'));

            await expect(
                campaign.notifyRewardAmount(tokenA.address, 10, 2)
            ).to.be.revertedWith('Too little rewards for the duration');
        });

        it('Should revert if APR is not correctly estimated', async () => {
            await campaign.enableReward(1);

            await tokenA.mint(signers[0].address, ethers.utils.parseEther('1'));
            await tokenA.approve(campaign.address, ethers.utils.parseEther('1'));

            await expect(
                campaign.notifyRewardAmount(tokenA.address, ethers.utils.parseEther('1'), 2)
            ).to.be.revertedWith('APR estimated could be wrong');
        });
    });

    describe('Stake', () => {
        it('Should stake successfully', async () => {
            const stake = ethers.utils.parseEther('1');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.stake(stake);

            expect(await pool.balanceOf(signers[0].address)).to.be.equal(0);
            expect(await pool.balanceOf(campaign.address)).to.be.equal(stake);
            expect(await campaign.totalSupply()).to.be.equal(stake);
            expect(await campaign.balanceOf(signers[0].address)).to.be.equal(stake);
        });

        it('Should stake twice', async () => {
            const stake = ethers.utils.parseEther('1');

            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            expect(await pool.balanceOf(signers[0].address)).to.be.equal(0);
            expect(await pool.balanceOf(campaign.address)).to.be.equal(stake.mul(2));
            expect(await campaign.totalSupply()).to.be.equal(stake.mul(2));
            expect(await campaign.balanceOf(signers[0].address)).to.be.equal(stake.mul(2));
        });

        it('Should revert staking amount is missing', async () => {
            await expect(
                campaign.stake(10)
            ).to.be.revertedWith('TransferFrom: Failed');
        });

        it('Should revert when amount is 0', async () => {
            await expect(
                campaign.stake(0)
            ).to.be.revertedWith('Cannot stake 0');
        });
    });

    describe('Withdraw', () => {
        it('Should withdraw successfully', async () => {
            const stake = ethers.utils.parseEther('1');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.stake(stake);
            await campaign.withdraw(stake);

            expect(await pool.balanceOf(signers[0].address)).to.be.equal(stake);
            expect(await pool.balanceOf(campaign.address)).to.be.equal(0);
            expect(await campaign.totalSupply()).to.be.equal(0);
            expect(await campaign.balanceOf(signers[0].address)).to.be.equal(0);
        });

        it('Should withdraw multiple times', async () => {
            const stake = ethers.utils.parseEther('2');

            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            await campaign.withdraw(stake.div(2));
            await campaign.withdraw(stake.div(2));

            expect(await pool.balanceOf(signers[0].address)).to.be.equal(stake);
            expect(await pool.balanceOf(campaign.address)).to.be.equal(0);
            expect(await campaign.totalSupply()).to.be.equal(0);
            expect(await campaign.balanceOf(signers[0].address)).to.be.equal(0);
        });

        it('Should revert when amount is 0', async () => {
            await expect(campaign.withdraw(0)).to.be.revertedWith('Cannot withdraw 0');
        });
    });

    describe('Accumulate rewards', () => {
        it('Should not get rewards when there is no a campaign running', async () => {
            const stake = ethers.utils.parseEther('2');

            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            await campaign.getReward();
        });

        it('Should get ERC20 token rewards', async () => {
            await campaign.enableReward(2);

            const rewards = ethers.utils.parseEther('1');
            const fee = rewards.mul(FEE).div(FEE_DIVIDER);
            const realRewards = rewards.sub(fee);

            await tokenA.mint(signers[0].address, rewards);
            await tokenA.approve(campaign.address, rewards);

            await campaign.notifyRewardAmount(tokenA.address, rewards, 2);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            await campaign.getReward();

            const rewardsStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const stampDiff = rewardsStamp - stakeStamp;

            const rewardsData = await campaign.rewardData(tokenA.address);
            const rewardsAccumulated = rewardsData.rewardRate.mul(stampDiff);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulated, 1); // 1 wei difference
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.sub(rewardsAccumulated), 1); // 1 wei difference

            expect(rewardsData.lastUpdateTime).to.be.equal(rewardsStamp);
            expect(rewardsData.rewardPerTokenStored).to.be.equal(rewardsAccumulated.div(2)); // total supply
            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenA.address)).to.be.equal(rewardsAccumulated.div(2));
        });

        it('Should get HBAR rewards', async () => {
            await factory.setRewardTokens([whbar.address], true);

            await campaign.enableReward(2);

            const rewards = ethers.utils.parseEther('1');
            const fee = rewards.mul(FEE).div(FEE_DIVIDER);
            const realRewards = rewards.sub(fee);

            await whbar.deposit({ value: rewards });
            await whbar.approve(campaign.address, rewards);

            await campaign.notifyRewardAmount(whbar.address, rewards, 2);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            const balanceBefore = await ethers.provider.getBalance(signers[0].address);
            await campaign.getReward();
            const balanceAfter = await ethers.provider.getBalance(signers[0].address);

            const rewardsStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const stampDiff = rewardsStamp - stakeStamp;

            const rewardsData = await campaign.rewardData(whbar.address);
            const rewardsAccumulated = rewardsData.rewardRate.mul(stampDiff);

            expect(balanceBefore).to.be.lt(balanceAfter);
            expect(await whbar.balanceOf(campaign.address)).to.be.closeTo(realRewards.sub(rewardsAccumulated), 1); // 1 wei difference

            expect(rewardsData.lastUpdateTime).to.be.equal(rewardsStamp);
            expect(rewardsData.rewardPerTokenStored).to.be.equal(rewardsAccumulated.div(2)); // total supply
            expect(await campaign.userRewardPerTokenPaid(signers[0].address, whbar.address)).to.be.equal(rewardsAccumulated.div(2));
        });

        it('Should get multiple tokens rewards', async () => {
            await campaign.enableReward(2);

            const rewards = ethers.utils.parseEther('1');
            const fee = rewards.mul(FEE).div(FEE_DIVIDER);
            const realRewards = rewards.sub(fee);

            await tokenA.mint(signers[0].address, rewards);
            await tokenA.approve(campaign.address, rewards);

            const rewards2 = ethers.utils.parseEther('15');
            const fee2 = rewards2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = rewards2.sub(fee2);

            await tokenB.mint(signers[0].address, rewards2);
            await tokenB.approve(campaign.address, rewards2);

            await campaign.notifyRewardAmount(tokenA.address, rewards, 2);
            await campaign.notifyRewardAmount(tokenB.address, rewards2, 2);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            await campaign.getReward();

            const rewardsStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const stampDiff = rewardsStamp - stakeStamp;

            const rewardsDataA = await campaign.rewardData(tokenA.address);
            const rewardsDataB = await campaign.rewardData(tokenB.address);
            const rewardsAccumulatedA = rewardsDataA.rewardRate.mul(stampDiff);
            const rewardsAccumulatedB = rewardsDataB.rewardRate.mul(stampDiff);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulatedA, 1);
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.sub(rewardsAccumulatedA), 1);
            expect(await tokenB.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulatedB, 1);
            expect(await tokenB.balanceOf(campaign.address)).to.be.closeTo(realRewards2.sub(rewardsAccumulatedB), 1);

            expect(rewardsDataA.lastUpdateTime).to.be.equal(rewardsStamp);
            expect(rewardsDataA.rewardPerTokenStored).to.be.equal(rewardsAccumulatedA.div(2));
            expect(rewardsDataB.lastUpdateTime).to.be.equal(rewardsStamp);
            expect(rewardsDataB.rewardPerTokenStored).to.be.equal(rewardsAccumulatedB.div(2));

            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenA.address)).to.be.equal(rewardsAccumulatedA.div(2));
            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenB.address)).to.be.equal(rewardsAccumulatedB.div(2));
        });

        it('Should get multiple tokens rewards for multiple users', async () => {
            await campaign.enableReward(2);

            const rewards = ethers.utils.parseEther('1');
            const fee = rewards.mul(FEE).div(FEE_DIVIDER);
            const realRewards = rewards.sub(fee);

            await tokenA.mint(signers[0].address, rewards);
            await tokenA.approve(campaign.address, rewards);

            const rewards2 = ethers.utils.parseEther('1');
            const fee2 = rewards2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = rewards2.sub(fee2);

            await tokenB.mint(signers[0].address, rewards2);
            await tokenB.approve(campaign.address, rewards2);

            await campaign.notifyRewardAmount(tokenA.address, rewards, 2);
            await campaign.notifyRewardAmount(tokenB.address, rewards2, 2);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);
            await campaign.stake(stake);

            const stakeStampUser1 = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            const stake2 = ethers.utils.parseEther('3')
            await pool.mint(signers[1].address, stake2);
            await pool.connect(signers[1]).approve(campaign.address, stake2);
            await campaign.connect(signers[1]).stake(stake2);

            const stakeStampUser2 = (await ethers.provider.getBlock('latest')).timestamp;

            const rewardRateA = (await campaign.rewardData(tokenA.address))[0];
            const rewardRateB = (await campaign.rewardData(tokenB.address))[0];
            let rewardsSoFarAUser1 = rewardRateA.mul(stakeStampUser2 - stakeStampUser1);
            let rewardsSoFarBUser1 = rewardRateB.mul(stakeStampUser2 - stakeStampUser1);

            await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            await campaign.getReward();
            const rewardsStampUser1 = (await ethers.provider.getBlock('latest')).timestamp;

            await campaign.connect(signers[1]).getReward();
            const rewardsStampUser2 = (await ethers.provider.getBlock('latest')).timestamp;

            const rewardsAccumulatedAUser1 = rewardsSoFarAUser1.add(rewardRateA.mul(rewardsStampUser1 - stakeStampUser2).mul(2).div(5));
            const rewardsAccumulatedBUser1 = rewardsSoFarBUser1.add(rewardRateB.mul(rewardsStampUser1 - stakeStampUser2).mul(2).div(5));

            const rewardsAccumulatedAUser2 = rewardRateA.mul(rewardsStampUser2 - stakeStampUser2).mul(3).div(5);
            const rewardsAccumulatedBUser2 = rewardRateB.mul(rewardsStampUser2 - stakeStampUser2).mul(3).div(5);

            // User 1
            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulatedAUser1, 1);
            expect(await tokenB.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulatedBUser1, 1);

            // User 2
            expect(await tokenA.balanceOf(signers[1].address)).to.be.closeTo(rewardsAccumulatedAUser2, 5);
            expect(await tokenB.balanceOf(signers[1].address)).to.be.closeTo(rewardsAccumulatedBUser2, 5);

            // Campaign balances
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.sub(rewardsAccumulatedAUser1.add(rewardsAccumulatedAUser2)), 5);
            expect(await tokenB.balanceOf(campaign.address)).to.be.closeTo(realRewards2.sub(rewardsAccumulatedBUser1.add(rewardsAccumulatedBUser2)), 5);

            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenA.address)).to.be.equal(rewardsAccumulatedAUser1.div(2));
            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenB.address)).to.be.equal(rewardsAccumulatedBUser1.div(2));
            expect(await campaign.userRewardPerTokenPaid(signers[1].address, tokenA.address)).to.be.equal(rewardsAccumulatedAUser1.div(2).add(rewardRateA.mul(rewardsStampUser2 - rewardsStampUser1).div(5)));
            expect(await campaign.userRewardPerTokenPaid(signers[1].address, tokenB.address)).to.be.equal(rewardsAccumulatedBUser1.div(2).add(rewardRateB.mul(rewardsStampUser2 - rewardsStampUser1).div(5)));

            // General state
            const rewardsDataA = await campaign.rewardData(tokenA.address);
            const rewardsDataB = await campaign.rewardData(tokenB.address);

            expect(rewardsDataA.lastUpdateTime).to.be.equal(rewardsStampUser2);
            expect(rewardsDataB.lastUpdateTime).to.be.equal(rewardsStampUser2);
            expect(rewardsDataA.rewardPerTokenStored).to.be.equal(rewardsAccumulatedAUser1.div(2).add(rewardRateA.mul(rewardsStampUser2 - rewardsStampUser1).div(5)));
            expect(rewardsDataB.rewardPerTokenStored).to.be.equal(rewardsAccumulatedBUser1.div(2).add(rewardRateB.mul(rewardsStampUser2 - rewardsStampUser1).div(5)));
        });
    });

    describe('Exit', () => {
        it('Should withdraw and get rewards at once', async () => {
            await campaign.enableReward(2);

            const rewards = ethers.utils.parseEther('1');
            const fee = rewards.mul(FEE).div(FEE_DIVIDER);
            const realRewards = rewards.sub(fee);

            await tokenA.mint(signers[0].address, rewards);
            await tokenA.approve(campaign.address, rewards);

            await campaign.notifyRewardAmount(tokenA.address, rewards, 2);

            const stake = ethers.utils.parseEther('1');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            await campaign.exit();

            const rewardsStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const stampDiff = rewardsStamp - stakeStamp;

            const rewardsData = await campaign.rewardData(tokenA.address);
            const rewardsAccumulated = rewardsData.rewardRate.mul(stampDiff);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulated, 1); // 1 wei difference
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.sub(rewardsAccumulated), 1); // 1 wei difference

            expect(rewardsData.lastUpdateTime).to.be.equal(rewardsStamp);
            expect(rewardsData.rewardPerTokenStored).to.be.equal(rewardsAccumulated); // total supply
            expect(await campaign.userRewardPerTokenPaid(signers[0].address, tokenA.address)).to.be.equal(rewardsAccumulated);

            expect(await pool.balanceOf(signers[0].address)).to.be.equal(stake);
        });

        it('Should withdraw and get 0 rewards when there is no running campaign', async () => {
            const stake = ethers.utils.parseEther('1');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.stake(stake);
            await campaign.exit();

            expect(await tokenA.balanceOf(signers[0].address)).to.be.equal(0);
            expect(await tokenB.balanceOf(signers[0].address)).to.be.equal(0);
        });
    });

    describe('Pause', () => {
        it('Should pause a campaign', async () => {
            await campaign.pause();

            await expect(campaign.stake(1)).to.be.revertedWith('Pausable: paused');
            expect(await campaign.paused()).to.be.equal(true);
        });
    });

    describe('UnPause', () => {
        it('Should unpause a campaign', async () => {
            await campaign.pause();
            await campaign.unpause();

            expect(await campaign.paused()).to.be.equal(false);
        });
    });

    describe('Flows', () => {
        it('Should extend a campaign and user keeps rewards from the first run', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.notifyRewardAmount(tokenA.address, reward, 2);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [61 * 24 * 60 * 60]); // skip 2 months
            await ethers.provider.send('evm_mine', []);

            const rewardsExpected = (await campaign.periodFinish()).sub(stakeStamp).mul(
                (await campaign.rewardData(tokenA.address))[0]
            );

            expect(await campaign.earned(signers[0].address, tokenA.address)).to.be.closeTo(
                rewardsExpected, 1
            );

            await campaign.enableReward(2);

            const reward2 = ethers.utils.parseEther('15');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, reward2);
            await tokenA.approve(campaign.address, reward2);
            await campaign.notifyRewardAmount(tokenA.address, reward2, 2);

            const notifyStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [30 * 24 * 60 * 60]); // skip 1 month
            await ethers.provider.send('evm_mine', []);

            await campaign.getReward();

            const rewardsStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const stampDiff = rewardsStamp - notifyStamp;

            const rewardsData = await campaign.rewardData(tokenA.address);
            const rewardsAccumulated = rewardsData.rewardRate.mul(stampDiff).add(rewardsExpected);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulated, 1); // 1 wei difference
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.add(realRewards2).sub(rewardsAccumulated), 1); // 1 wei difference

            await ethers.provider.send('evm_increaseTime', [31 * 24 * 60 * 60]); // skip 1 month
            await ethers.provider.send('evm_mine', []);

            await campaign.getReward();

            const rewardsExpected2 = (await campaign.periodFinish()).sub(rewardsStamp).mul(
                (await campaign.rewardData(tokenA.address))[0]
            ).add(rewardsAccumulated);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsExpected2, 1);
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.add(realRewards2).sub(rewardsExpected2), 1);
        });

        it('Should extend a campaign twice and user keeps rewards from both of them', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.notifyRewardAmount(tokenA.address, reward, 2);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [61 * 24 * 60 * 60]); // skip 2 months
            await ethers.provider.send('evm_mine', []);

            const rewardsExpected = (await campaign.periodFinish()).sub(stakeStamp).mul(
                (await campaign.rewardData(tokenA.address))[0]
            );

            expect(await campaign.earned(signers[0].address, tokenA.address)).to.be.closeTo(
                rewardsExpected, 1
            );

            await campaign.enableReward(2);

            const reward2 = ethers.utils.parseEther('15');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, reward2);
            await tokenA.approve(campaign.address, reward2);
            await campaign.notifyRewardAmount(tokenA.address, reward2, 2);

            const notifyStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [61 * 24 * 60 * 60]); // skip 1 month
            await ethers.provider.send('evm_mine', []);

            await campaign.getReward();

            const rewardsExpected2 = (await campaign.periodFinish()).sub(notifyStamp).mul(
                (await campaign.rewardData(tokenA.address))[0]
            ).add(rewardsExpected);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsExpected2, 1);
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.add(realRewards2).sub(rewardsExpected2), 1);
        });

        it('Should extend a campaign and user entering after it to receive nothing', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.notifyRewardAmount(tokenA.address, reward, 2);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [61 * 24 * 60 * 60]); // skip 2 months
            await ethers.provider.send('evm_mine', []);

            const rewardsExpected = (await campaign.periodFinish()).sub(stakeStamp).mul(
                (await campaign.rewardData(tokenA.address))[0]
            );

            expect(await campaign.earned(signers[0].address, tokenA.address)).to.be.closeTo(
                rewardsExpected, 1
            );

            await pool.mint(signers[1].address, stake);
            await pool.connect(signers[1]).approve(campaign.address, stake);
            await campaign.connect(signers[1]).stake(stake);

            expect(await campaign.earned(signers[1].address, tokenA.address)).to.be.equal(0);
            await campaign.connect(signers[1]).getReward();
            expect(await tokenA.balanceOf(signers[1].address)).to.be.equal(0);

            await campaign.enableReward(2);

            const reward2 = ethers.utils.parseEther('15');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, reward2);
            await tokenA.approve(campaign.address, reward2);
            await campaign.notifyRewardAmount(tokenA.address, reward2, 2);

            const notifyStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [61 * 24 * 60 * 60]); // skip 2 months
            await ethers.provider.send('evm_mine', []);

            await campaign.getReward();
            await campaign.connect(signers[1]).getReward();

            const stampDiff = (await campaign.periodFinish()).sub(notifyStamp);

            const rewardsData = await campaign.rewardData(tokenA.address);
            const rewardsAccumulated1 = rewardsData.rewardRate.mul(stampDiff).div(2).add(rewardsExpected);
            const rewardsAccumulated2 = rewardsData.rewardRate.mul(stampDiff).div(2);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulated1, 1); // 1 wei difference
            expect(await tokenA.balanceOf(signers[1].address)).to.be.closeTo(rewardsAccumulated2, 1); // 1 wei difference
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.add(realRewards2).sub(rewardsAccumulated1.add(rewardsAccumulated2)), 1); // 1 wei difference
        });

        it('Should change campaign rate and the user to receive the rewards correctly', async () => {
            await campaign.enableReward(2);

            const reward = ethers.utils.parseEther('1');
            const fee = reward.mul(FEE).div(FEE_DIVIDER);
            const realRewards = reward.sub(fee);

            await tokenA.mint(signers[0].address, reward);
            await tokenA.approve(campaign.address, reward);

            const stake = ethers.utils.parseEther('2');
            await pool.mint(signers[0].address, stake);
            await pool.approve(campaign.address, stake);

            await campaign.notifyRewardAmount(tokenA.address, reward, 2);
            await campaign.stake(stake);

            const stakeStamp = (await ethers.provider.getBlock('latest')).timestamp;

            await ethers.provider.send('evm_increaseTime', [30 * 24 * 60 * 60]); // skip 1 month
            await ethers.provider.send('evm_mine', []);

            const reward2 = ethers.utils.parseEther('1');
            const fee2 = reward2.mul(FEE).div(FEE_DIVIDER);
            const realRewards2 = reward2.sub(fee2);

            await tokenA.mint(signers[0].address, reward2);
            await tokenA.approve(campaign.address, reward2);

            const oldRate = (await campaign.rewardData(tokenA.address))[0];
            await campaign.notifyRewardAmount(tokenA.address, reward2, 2);

            const notifyStamp = (await ethers.provider.getBlock('latest')).timestamp;
            const periodRemaining = (await campaign.periodFinish()).sub(notifyStamp);
            const newRate = oldRate.mul(periodRemaining).add(realRewards2).div(
                periodRemaining
            );

            expect((await campaign.rewardData(tokenA.address))[0]).to.be.equal(newRate);

            await ethers.provider.send('evm_increaseTime', [31 * 24 * 60 * 60]); // skip 1 month
            await ethers.provider.send('evm_mine', []);

            await campaign.getReward();

            const initialRewards = oldRate.mul(notifyStamp - stakeStamp);
            const secondRewards = newRate.mul(periodRemaining);
            const rewardsAccumulated = initialRewards.add(secondRewards);

            expect(await tokenA.balanceOf(signers[0].address)).to.be.closeTo(rewardsAccumulated, 1); // 1 wei difference
            expect(await tokenA.balanceOf(campaign.address)).to.be.closeTo(realRewards.add(realRewards2).sub(rewardsAccumulated), 1); // 1 wei difference
        });
    });
});
