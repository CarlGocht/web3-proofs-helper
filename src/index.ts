import { BigNumber, BytesLike, ethers } from "ethers";

export enum Asset {
  AAVE = "AAVE",
  STKAAVE = "stkAAVE",
  AAAVE = "aAAVE",
  GOVCORE = "Gov core",
}

// slots by assets name
export const baseSlots = {
  [Asset.STKAAVE]: {
    balance: 0,
    exchangeRate: 81,
  },
  [Asset.AAAVE]: {
    balance: 52,
    delegation: 64,
  },
  [Asset.AAVE]: {
    balance: 0,
  },
  [Asset.GOVCORE]: {
    balance: 9,
  },
};

// proofs types
export type Proof = {
  balance: string; //QUANTITY - the balance of the account. Seeeth_getBalance
  codeHash: string; //DATA, 32 Bytes - hash of the code of the account. For a simple Account without code it will return "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
  nonce: string; //QUANTITY, - nonce of the account. See eth_getTransactionCount
  storageHash: string; //DATA, 32 Bytes - SHA3 of the StorageRoot. All storage will deliver a MerkleProof starting with this rootHash.
  accountProof: string[]; //ARRAY - Array of rlp-serialized MerkleTree-Nodes, starting with the stateRoot-Node, following the path of the SHA3 (address) as key.
  storageProof: {
    //ARRAY - Array of storage-entries as requested. Each entry is an object with these properties:
    key: string; //QUANTITY - the requested storage key
    value: string; //QUANTITY - the storage value
    proof: string[]; //ARRAY - Array of rlp-serialized MerkleTree-Nodes, starting with the storageHash-Node, following the path of the SHA3 (key) as path.
  }[];
};

export type BalanceForProof = {
  underlyingAsset: string;
  value: string;
  userBalance: string;
  isWithDelegatedPower: boolean;
};

export type AssetsBalanceSlots = Record<
  string,
  {
    balance: number;
    delegation?: number;
    exchangeRate?: number;
  }
>;
// end types

export function getVoteBalanceSlot(
  underlyingAsset: string,
  isWithDelegatedPower: boolean,
  aAaveAddress: string,
  slots: AssetsBalanceSlots,
) {
  return underlyingAsset.toLowerCase() === aAaveAddress.toLowerCase() &&
    isWithDelegatedPower
    ? slots[underlyingAsset.toLowerCase()].delegation || 64
    : slots[underlyingAsset.toLowerCase()].balance || 0;
}

export function formatToProofRLP(rawData: string[]): string {
  return ethers.utils.RLP.encode(
    rawData.map((d) => ethers.utils.RLP.decode(d)),
  );
}

// IMPORTANT valid only for post-London blocks, as it includes `baseFeePerGas`
export function prepareBLockRLP(rawBlock: any) {
  const rawData = [
    rawBlock.parentHash,
    rawBlock.sha3Uncles,
    rawBlock.miner,
    rawBlock.stateRoot,
    rawBlock.transactionsRoot,
    rawBlock.receiptsRoot,
    rawBlock.logsBloom,
    "0x", //BigNumber.from(rawBlock.difficulty).toHexString(),
    BigNumber.from(rawBlock.number).toHexString(),
    BigNumber.from(rawBlock.gasLimit).toHexString(),
    rawBlock.gasUsed === "0x0"
      ? "0x"
      : BigNumber.from(rawBlock.gasUsed).toHexString(),
    BigNumber.from(rawBlock.timestamp).toHexString(),
    rawBlock.extraData,
    rawBlock.mixHash,
    rawBlock.nonce,
    BigNumber.from(rawBlock.baseFeePerGas).toHexString(),
    rawBlock.withdrawalsRoot,
  ];
  console.log("raw data array: ", rawData);
  return ethers.utils.RLP.encode(rawData);
}

export function getSolidityStorageSlotBytes(
  mappingSlot: BytesLike,
  key: string,
) {
  const slot = ethers.utils.hexZeroPad(mappingSlot, 32);
  return ethers.utils.hexStripZeros(
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [key, slot]),
    ),
  );
}

