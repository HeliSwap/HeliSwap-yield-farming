// @ts-nocheck
import hardhat from 'hardhat';

async function sendReward(campaign: string, reward: string, amount: string, duration: number) {
  const multiRewards = await hardhat.hethers.getContractAt('MultiRewards', campaign);
  const rewardToken = await hardhat.hethers.getContractAt('MockToken', reward);

  console.log('⚙️ Approving token...');
  const approveTx = await rewardToken.approve(campaign, amount, { gasLimit: 1_000_000 });
  console.log(`✅ Approved Campaign contract ${campaign} for ${amount} of Reward`);

  console.log('⚙️ Sending reward and notifying...');
  const tx = await multiRewards.notifyRewardAmount(reward, amount, duration, { gasLimit: 10_000_000 });
  await tx.wait();
  console.log('✅ Reward sent');
}

module.exports = sendReward;
