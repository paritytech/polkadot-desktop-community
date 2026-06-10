import { _Enum } from 'polkadot-api';

const table = new Uint8Array(128);
for (let i = 0; i < 64; i++) table[i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205] = i;
const toBinary = (base64) => {
  const n = base64.length, bytes = new Uint8Array((n - Number(base64[n - 1] === "=") - Number(base64[n - 2] === "=")) * 3 / 4 | 0);
  for (let i2 = 0, j = 0; i2 < n; ) {
    const c0 = table[base64.charCodeAt(i2++)], c1 = table[base64.charCodeAt(i2++)];
    const c2 = table[base64.charCodeAt(i2++)], c3 = table[base64.charCodeAt(i2++)];
    bytes[j++] = c0 << 2 | c1 >> 4;
    bytes[j++] = c1 << 4 | c2 >> 2;
    bytes[j++] = c2 << 6 | c3;
  }
  return bytes;
};

const descriptorValues$b = import('./descriptors-C8akXvSo.js').then((module) => module["Dot"]);
const metadataTypes$b = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$b = {};
const extensions$b = {};
const getMetadata$c = () => import('./dot_metadata-j3FNXOHo.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$b = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3";
const _allDescriptors$b = { descriptors: descriptorValues$b, metadataTypes: metadataTypes$b, asset: asset$b, extensions: extensions$b, getMetadata: getMetadata$c, genesis: genesis$b };

const descriptorValues$a = import('./descriptors-C8akXvSo.js').then((module) => module["Dot_ah"]);
const metadataTypes$a = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$a = {};
const extensions$a = {};
const getMetadata$b = () => import('./dot_ah_metadata-BEYst3UH.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$a = "0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f";
const _allDescriptors$a = { descriptors: descriptorValues$a, metadataTypes: metadataTypes$a, asset: asset$a, extensions: extensions$a, getMetadata: getMetadata$b, genesis: genesis$a };

const descriptorValues$9 = import('./descriptors-C8akXvSo.js').then((module) => module["Dot_ppl"]);
const metadataTypes$9 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$9 = {};
const extensions$9 = {};
const getMetadata$a = () => import('./dot_ppl_metadata-voiCSdqD.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$9 = "0x67fa177a097bfa18f77ea95ab56e9bcdfeb0e5b8a40e46298bb93e16b6fc5008";
const _allDescriptors$9 = { descriptors: descriptorValues$9, metadataTypes: metadataTypes$9, asset: asset$9, extensions: extensions$9, getMetadata: getMetadata$a, genesis: genesis$9 };

const descriptorValues$8 = import('./descriptors-C8akXvSo.js').then((module) => module["Ksm"]);
const metadataTypes$8 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$8 = {};
const extensions$8 = {};
const getMetadata$9 = () => import('./ksm_metadata-CpP5qWmP.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$8 = "0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe";
const _allDescriptors$8 = { descriptors: descriptorValues$8, metadataTypes: metadataTypes$8, asset: asset$8, extensions: extensions$8, getMetadata: getMetadata$9, genesis: genesis$8 };

const descriptorValues$7 = import('./descriptors-C8akXvSo.js').then((module) => module["Ksm_ah"]);
const metadataTypes$7 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$7 = {};
const extensions$7 = {};
const getMetadata$8 = () => import('./ksm_ah_metadata-DMsyqc9c.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$7 = "0x48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a";
const _allDescriptors$7 = { descriptors: descriptorValues$7, metadataTypes: metadataTypes$7, asset: asset$7, extensions: extensions$7, getMetadata: getMetadata$8, genesis: genesis$7 };

const descriptorValues$6 = import('./descriptors-C8akXvSo.js').then((module) => module["Ksm_ppl"]);
const metadataTypes$6 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$6 = {};
const extensions$6 = {};
const getMetadata$7 = () => import('./ksm_ppl_metadata-4LV_XH8x.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$6 = "0xc1af4cb4eb3918e5db15086c0cc5ec17fb334f728b7c65dd44bfe1e174ff8b3f";
const _allDescriptors$6 = { descriptors: descriptorValues$6, metadataTypes: metadataTypes$6, asset: asset$6, extensions: extensions$6, getMetadata: getMetadata$7, genesis: genesis$6 };

const descriptorValues$5 = import('./descriptors-C8akXvSo.js').then((module) => module["Dot_col"]);
const metadataTypes$5 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$5 = {};
const extensions$5 = {};
const getMetadata$6 = () => import('./dot_col_metadata-DLTGJRYI.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$5 = "0x46ee89aa2eedd13e988962630ec9fb7565964cf5023bb351f2b6b25c1b68b0b2";
const _allDescriptors$5 = { descriptors: descriptorValues$5, metadataTypes: metadataTypes$5, asset: asset$5, extensions: extensions$5, getMetadata: getMetadata$6, genesis: genesis$5 };

const descriptorValues$4 = import('./descriptors-C8akXvSo.js').then((module) => module["Wnd"]);
const metadataTypes$4 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$4 = {};
const extensions$4 = {};
const getMetadata$5 = () => import('./wnd_metadata-MDu_kwHE.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$4 = "0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e";
const _allDescriptors$4 = { descriptors: descriptorValues$4, metadataTypes: metadataTypes$4, asset: asset$4, extensions: extensions$4, getMetadata: getMetadata$5, genesis: genesis$4 };

const descriptorValues$3 = import('./descriptors-C8akXvSo.js').then((module) => module["Wnd_ah"]);
const metadataTypes$3 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$3 = {};
const extensions$3 = {};
const getMetadata$4 = () => import('./wnd_ah_metadata-COJ-ovvr.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$3 = "0x67f9723393ef76214df0118c34bbbd3dbebc8ed46a10973a8c969d48fe7598c9";
const _allDescriptors$3 = { descriptors: descriptorValues$3, metadataTypes: metadataTypes$3, asset: asset$3, extensions: extensions$3, getMetadata: getMetadata$4, genesis: genesis$3 };

const descriptorValues$2 = import('./descriptors-C8akXvSo.js').then((module) => module["Paseo_asset_hub"]);
const metadataTypes$2 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$2 = {};
const extensions$2 = {};
const getMetadata$3 = () => import('./paseo_asset_hub_metadata-BCa0mvnX.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$2 = "0xbf0488dbe9daa1de1c08c5f743e26fdc2a4ecd74cf87dd1b4b1eeb99ae4ef19f";
const _allDescriptors$2 = { descriptors: descriptorValues$2, metadataTypes: metadataTypes$2, asset: asset$2, extensions: extensions$2, getMetadata: getMetadata$3, genesis: genesis$2 };

const descriptorValues$1 = import('./descriptors-C8akXvSo.js').then((module) => module["Paseo"]);
const metadataTypes$1 = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$1 = {};
const extensions$1 = {};
const getMetadata$2 = () => import('./paseo_metadata-BvOfU8Ms.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$1 = "0x77afd6190f1554ad45fd0d31aee62aacc33c6db0ea801129acb813f913e0764f";
const _allDescriptors$1 = { descriptors: descriptorValues$1, metadataTypes: metadataTypes$1, asset: asset$1, extensions: extensions$1, getMetadata: getMetadata$2, genesis: genesis$1 };

const descriptorValues = import('./descriptors-C8akXvSo.js').then((module) => module["Bulletin_paseo"]);
const metadataTypes = import('./metadataTypes-DLi53ffc.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset = {};
const extensions = {};
const getMetadata$1 = () => import('./bulletin_paseo_metadata-CtL8fKr5.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis = "0x744960c32e3a3df5440e1ecd4d34096f1ce2230d7016a5ada8a765d5a622b4ea";
const _allDescriptors = { descriptors: descriptorValues, metadataTypes, asset, extensions, getMetadata: getMetadata$1, genesis };

const DigestItem = _Enum;
const Phase = _Enum;
const DispatchClass = _Enum;
const TokenError = _Enum;
const ArithmeticError = _Enum;
const TransactionalError = _Enum;
const PreimageEvent = _Enum;
const BalanceStatus = _Enum;
const PreimagePalletHoldReason = _Enum;
const TransactionPaymentEvent = _Enum;
const StakingRewardDestination = _Enum;
const StakingForcing = _Enum;
const OffencesEvent = _Enum;
const GrandpaEvent = _Enum;
const XcmV3Junctions = _Enum;
const XcmV3Junction = _Enum;
const XcmV3JunctionNetworkId = _Enum;
const XcmV3JunctionBodyId = _Enum;
const XcmV2JunctionBodyPart = _Enum;
const XcmV3MultiassetAssetId = _Enum;
const XcmV5Junctions = _Enum;
const XcmV5Junction = _Enum;
const XcmV5NetworkId = _Enum;
const XcmVersionedLocation = _Enum;
const ConvictionVotingVoteAccountVote = _Enum;
const PreimagesBounded = _Enum;
const CommonClaimsEvent = _Enum;
const ChildBountiesEvent = _Enum;
const ElectionProviderMultiPhaseEvent = _Enum;
const ElectionProviderMultiPhaseElectionCompute = _Enum;
const ElectionProviderMultiPhasePhase = _Enum;
const BagsListEvent = _Enum;
const NominationPoolsPoolState = _Enum;
const NominationPoolsCommissionClaimPermission = _Enum;
const NominationPoolsClaimPermission = _Enum;
const ParachainsHrmpEvent = _Enum;
const ParachainsDisputesEvent = _Enum;
const ParachainsDisputeLocation = _Enum;
const ParachainsDisputeResult = _Enum;
const CommonParasRegistrarEvent = _Enum;
const CommonSlotsEvent = _Enum;
const CommonAuctionsEvent = _Enum;
const PolkadotRuntimeParachainsCoretimeEvent = _Enum;
const XcmV5Instruction = _Enum;
const XcmV3MultiassetFungibility = _Enum;
const XcmV3MultiassetAssetInstance = _Enum;
const XcmV3MaybeErrorCode = _Enum;
const XcmV2OriginKind = _Enum;
const XcmV5AssetFilter = _Enum;
const XcmV5WildAsset = _Enum;
const XcmV2MultiassetWildFungibility = _Enum;
const XcmV3WeightLimit = _Enum;
const XcmVersionedAssets = _Enum;
const ParachainsInclusionAggregateMessageOrigin = _Enum;
const ParachainsInclusionUmpQueueId = _Enum;
const GovernanceOrigin = _Enum;
const ParachainsOrigin = _Enum;
const PreimageOldRequestStatus = _Enum;
const PreimageRequestStatus = _Enum;
const BabeDigestsNextConfigDescriptor = _Enum;
const BabeAllowedSlots = _Enum;
const BabeDigestsPreDigest = _Enum;
const BalancesTypesReasons = _Enum;
const WestendRuntimeRuntimeFreezeReason = _Enum;
const NominationPoolsPalletFreezeReason = _Enum;
const TransactionPaymentReleases = _Enum;
const GrandpaStoredState = _Enum;
const TreasuryPaymentState = _Enum;
const ConvictionVotingVoteVoting = _Enum;
const VotingConviction = _Enum;
const TraitsScheduleDispatchTime = _Enum;
const ClaimsStatementKind = _Enum;
const Version = _Enum;
const ChildBountyStatus = _Enum;
const PolkadotPrimitivesV6PvfPrepKind = _Enum;
const PvfExecKind = _Enum;
const ValidityAttestation = _Enum;
const PolkadotPrimitivesV6DisputeStatement = _Enum;
const PolkadotPrimitivesV6ValidDisputeStatementKind = _Enum;
const InvalidDisputeStatementKind = _Enum;
const BrokerCoretimeInterfaceCoreAssignment = _Enum;
const ParachainsParasParaLifecycle = _Enum;
const UpgradeGoAhead = _Enum;
const UpgradeRestriction = _Enum;
const CommonCrowdloanLastContribution = _Enum;
const XcmV3Response = _Enum;
const XcmV3TraitsError = _Enum;
const XcmV4Response = _Enum;
const XcmPalletVersionMigrationStage = _Enum;
const XcmVersionedAssetId = _Enum;
const ReferendaTypesCurve = _Enum;
const MultiAddress = _Enum;
const BalancesAdjustmentDirection = _Enum;
const StakingPalletConfigOpBig = _Enum;
const StakingPalletConfigOp = _Enum;
const GrandpaEquivocation = _Enum;
const NominationPoolsBondExtra = _Enum;
const NominationPoolsConfigOp = _Enum;
const XcmVersionedXcm = _Enum;
const XcmV3Instruction = _Enum;
const XcmV3MultiassetMultiAssetFilter = _Enum;
const XcmV3MultiassetWildMultiAsset = _Enum;
const XcmV4Instruction = _Enum;
const XcmV4AssetAssetFilter = _Enum;
const XcmV4AssetWildAsset = _Enum;
const TransactionValidityUnknownTransaction = _Enum;
const TransactionValidityTransactionSource = _Enum;
const OccupiedCoreAssumption = _Enum;
const SlashingOffenceKind = _Enum;
const MmrPrimitivesError = _Enum;
const XcmVersionedAsset = _Enum;
const IdentityJudgement = _Enum;
const IdentityData = _Enum;
const PolkadotRuntimeCommonAssignedSlotsEvent = _Enum;
const RootTestingEvent = _Enum;
const PolkadotRuntimeCommonIdentityMigratorEvent = _Enum;
const PolkadotRuntimeCommonAssignedSlotsSlotLeasePeriodStart = _Enum;
const ExtensionsCheckMortality = _Enum;

const metadatas = {
  ["0x6e8df549e3c17a4aa26693347b7b9146ea5966e3a56f7ce9d0df4a37d6702778"]: _allDescriptors$b,
  ["0xb160d880adc0954728ebd255ba4d8b28266fae3b564d82670a486c5c63028778"]: _allDescriptors$a,
  ["0x3f0652ba1159157eff567b8e0e5987c8fc67a614f0909ce0f65f0d8a2b532864"]: _allDescriptors$9,
  ["0x6434f13616e65084d99b48eb9e729696a19d0807c99eb2d6df566bf8bad084ab"]: _allDescriptors$8,
  ["0x75086dc1a829e7a39bef2398d082e29adb23511defe35fd26a829798af49942b"]: _allDescriptors$7,
  ["0x75b13346b8ee5488fcc7486397469043ce0887169baf884f8c97fd986c3e4510"]: _allDescriptors$6,
  ["0xee8cd77687e33d5f970e49e9c8da5a2dc610c7e87669ae13c56f5fecf0eae63b"]: _allDescriptors$5,
  ["0x5696d6b40ab273fe9ec77f8f0bf203962663519674fd69000a6a1f3370a11c0e"]: _allDescriptors$4,
  ["0x05fd17071c955a0648780614559a2c9e128cfd8e7607197950ab8cd1ba150a3d"]: _allDescriptors$3,
  ["0x5083c186e4218b420a12dbb26b3624befa233185adff12d5edf68e3a320518a3"]: _allDescriptors$2,
  ["0x78abd479e98f6160fc03a2377aa083c10dac2304ca348b3e9620c1dc61cfa0a3"]: _allDescriptors$1,
  ["0xd248224df107ca81267a5a4d0671bb9618dbb1a43fae7fad6ba2331a45a10ac5"]: _allDescriptors
};
const getMetadata = async (codeHash) => {
  try {
    return await metadatas[codeHash].getMetadata();
  } catch {
  }
  return null;
};

export { ArithmeticError, BabeAllowedSlots, BabeDigestsNextConfigDescriptor, BabeDigestsPreDigest, BagsListEvent, BalanceStatus, BalancesAdjustmentDirection, BalancesTypesReasons, BrokerCoretimeInterfaceCoreAssignment, ChildBountiesEvent, ChildBountyStatus, ClaimsStatementKind, CommonAuctionsEvent, CommonClaimsEvent, CommonCrowdloanLastContribution, CommonParasRegistrarEvent, CommonSlotsEvent, ConvictionVotingVoteAccountVote, ConvictionVotingVoteVoting, DigestItem, DispatchClass, ElectionProviderMultiPhaseElectionCompute, ElectionProviderMultiPhaseEvent, ElectionProviderMultiPhasePhase, ExtensionsCheckMortality, GovernanceOrigin, GrandpaEquivocation, GrandpaEvent, GrandpaStoredState, IdentityData, IdentityJudgement, InvalidDisputeStatementKind, MmrPrimitivesError, MultiAddress, NominationPoolsBondExtra, NominationPoolsClaimPermission, NominationPoolsCommissionClaimPermission, NominationPoolsConfigOp, NominationPoolsPalletFreezeReason, NominationPoolsPoolState, OccupiedCoreAssumption, OffencesEvent, ParachainsDisputeLocation, ParachainsDisputeResult, ParachainsDisputesEvent, ParachainsHrmpEvent, ParachainsInclusionAggregateMessageOrigin, ParachainsInclusionUmpQueueId, ParachainsOrigin, ParachainsParasParaLifecycle, Phase, PolkadotPrimitivesV6DisputeStatement, PolkadotPrimitivesV6PvfPrepKind, PolkadotPrimitivesV6ValidDisputeStatementKind, PolkadotRuntimeCommonAssignedSlotsEvent, PolkadotRuntimeCommonAssignedSlotsSlotLeasePeriodStart, PolkadotRuntimeCommonIdentityMigratorEvent, PolkadotRuntimeParachainsCoretimeEvent, PreimageEvent, PreimageOldRequestStatus, PreimagePalletHoldReason, PreimageRequestStatus, PreimagesBounded, PvfExecKind, ReferendaTypesCurve, RootTestingEvent, SlashingOffenceKind, StakingForcing, StakingPalletConfigOp, StakingPalletConfigOpBig, StakingRewardDestination, TokenError, TraitsScheduleDispatchTime, TransactionPaymentEvent, TransactionPaymentReleases, TransactionValidityTransactionSource, TransactionValidityUnknownTransaction, TransactionalError, TreasuryPaymentState, UpgradeGoAhead, UpgradeRestriction, ValidityAttestation, Version, VotingConviction, WestendRuntimeRuntimeFreezeReason, XcmPalletVersionMigrationStage, XcmV2JunctionBodyPart, XcmV2MultiassetWildFungibility, XcmV2OriginKind, XcmV3Instruction, XcmV3Junction, XcmV3JunctionBodyId, XcmV3JunctionNetworkId, XcmV3Junctions, XcmV3MaybeErrorCode, XcmV3MultiassetAssetId, XcmV3MultiassetAssetInstance, XcmV3MultiassetFungibility, XcmV3MultiassetMultiAssetFilter, XcmV3MultiassetWildMultiAsset, XcmV3Response, XcmV3TraitsError, XcmV3WeightLimit, XcmV4AssetAssetFilter, XcmV4AssetWildAsset, XcmV4Instruction, XcmV4Response, XcmV5AssetFilter, XcmV5Instruction, XcmV5Junction, XcmV5Junctions, XcmV5NetworkId, XcmV5WildAsset, XcmVersionedAsset, XcmVersionedAssetId, XcmVersionedAssets, XcmVersionedLocation, XcmVersionedXcm, _allDescriptors as bulletin_paseo, _allDescriptors$b as dot, _allDescriptors$a as dot_ah, _allDescriptors$5 as dot_col, _allDescriptors$9 as dot_ppl, getMetadata, _allDescriptors$8 as ksm, _allDescriptors$7 as ksm_ah, _allDescriptors$6 as ksm_ppl, _allDescriptors$1 as paseo, _allDescriptors$2 as paseo_asset_hub, _allDescriptors$4 as wnd, _allDescriptors$3 as wnd_ah };
