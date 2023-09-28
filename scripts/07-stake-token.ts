// @ts-nocheck
import hardhat from 'hardhat';

async function stakeToken(campaignAddress: string, tokenAmount: string, tokenAddress: string) {
  const [signer] = await hardhat.hethers.getSigners();

  const multiRewardsContract = await hardhat.hethers.getContractAt('MultiRewards', campaignAddress);
  const tokenContract = await hardhat.hethers.getContractAt('MockToken', tokenAddress);

  //   console.log('multiRewardsContract', multiRewardsContract);

  const name = await tokenContract.name();
  const symbol = await tokenContract.symbol();
  const decimals = await tokenContract.decimals();

  //   console.log('name', name);
  //   console.log('symbol', symbol);
  //   console.log('decimals', decimals);
  //   console.log('tokenContract', tokenContract);

  const balance = await tokenContract.balanceOf(signer.address);
  console.log('Balance for signer: ', balance.toString());

  const balance2 = await tokenContract.balanceOf('0x61c90019e9fb0d95cbd39cb68e0b4f217526e2da');
  console.log('Balance for 0x61c90019e9fb0d95cbd39cb68e0b4f217526e2da: ', balance2.toString());

  const amountBN = hardhat.ethers.utils.parseEther('1');

  // Approve token
  console.log('⚙️ Approving token...');
  const approveTx = await tokenContract.approve(campaignAddress, '100000000000000000000000000000');
  await approveTx.wait();
  console.log('✅ Token approved!');

  //   console.log('signer.address', signer.address);
  //   console.log('0x61c90019e9fb0d95cbd39cb68e0b4f217526e2da', 0x61c90019e9fb0d95cbd39cb68e0b4f217526e2da);

  const allowance = await tokenContract.allowance('0x61c90019e9fb0d95cbd39cb68e0b4f217526e2da', campaignAddress);
  console.log('Allowance for signer: ', allowance.toString());

  // Stake token
  console.log('⚙️ Staking token...');
  const stakeTx = await multiRewardsContract.stake(amountBN, { gasLimit: 3000000 });
  await stakeTx.wait();
  console.log('✅ Token staked!');
}

module.exports = stakeToken;
