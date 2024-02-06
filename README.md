# Web3 proofs helper

This repository contains helper functions for getting web3 proofs.

### Installation

#### npm
<code>npm i web3-proofs-helper</code>

#### yarn
<code>yarn add web3-proofs-helper</code>

### How to use

```typescript
    import { getVotingProofs, baseSlots } from 'web3-proofs-helper';
    import { AaveV3Ethereum, AaveSafetyModule, GovernanceV3Ethereum } from '@bgd-labs/aave-address-book';

    const assets = {
        aaveAddress: AaveV3Ethereum.ASSETS.AAVE.UNDERLYING,
        aAaveAddress: AaveV3Ethereum.ASSETS.AAVE.A_TOKEN,
        stkAAVEAddress: AaveSafetyModule.STK_AAVE,
        contractAddress: GovernanceV3Ethereum.GOVERNANCE,
    }

    const assetsBalanceSlots: AssetsBalanceSlots = {
        [assets.stkAAVEAddress.toLowerCase()]: {
            ...baseSlots[Asset.STKAAVE],
        },
        [assets.aAaveAddress.toLowerCase()]: {
            ...baseSlots[Asset.AAAVE],
        },
        [assets.aaveAddress.toLowerCase()]: {
            ...baseSlots[Asset.AAVE],
        },
        [assets.contractAddress.toLowerCase()]: {
            ...baseSlots[Asset.GOVCORE],
        },
    };

    const formattedBalances = {
        underlyingAsset: assets.aaveAddress, // address of voting asset
        value: 100, // total balance (user balance + delegated voting power) on voting block
        userBalance: 100, // should be real user balance on voting block (not current))
        isWithDelegatedPower: false,
    }
    
    // getting balance proofs for voting
    const proofs = await getVotingProofs({
        provider: govCoreRPCProvider, // ether js v5 provider
        blockHash: proposal.snapshotBlockHash, // from proposal data
        balances: formattedBalances,
        address: voterAddress, // voter asset (signer or representation address)
        aAaveAddress: assets.aAaveAddress,
        slots: assetsBalanceSlots,
    });
```

## License

Released under the [MIT License](./LICENSE).
