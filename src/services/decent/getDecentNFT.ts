import { DecentSDK, chain, crescendo, edition, zkEdition, metadataRenderer } from "@decent.xyz/sdk";
import { Signer } from 'ethers';
import axios from 'axios';
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  chainIdToChain,
  NFT_STORAGE_URL,
  DECENT_HQ,
} from './utils';

export const CONTRACT_TYPE_CRESCENDO = 'crescendo';
export const CONTRACT_TYPE_EDITION = 'edition';
export const CONTRACT_TYPE_ZK_EDITION = 'zkEdition';
export const CONTRACT_TYPES_FOR_FEATURED = [CONTRACT_TYPE_EDITION, CONTRACT_TYPE_CRESCENDO];

export const getContractDataCrescendo = async (address: string, chainId: number, signer: Signer) => {
  const sdk = new DecentSDK(chainIdToChain[chainId], signer);

  try {
    const contract = await crescendo.getContract(sdk, address);
    const [uri, price, totalSupply, saleIsActive] = await Promise.all([
      contract.uri(1),
      contract.calculateCurvedMintReturn(1, 0),
      contract.totalSupply(0),
      contract.saleIsActive()
    ]);

    const { data } = await axios.get(`${NFT_STORAGE_URL}/${uri.split('ipfs://')[1]}`);

    return {
      contract,
      metadata: data,
      price,
      totalSupply,
      saleIsActive,
      decentURL: `${DECENT_HQ}/${chainId}/Crescendo/${address}`
    };
  } catch (error) {
    console.log(error);
  }
};

export const getContractDataEdition = async (address: string, chainId: number, signer: Signer) => {
  const sdk = new DecentSDK(chainIdToChain[chainId], signer);
  try {
    const contract = await edition.getContract(sdk, address);
    const renderer = await metadataRenderer.getContract(sdk);
    const [metadataBase64, price, totalSupply, availableSupply, saleIsActive] = await Promise.all([
      renderer.tokenURITarget(0, address),
      contract.tokenPrice(),
      contract.totalSupply(),
      contract.MAX_TOKENS(),
      contract.saleIsActive()
    ]);

    let metadata = atob(metadataBase64.substring(29)).replace(/\n/g, ' ');
    metadata = JSON.parse(metadata);
    metadata.name = metadata?.properties?.name;

    return {
      contract,
      metadata,
      price,
      totalSupply,
      availableSupply,
      saleIsActive,
      decentURL: `${DECENT_HQ}/${chainId}/Editions/${address}`
    };
  } catch (error) {
    console.log(error);
  }
};

export const getContractDataZkEdition = async (address: string, chainId: number, signer: Signer) => {
  const sdk = new DecentSDK(chainIdToChain[chainId], signer);
  try {
    const contract = await zkEdition.getContract(sdk, address);
    const renderer = await metadataRenderer.getContract(sdk);
    const [metadataBase64, totalSupply, availableSupply] = await Promise.all([
      renderer.tokenURITarget(0, address),
      contract.totalSupply(),
      contract.MAX_TOKENS()
    ]);

    let metadata = atob(metadataBase64.substring(29)).replace(/\n/g, ' ');
    metadata = JSON.parse(metadata);
    metadata.name = metadata?.properties?.name;

    return {
      contract,
      metadata,
      totalSupply,
      availableSupply,
      // decentURL: `${DECENT_HQ}/${chainId}/ZkEditions/${address}`
    };
  } catch (error) {
    console.log(error);
  }
};

export const getContractData = async (address: string, chainId: number, signer: Signer, contractType: string) => {
  if (contractType === CONTRACT_TYPE_CRESCENDO) {
    return await getContractDataCrescendo(address, chainId, signer);
  } else if (contractType === CONTRACT_TYPE_EDITION) {
    return await getContractDataEdition(address, chainId, signer);
  } else if (contractType === CONTRACT_TYPE_ZK_EDITION) {
    return await getContractDataZkEdition(address, chainId, signer);
  }

  throw new Error(`getDecentNFT: invalid contract type: ${contractType}`);
};

export const useGetContractData = (options: UseQueryOptions = {}, { address, chainId, signer, contractType }) => {
  const result = useQuery<Profile[]>(
    ["useGetContractData", address],
    async () => {
      const data = await getContractData(address, chainId, signer, contractType);
      data.contractType = contractType;

      return data;
    },
    {
      ...(options as any),
      enabled: !!(address && chainId && signer && contractType),
    }
  );

  return result;
};
