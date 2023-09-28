// @ts-nocheck
import hardhat from 'hardhat';

async function enableRewards(campaign: string, duration: string) {
  const multiRewards = await hardhat.hethers.getContractAt('MultiRewards', campaign);

  console.log('⚙️ Enabling reward...');
  await multiRewards.enableReward(duration, { gasLimit: 900_000 });
  console.log('✅ Reward enabled');
}

module.exports = enableRewards;