export function getSolidityTwoLevelStorageSlotHash(
  rawSlot: string,
  voter: string,
  chainId: number,
) {
  const abiCoder = new ethers.utils.AbiCoder();
  // ABI Encode the first level of the mapping
  // abi.encode(address(voter), uint256(MAPPING_SLOT))
  // The keccak256 of this value will be the "slot" of the inner mapping
  const firstLevelEncoded = abiCoder.encode(
    ["address", "uint256"],
    [voter, ethers.BigNumber.from(rawSlot)],
  );

  // ABI Encode the second level of the mapping
  // abi.encode(uint256(chainId))
  const secondLevelEncoded = abiCoder.encode(
    ["uint256"],
    [ethers.BigNumber.from(chainId)],
  );

  // Compute the storage slot of [address][uint256]
  // keccak256(abi.encode(uint256(chainId)) . abi.encode(address(voter), uint256(MAPPING_SLOT)))
  return ethers.utils.keccak256(
    ethers.utils.concat([
      secondLevelEncoded,
      ethers.utils.keccak256(firstLevelEncoded),
    ]),
  );
}

export const getExtendedBlock = async (
  provider: ethers.providers.JsonRpcProvider,
  blockNumber: number,
) => {
  return provider.send("eth_getBlockByNumber", [
    ethers.BigNumber.from(blockNumber).toHexString(),
    false,
  ]);
};

export async function getBlockNumberByBlockHash(
  provider: ethers.providers.JsonRpcProvider,
  blockHash: string,
) {
  return Number((await provider.getBlock(blockHash)).number);
}

export const getProof = async (
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  storageKeys: string[],
  blockNumber: number,
) => {
  return await provider.send("eth_getProof", [
    address,
    storageKeys,
    ethers.utils.hexStripZeros(ethers.BigNumber.from(blockNumber).toHexString()),
  ]);
};

export async function getAndFormatProof({
  provider,
  userAddress,
  underlyingAsset,
  blockNumber,
  baseBalanceSlotRaw,
}: {
  provider: ethers.providers.JsonRpcProvider;
  userAddress: string;
  underlyingAsset: string;
  blockNumber: number;
  baseBalanceSlotRaw: number;
}) {
  const hashedHolderSlot = getSolidityStorageSlotBytes(
    ethers.utils.hexZeroPad(ethers.utils.hexlify(baseBalanceSlotRaw), 32),
    userAddress,
  );

  const rawProofData = await getProof(
    provider,
    underlyingAsset,
    [hashedHolderSlot],
    blockNumber,
  );

  const proof = formatToProofRLP(rawProofData.storageProof[0].proof);

  return {
    underlyingAsset,
    slot: BigInt(baseBalanceSlotRaw),
    proof,
  };
}

export async function getVotingProofs({
  provider,
  blockHash,
  balances,
  address,
  aAaveAddress,
  slots,
}: {
  provider: ethers.providers.JsonRpcProvider; // gov core provider
  blockHash: string;
  balances: BalanceForProof[];
  address: string;
  aAaveAddress: string;
  slots: AssetsBalanceSlots;
}) {
  const blockNumber = await getBlockNumberByBlockHash(provider, blockHash);
  return await Promise.all(
    balances
      .filter((balance) => balance.value !== "0")
      .map((balance) => {
        const balanceSlotRaw = getVoteBalanceSlot(
          balance.underlyingAsset,
          balance.isWithDelegatedPower,
          aAaveAddress,
          slots,
        );
        return getAndFormatProof({
          provider,
          userAddress: address,
          underlyingAsset: balance.underlyingAsset,
          baseBalanceSlotRaw: balanceSlotRaw,
          blockNumber: blockNumber,
        });
      }),
  );
}

export async function getProofOfRepresentative({
  provider,
  blockHash,
  address,
  chainId,
  aAaveAddress,
  govCoreAddress,
  slots,
}: {
  provider: ethers.providers.JsonRpcProvider; // gov core provider
  blockHash: string;
  address: string;
  chainId: number;
  aAaveAddress: string;
  govCoreAddress: string;
  slots: AssetsBalanceSlots;
}) {
  const blockNumber = await getBlockNumberByBlockHash(provider, blockHash);
  const balanceSlotRaw = getVoteBalanceSlot(
    govCoreAddress,
    false,
    aAaveAddress,
    slots,
  );
  const hexSlot = ethers.utils.hexlify(balanceSlotRaw);
  const slot = getSolidityTwoLevelStorageSlotHash(hexSlot, address, chainId);
  const rawProofData = await getProof(
    provider,
    govCoreAddress,
    [slot],
    blockNumber,
  );
  return formatToProofRLP(rawProofData.storageProof[0].proof);
}
