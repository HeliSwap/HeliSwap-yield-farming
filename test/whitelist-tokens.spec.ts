import { expect } from 'chai';
import { ethers } from 'hardhat';
import { smock } from '@defi-wonderland/smock';

describe('Whitelisted Tokens', () => {

    const WHBAR = '0x0000000000000000000000000000000000000001';
    const TOKEN_A = '0x0000000000000000000000000000000000000002';
    const TOKEN_B = '0x0000000000000000000000000000000000000003';
    const TOKEN_C = '0x0000000000000000000000000000000000000004';
    const IPFS_HASH = 'QmdeYoRSkqDhoRNVNzudgFSpoCyZqtsXD7FTUCGnAp1oju';

    let signers: any;
    let whitelist: any;
    let poolsFactory: any;

    beforeEach(async () => {
        signers = await ethers.getSigners();

        poolsFactory = await smock.fake('IPoolsFactory');

        const Whitelist = await ethers.getContractFactory('Whitelist');
        whitelist = await (await Whitelist.deploy(WHBAR, poolsFactory.address)).deployed();

        poolsFactory.getPair.whenCalledWith(TOKEN_A, WHBAR).returns(TOKEN_A);
        poolsFactory.getPair.whenCalledWith(TOKEN_B, WHBAR).returns(TOKEN_B);
        poolsFactory.getPair.whenCalledWith(TOKEN_C, WHBAR).returns(ethers.constants.AddressZero);
    });

    it('Should deploy correctly ', async () => {
        expect(await whitelist.whbar()).to.equal(WHBAR);
        expect(await whitelist.poolsFactory()).to.equal(poolsFactory.address);
    });

    describe('Add to whitelist', function () {

        it('Should set whitelisted tokens', async function () {
            await whitelist.addToWhitelist(TOKEN_A, IPFS_HASH);
            await whitelist.addToWhitelist(TOKEN_B, IPFS_HASH);

            expect(await whitelist.whitelistedTokens(TOKEN_A)).to.be.equal(IPFS_HASH);
            expect(await whitelist.whitelistedTokens(TOKEN_B)).to.be.equal(IPFS_HASH);
        });

        it('Should revert when there is no a direct pool for a given token with WHBAR', async function () {
            await expect(
                whitelist.addToWhitelist(TOKEN_C, IPFS_HASH)
            ).to.be.revertedWith('There is no a pool with Token:WHBAR');
        });

        it('Should revert when not the owner tries to add to whitelist', async function () {
            await expect(
                whitelist.connect(signers[1]).addToWhitelist(TOKEN_A, IPFS_HASH)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe('Remove from whitelist', function () {
        it('Should remove a token', async function () {
            await whitelist.addToWhitelist(TOKEN_A, IPFS_HASH);
            await whitelist.removeFromWhitelist(TOKEN_A);

            expect(await whitelist.whitelistedTokens(TOKEN_A)).to.be.equal('');
        });

        it('Should revert when not the owner tries to remove a token', async function () {
            await expect(
                whitelist.connect(signers[1]).removeFromWhitelist(TOKEN_A)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
    });
});
