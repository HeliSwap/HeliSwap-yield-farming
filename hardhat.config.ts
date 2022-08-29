import { task } from 'hardhat/config';
import * as config from './config';

require('@hashgraph/hardhat-hethers');

task('deployFactory', 'Deploys an YF factory contract').setAction(async () => {
  const factoryDeployment = require('./scripts/01-deploy-factory');
  await factoryDeployment();
});

task('deployCampaign', 'Deploys an YF contract from factory')
  .addParam('factory', 'Factory contract address')
  .addParam('owner', 'Campaign owner')
  .addParam('token', 'Staking token address')
  .setAction(async taskArgs => {
    const { factory, owner, token } = taskArgs;
    const deployCampaign = require('./scripts/02-deploy-campaign');
    await deployCampaign(factory, owner, token);
  });

task('enableReward', 'Enable rewards to YF contract')
  .addParam('campaign', 'Campaign address')
  .addParam('reward', 'Reward address')
  .addParam('duration', 'Duration in seconds')
  .setAction(async taskArgs => {
    const { campaign, reward, duration } = taskArgs;
    const enableReward = require('./scripts/03-enable-rewards');
    await enableReward(campaign, reward, duration);
  });

task('sendReward', 'Notify contract for YF rewards')
  .addParam('campaign', 'Campaign address')
  .addParam('reward', 'Reward address')
  .addParam('amount', 'Reward amount')
  .setAction(async taskArgs => {
    const { campaign, reward, amount } = taskArgs;
    const sendReward = require('./scripts/04-send-reward');
    await sendReward(campaign, reward, amount);
  });

task('associateToken', 'Associates an HTS token')
  .addParam('accountid', 'The account that will be associated')
  .addParam('pk', 'The PK of the account that will be associated')
  .addParam('tokenid', 'The token that will is getting associated to')
  .setAction(async taskArgs => {
    console.log(taskArgs);
    const tokenAssociation = require('./scripts/utils/associateTokens');
    await tokenAssociation(taskArgs.accountid, taskArgs.pk, taskArgs.tokenid);
  });

task('approveToken', 'Approves an HTS token for spending by an account')
  .addParam('accountid', 'The account that will give permission')
  .addParam('pk', 'The PK of the account that will permit')
  .addParam('spenderaccountid', 'The account that will be permitted to spend tokens')
  .addParam('tokenid', 'The token will be spent')
  .addParam('amount', 'How many tokens will be spent')
  .setAction(async taskArgs => {
    console.log(taskArgs);
    const tokenApproval = require('./scripts/utils/approveToken');
    await tokenApproval(taskArgs.accountid, taskArgs.pk, taskArgs.spenderaccountid, taskArgs.tokenid, taskArgs.amount);
  });

task('setupHbarCampaign', 'Deploys HBAR campaign')
  .addParam('factory', 'Factory contract address')
  .addParam('token', 'The staking token to user for the campaign')
  .addParam('hbaramount', 'Amount of HBARs to distribute as rewards')
  .addParam('duration', 'Duration of the campaign')
  .setAction(async taskArgs => {
    const setupHbarCampaign = require('./scripts/setup-hbar-campaign');
    await setupHbarCampaign(taskArgs.factory, taskArgs.token, taskArgs.hbaramount, taskArgs.duration);
  });

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.5.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: 'testnet',
  hedera: {
    networks: config.networks,
    gasLimit: 2_000_000,
  },
};
