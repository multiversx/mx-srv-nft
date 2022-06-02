import { CollectionAssetApi } from './collection.dto';

export interface Nft {
  collection: string;
  identifier: string;
  name: string;
  type: string;
  owner: string;
  minted: string;
  burnt: string;
  decimals: number;
  isPaused: boolean;
  canUpgrade: boolean;
  canMint: boolean;
  canBurn: boolean;
  canChangeOwner: boolean;
  canPause: boolean;
  canFreeze: boolean;
  canWipe: boolean;
  canAddSpecialRoles: boolean;
  canTransferNFTCreateRole: boolean;
  isWhitelistedStorage: boolean;
  wiped: string;
  attributes: string;
  balance: string;
  supply: string;
  creator: string;
  hash: string;
  nonce: number;
  royalties: string;
  timestamp: number;
  uris: string[];
  tags: string[];
  metadata: NftMetadata;
  media: NftMedia[];
  scamInfo: NftScamInfo;
  assets: CollectionAssetApi;
}

export interface NftMedia {
  url: string;
  originalUrl: string;
  thumbnailUrl: string;
  fileType: string;
  fileSize;
}

export interface NftScamInfo {
  type: string;
  info: string;
}

export interface NftMetadata {
  description: string;
  rarity: NftRarity;
  attributes: [{ [key: string]: string }];
}

export interface NftRarity {
  avgRarity: number;
  statRarity: number;
  rarityScore: number;
  rarityScoreNormed: number;
  usedTraitsCount: number;
}
