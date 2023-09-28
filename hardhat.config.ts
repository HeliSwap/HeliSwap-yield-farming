import * as dotenv from 'dotenv';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import * as config from './config';

dotenv.config();

require('@hashgraph/hardhat-hethers'); // UNCOMMENT WHEN EXECUTING SCRIPTS; COMMENT WHEN RUNNING TESTS

task('deployFactory', 'Deploys an YF factory contract')
  .addParam('factory', 'DEX Factory address')
  .setAction(async taskArgs => {
    const { factory } = taskArgs;
    const deployFactory = require('./scripts/01-deploy-factory');
    await deployFactory(factory);
  });

task('addRewards', 'Whitelist rewatds to YF factory')
  .addParam('factory', 'Factory contract address')
  .setAction(async taskArgs => {
    const { factory } = taskArgs;
    const addRewards = require('./scripts/00-add-rewards');
    await addRewards(factory);
  });

task('deployCampaign', 'Deploys an YF contract from factory')
  .addParam('factory', 'Factory contract address')
  .addParam('token0', 'Token A')
  .addParam('token1', 'Token B')
  .setAction(async taskArgs => {
    const { factory, token0, token1 } = taskArgs;
    const deployCampaign = require('./scripts/02-deploy-campaign');
    await deployCampaign(factory, token0, token1);
  });

task('enableReward', 'Enable rewards to YF contract')
  .addParam('campaign', 'Campaign address')
  .addParam('duration', 'Duration in seconds')
  .setAction(async taskArgs => {
    const { campaign, duration } = taskArgs;
    const enableReward = require('./scripts/03-enable-rewards');
    await enableReward(campaign, duration); // If adding non HTS token as as reward, set this to false
  });

task('sendReward', 'Notify contract for YF rewards')
  .addParam('campaign', 'Campaign address')
  .addParam('reward', 'Reward address')
  .addParam('amount', 'Reward amount')
  .addParam('duration', 'Reward duration')
  .setAction(async taskArgs => {
    const { campaign, reward, amount, duration } = taskArgs;
    const sendReward = require('./scripts/04-send-reward');
    await sendReward(campaign, reward, amount, duration);
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
  .addParam('account', 'The account that will give permission')
  .addParam('pk', 'The PK of the account that will permit')
  .addParam('spender', 'The account that will be permitted to spend tokens')
  .addParam('token', 'The token will be spent')
  .addParam('amount', 'How many tokens will be spent')
  .setAction(async taskArgs => {
    console.log(taskArgs);
    const tokenApproval = require('./scripts/utils/approveToken');
    await tokenApproval(taskArgs.account, taskArgs.pk, taskArgs.spender, taskArgs.token, taskArgs.amount);
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

task('setupHTSCampaign', 'Deploys HTS campaign')
  .addParam('factory', 'Factory contract address')
  .addParam('token', 'The staking token to user for the campaign')
  .addParam('reward', 'The staking reward')
  .addParam('amount', 'Amount of HBARs to distribute as rewards')
  .addParam('duration', 'Duration of the campaign')
  .setAction(async taskArgs => {
    const setupHTSCampaign = require('./scripts/setup-hts-campaign');
    await setupHTSCampaign(taskArgs.factory, taskArgs.token, taskArgs.reward, taskArgs.amount, taskArgs.duration);
  });

task('setupMultiRewardsCampaign', 'Deploys Multi Rewards campaign')
  .addParam('factory', 'Factory contract address')
  .addParam('token', 'The staking token to user for the campaign')
  .addParam('duration', 'Duration of the campaign')
  .setAction(async taskArgs => {
    const setupMultiRewardsCampaign = require('./scripts/setup-multi-rewards-campaign');
    await setupMultiRewardsCampaign(taskArgs.factory, taskArgs.token, taskArgs.duration);
  });

task('campaignInfo', 'Interact with multirewards contract')
  .addParam('campaign', 'Contract address')
  //   .addParam('walletAddress', 'Wallet address')
  //   .addParam('index', 'Reward index')
  //   .addParam('decimals', 'Reward token decimals')
  .setAction(async taskArgs => {
    // const { campaign, walletAddress, index, decimals } = taskArgs;
    const { campaign } = taskArgs;

    const campaignInfo = require('./scripts/05-campaign-info');

    // await campaignInfo(campaign, walletAddress, index, decimals);
    await campaignInfo(campaign);
  });

task('setDuration', 'Adjust the duration of a particular campaign')
  .addParam('campaign', 'Campaign address')
  .addParam('token', 'Reward address')
  .addParam('duration', 'Duration by which the campaign will be extended')
  .setAction(async taskArgs => {
    const { campaign, token, duration } = taskArgs;

    const setDuration = require('./scripts/set-rewards-duration');

    await setDuration(campaign, token, duration);
  });

task('extendCampaign')
  .addParam('campaign')
  .addParam('token')
  .addParam('duration')
  .addParam('reward')
  .setAction(async taskArgs => {
    const extendCampaign = require('./scripts/06-extend-campaign');
    await extendCampaign(taskArgs.campaign, taskArgs.token, taskArgs.duration, taskArgs.reward);
  });

task('stakeToken', 'Stake tokens to campaign')
  .addParam('campaign')
  .addParam('amount')
  .addParam('token')
  .setAction(async taskArgs => {
    const { campaign, amount, token } = taskArgs;
    const stakeToken = require('./scripts/07-stake-token');
    await stakeToken(campaign, amount, token);
  });

const accounts = [
  {
    privateKey: '0xe80902f1423234ab6de5232a497a2dad6825185949438bdf02ef36cd3f38d62c',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0x8dc23d20e4cc1c1bce80b3610d2b9c3d2dcc917fe838d6161c7b7107ea8049d2',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xf467b3f495971ec1804cd753984e2ab03affc8574c35bd302d611f93420c1861',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0x195c2fce7255bddbea14def3ca04fd5bf2b53e749cd2d4ac33a85d6872e798f6',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xa9039111697f2c0c51d0c2f35cb1fc1fa9f0456e1a0b58c297d4940eda35b135',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xd32ba1893d2c189fb6ce63ef03c63e2aa7cf2893c60c39851d2c576fd7bb8b65',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xf9def8e25a2538e0a090bce36e9cd7815d04347171383f9dcb6362078c4437df',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xe57de1dc1573318d0a7e81367138c09b04a6a6bc6f46858c3a09d1f7a25ee72d',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0x81274be2a9a23d2bcb6786b786917b3641d8dff69b541a7f1d20151a145a4114',
    balance: '211371231719819352917048000',
  },
  {
    privateKey: '0xf1ddce51d38205805c1574e46dc3982c5cdad8e78641200280be1df7487bdbac',
    balance: '211371231719819352917048000',
  },
];

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          // required for smocks plugin
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
      {
        version: '0.4.18',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    localhost: {
      url: 'http://localhost:8545',
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: '' + process.env.MAINNET_KEY,
        blockNumber: 15680777,
      },
      // mining: {
      //   auto: false,
      //   interval: 13000,
      // },
      accounts,
    },
  },
  hedera: {
    networks: config.networks,
    gasLimit: 2_000_000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: '',
  },
};
