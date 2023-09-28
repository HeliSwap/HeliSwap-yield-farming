// @ts-nocheck
import hardhat from 'hardhat';

async function deployCampaignFromFactory (factory: string) {
  const Factory = await hardhat.hethers.getContractAt('Factory', factory);
  const rewards = [
    '0x000000000000000000000000000000000006A6cB', // Testnet WHBAR
    '0x000000000000000000000000000000000001d7FA', // Testnet HELI
    '0x000000000000000000000000000000000006a5c5', // Testnet USDC
  ];

  console.log('⚙️ Adding rewards to factory...');

  const tx = await Factory.setRewardTokens(rewards, true, { gasLimit: 5_000_000 });
  await tx.wait();

  console.log('✅ Rewards added!');
}

module.exports = deployCampaignFromFactory;
