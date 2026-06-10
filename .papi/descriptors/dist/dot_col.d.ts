import { StorageDescriptor, PlainDescriptor, TxDescriptor, RuntimeDescriptor, Enum, ApisFromDef, QueryFromPalletsDef, TxFromPalletsDef, EventsFromPalletsDef, ErrorsFromPalletsDef, ConstFromPalletsDef, ViewFnsFromPalletsDef, SS58String, SizedHex, FixedSizeArray } from "polkadot-api";
import type { I5sesotjlssv2d, Iffmde3ekjedi9, I4mddgoa69c0a2, I8slk03dsp75nf, I95g6i7ilua7lq, Ieniouoqkq4icf, Phase, Ibgl04rn6nbfm6, I4q39t5hn830vp, I8re9183nrhr3n, I1v7jbnil3tjns, I8jgj1nhcr2dg8, Ifn6q3equiq9qi, Ia3sb0vgvovhtg, Iav8k1edbj86k7, Itom7fk49o0c9, I4i91h98n3cv1b, I4iumukclgj8ej, Iqnbvitf7a7l3, I48i407regf59r, I6r5cbv8ttrb09, I9gacsa7nt0s25, I1q8tnt1cluu5j, I8ds64oj6581v0, Ia7pdug7cdsg8g, I64d8k4gel34fg, I9bin2jc70qt6q, TransactionPaymentReleases, Ia2lhg7l2hilo3, Ifi4da1gej1fri, Ifvgo9568rpmqc, I82jm9g7pufuel, Ic5m5lp1oioo8r, I6cs1itejju2vv, Icgljjb6j82uhn, I9pvau8qut93lg, I5g2vv0ckl2m8b, Ifup3lg9ro8a0f, I5qfubnuvrnqn6, I8t3u2dv73ahbd, I7vlvrrl2pnbgk, Ie0rpl5bahldfk, XcmPalletVersionMigrationStage, I7e5oaj2qi4kl1, Ie849h3gncgvok, Iat62vud7hlod2, Ict03eedr8de9s, Ibkm2gcn4pji30, XcmVersionedLocation, Idh2ug6ou4a8og, Iejeo53sea6n4q, I53esa2ms463bk, Ib4jhb8tt3uung, Iag146hmjgqfgj, I8uo3fpd3bcc6f, If6n5it43h5lo7, I9p9lq3rej5bhc, PreimageOldRequestStatus, PreimageRequestStatus, I4pact7n2e9a0i, Ieiuv359ridbmg, I56u24ncejr5kt, I9jd27rnpm8ttv, I2q3ri6itcjj5u, I982189ri79b4u, I26e9b3ail50ji, Iee1c44rpikfmk, I7amu2774tu62e, Ifvqn3ldat80ai, I99bb69usss9gs, I7svnfko10tq2e, I3gg47bgkgq9tr, I70rn7tl6dsdj2, I6qcggph46iog7, Iq1c24rdj7v7p, I9uq9b728jtlkj, Idg0lipm04tfnv, I34qfon4stjc0g, Iegmj7n48sc3am, I3s9vvjt0el98d, In7a38730s6qs, Ibtil0ss5munbk, I9s0ave7t0vnrk, I4fo08joqmcqnm, XcmV5Junctions, Iasb8k6ash5mjn, Ibafpkl9hhno69, I8ofcg5rbj0g2c, I4adgbll7gku4i, I6pjjpfvhvcfru, I9pj91mj79qekl, I39uah9nss64h9, Ik64dknsq7k08, Ib51vk42m1po4n, Ial23jn8hp0aen, Ifpj261e8s63m3, Idcr6u6361oad9, I4ktuaksf5i1gk, I9bqtpv2ii35mp, I9j7pagd6d4bda, I2h9pmio37r7fb, Ibmr18suc9ikh9, I9iq22t0burs89, I5u8olqbbvfnvf, I5utcetro501ir, Ifccifqltb5obi, Iadtsfv699cq8b, Ialpmgmhr3gk5r, I4cbvqmqadhrea, I3sdol54kg5jaq, I8fougodaj6di6, I81vt5eq60l4b6, I3vh014cqgmrfd, Ia5cotcvi888ln, I21jsa919m88fd, Iegif7m3upfe1k, I9kt8c221c83ln, Ic76kfh5ebqkpl, Icscpmubum33bq, I21d2olof7eb60, Ibgm4rnf22lal1, Ie68np0vpihith, I9bnv6lu0crf1q, Iauhjqifrdklq7, Ie1uso9m8rt5cf, I40pqum1mu8qg3, I1r4c2ghbtvjuc, I2eo57miukmm8b, Ic6go0lokd61vu, I75gjumrbf7721, I6615brjv6tue2, I95rdeeh0vpq7r, I2c4n6ll6fucck, I5ap28jt3ngolg, Ideaemvoneh309, I3d9o9d7epp66v, I6lqh1vgb4mcja, I63fta9lljd740, Ieo0t3g18srm0g, I9jcbqm9l47vmu, I6j9khqhmttlmc, I2eb501t8s6hsq, Ianmuoljk2sk1u, I4ro3h76fk8qmr, I82nfqfkd48n10, I1jm8m1rh9e20v, I3o5j3bli1pd8e, I8sn7103tnqt7i, I5n4sebgkfr760, Ibett4ik8t9cia, Ifs1i5fk9cqvr6, I3kkq7pse0860j, I53mj6mot6nvhu, Ieg3fd8p4pkt10, I8kg5ll427kfqq, I467333262q1l9, I9c4d50jrp7as1, Ifplevr9hp8jo3, I9lf8a927r9bdc, I2dtrijkm5601t, Ia61kag3grdevk, Icq0crsj7vrl4j, I465k81tqg3usk, I54d7mcgvp9b3a, I59bngqm85b22v, Ifh7bf8l1mktj3, Ickqr13ag0mv3c, Ib2obgji960euh, I38jfk5li8iang, Icp4mrre3jvd64, I2ev73t79f46tb, I3amdclkdfaipk, I8bvk21lpmah75, I449n3riv6jbum, I9a7qiue67urvk, I1121uie4s8u64, I666bl2fqjkejo, Icbio0e1f0034b, I8c0vkqjjipnuj, I5mruatkavn9hn, I27vrusv8rgd90, Ic79d2eioda33s, I5kpe8b2kedtqn, I5il2eoab4j61e, Idt0cq08n4po4d, I8ligieds2efci, Icnrv1mfbd3in1, Icm9m0qeemu66d, I3pnhorh539dti, Ia82mnkmeo2rhc, I21127ofgtqu6k, Icbccs0ug47ilf, I855j4i3kr8ko1, Iise13kk6jn9t, Idd7hd99u0ho0n, Iafscmv8tjf0ou, I100l07kaehdlp, I6gnbnvip5vvdi, Icv68aq8841478, Ic262ibdoec56a, Iflcfm9b6nlmdd, Ijrsf4mnp3eka, Id5fm4p8lj5qgi, I8tjvj9uq4b7hi, I3qt1hgg4djhgb, I4fooe9dun9o0t, I94rlea5gdnfo3, Ifa9o21hgt3j2f, I599q9qkrmqlb, Iph9c4rn81ub2, Ier2cke86dqbr2, I39t01nnod9109, I6v8sm60vvkmk7, I1qmtmbe5so8r3, Ih99m6ehpcar7, Idgorhsbgdq2ap, I9ubb2kqevnu6t, I2hq50pu2kdjpo, I9acqruh7322g2, I137t1cld92pod, I61d51nv4cou88, If8u5kl4h8070m, Ibmuil6p3vl83l, I7lul91g50ae87, Icl7nl1rfeog3i, Iasr6pj6shs0fl, I2uqmls7kcdnii, Idg69klialbkb8, I7r6b7145022pp, I30pg328m00nr3, Icmrn7bogp28cs, I7m9b5plj4h5ot, I9onhk772nfs4f, I3l6bnksrmt56r, Idh09k0l2pmdcg, I7uoiphbm0tj4r, I512p1n7qt24l8, I6s1nbislhk619, I3gghqnh2mj0is, I6iv852roh6t3h, I9oc2o6itbiopq, Ibslgga81p36aa, I1rvj4ubaplho0, Ia3uu7lqcc1q1i, I7crucfnonitkn, I7tmrp94r9sq4n, I46cr4rcv02bd, I2kgtj06e3t0io, I390bno483djkg, I4rp5raanj4h2f, Iep27ialq4a7o7, Iasu5jvoqr43mv, I7j36mi5eclre9, I5qolde99acmd1, I8gtde5abn1g9a, Ifr2nmnf0cistq, I6pf8rhdm8fo17, I2ur0oeqg495j8, I56kctcqjaugbp, I1bhd210c3phjj, Icmuiqav70h6lm, Ia3c82eadg79bj, Ienusoeb625ftq, Ibtsa3docbr9el, Idrugh2blv81ia, I79vua51vqq0mc, I3trq1j79d9t1e, Ie3gphha4ejh40, Iafhd8kv029rqj, I2mcnoj31i9be1, I9dapsurd7u7ga, I8uij7nmvtb96e, Ift6f10887nk72, I7qc53b1tvqjg2, I9n15sljqnkta7, Iak7fhrgb9jnnq, I9ad1o9mv4cm3, Im1pm2vf6llcn, I21jsoeb0o6476, Ier6ck0tpfo7, I229ijht536qdu, I62nte77gksm0f, Ic6ecdcp9ut7jd, I27notaksll8qt, I4f1hv034jf1dt, I9j3uq1uk06oju, I2t83mr73603p9, Ibas6o69e1qaqo, I4vcrhqupmee7p, I8iksqi3eani0a, I16enopmju1p0q, I43kq8qudg7pq9, I76riseemre533, Ie5v6njpckr05b, I38bmcrmh852rk, I4hcillge8de5f, I2cftk5tgrglaa, Iek7v4hrgnq6iv, I5r8t4iaend96p, Ibgsn3hr1i3gjh, Iaqet9jc3ihboe, Ic952bubvq4k7d, I2v50gu3s1aqk6, Iabpgqcjikia83, Ibkog8f7nenpg4, If7uv525tdvv7a, I2an1fs2eiebjp, TransactionValidityTransactionSource, I9ask1o4tfvcvs, I4ph3d1eepnmr1, Icerf8h8pdu8ss, I4gil44d08grh, I7u915mvkdsb08, I6spmpef2c7svf, Iei2mvq0mjvt81, Iftvbctbo05fu4, XcmVersionedXcm, Ic0c3req3mlc1l, XcmVersionedAssetId, I7ocn4njqde3v5, Iek7ha36da9mf5, I7rsllqn1av13r, Iarfsrg84usklg, Ib9kvfbnra4spu, Ieh6nis3hdbtgi, XcmVersionedAsset, Icujp6hmv35vbn, I4tjame31218k9, I5gif8vomct5i8, Ic1d4u2opv3fst, Ie9sr1iqcg3cgm, I1mqgk2tmnn9i2, I6lr8sctk0bi4e, Isk3k9e5dj7oh } from "./common-types";
type AnonymousEnum<T extends {}> = T & {
    __anonymous: true;
};
type MyTuple<T> = [T, ...T[]];
type SeparateUndefined<T> = undefined extends T ? undefined | Exclude<T, undefined> : T;
type Anonymize<T> = SeparateUndefined<T extends string | number | bigint | boolean | void | undefined | null | symbol | Uint8Array | Enum<any> ? T : T extends AnonymousEnum<infer V> ? Enum<V> : T extends MyTuple<any> ? {
    [K in keyof T]: T[K];
} : T extends [] ? [] : T extends FixedSizeArray<infer L, infer T> ? number extends L ? Array<T> : FixedSizeArray<L, T> : {
    [K in keyof T & string]: T[K];
}>;
type IStorage = {
    System: {
        /**
         * The full account information for a particular account ID.
         */
        Account: StorageDescriptor<[Key: SS58String], Anonymize<I5sesotjlssv2d>, false, never>;
        /**
         * Total extrinsics count for the current block.
         */
        ExtrinsicCount: StorageDescriptor<[], number, true, never>;
        /**
         * Whether all inherents have been applied.
         */
        InherentsApplied: StorageDescriptor<[], boolean, false, never>;
        /**
         * The current weight for the block.
         */
        BlockWeight: StorageDescriptor<[], Anonymize<Iffmde3ekjedi9>, false, never>;
        /**
         * Total size (in bytes) of the current block.
         *
         * Tracks the size of the header and all extrinsics.
         */
        BlockSize: StorageDescriptor<[], number, true, never>;
        /**
         * Map of block numbers to block hashes.
         */
        BlockHash: StorageDescriptor<[Key: number], SizedHex<32>, false, never>;
        /**
         * Extrinsics data for the current block (maps an extrinsic's index to its data).
         */
        ExtrinsicData: StorageDescriptor<[Key: number], Uint8Array, false, never>;
        /**
         * The current block number being processed. Set by `execute_block`.
         */
        Number: StorageDescriptor<[], number, false, never>;
        /**
         * Hash of the previous block.
         */
        ParentHash: StorageDescriptor<[], SizedHex<32>, false, never>;
        /**
         * Digest of the current block, also part of the block header.
         */
        Digest: StorageDescriptor<[], Anonymize<I4mddgoa69c0a2>, false, never>;
        /**
         * Events deposited for the current block.
         *
         * NOTE: The item is unbound and should therefore never be read on chain.
         * It could otherwise inflate the PoV size of a block.
         *
         * Events have a large in-memory size. Box the events to not go out-of-memory
         * just in case someone still reads them from within the runtime.
         */
        Events: StorageDescriptor<[], Anonymize<I8slk03dsp75nf>, false, never>;
        /**
         * The number of events in the `Events<T>` list.
         */
        EventCount: StorageDescriptor<[], number, false, never>;
        /**
         * Mapping between a topic (represented by T::Hash) and a vector of indexes
         * of events in the `<Events<T>>` list.
         *
         * All topic vectors have deterministic storage locations depending on the topic. This
         * allows light-clients to leverage the changes trie storage tracking mechanism and
         * in case of changes fetch the list of events of interest.
         *
         * The value has the type `(BlockNumberFor<T>, EventIndex)` because if we used only just
         * the `EventIndex` then in case if the topic has the same contents on the next block
         * no notification will be triggered thus the event might be lost.
         */
        EventTopics: StorageDescriptor<[Key: SizedHex<32>], Anonymize<I95g6i7ilua7lq>, false, never>;
        /**
         * Stores the `spec_version` and `spec_name` of when the last runtime upgrade happened.
         */
        LastRuntimeUpgrade: StorageDescriptor<[], Anonymize<Ieniouoqkq4icf>, true, never>;
        /**
         * Number of blocks till the pending code upgrade is applied.
         */
        BlocksTillUpgrade: StorageDescriptor<[], number, true, never>;
        /**
         * True if we have upgraded so that `type RefCount` is `u32`. False (default) if not.
         */
        UpgradedToU32RefCount: StorageDescriptor<[], boolean, false, never>;
        /**
         * True if we have upgraded so that AccountInfo contains three types of `RefCount`. False
         * (default) if not.
         */
        UpgradedToTripleRefCount: StorageDescriptor<[], boolean, false, never>;
        /**
         * The execution phase of the block.
         */
        ExecutionPhase: StorageDescriptor<[], Phase, true, never>;
        /**
         * `Some` if a code upgrade has been authorized.
         */
        AuthorizedUpgrade: StorageDescriptor<[], Anonymize<Ibgl04rn6nbfm6>, true, never>;
        /**
         * The weight reclaimed for the extrinsic.
         *
         * This information is available until the end of the extrinsic execution.
         * More precisely this information is removed in `note_applied_extrinsic`.
         *
         * Logic doing some post dispatch weight reduction must update this storage to avoid duplicate
         * reduction.
         */
        ExtrinsicWeightReclaimed: StorageDescriptor<[], Anonymize<I4q39t5hn830vp>, false, never>;
    };
    ParachainSystem: {
        /**
         * The current block weight mode.
         *
         * This is used to determine what is the maximum allowed block weight, for more information see
         * [`block_weight`].
         *
         * Killed in [`Self::on_initialize`] and set by the [`block_weight`] logic.
         */
        BlockWeightMode: StorageDescriptor<[], Anonymize<I8re9183nrhr3n>, true, never>;
        /**
         * The core count available to the parachain in the previous block.
         *
         * This is mainly used for offchain functionality to calculate the correct target block weight.
         */
        PreviousCoreCount: StorageDescriptor<[], number, true, never>;
        /**
         * Latest included block descendants the runtime accepted. In other words, these are
         * ancestors of the currently executing block which have not been included in the observed
         * relay-chain state.
         *
         * The segment length is limited by the capacity returned from the [`ConsensusHook`] configured
         * in the pallet.
         */
        UnincludedSegment: StorageDescriptor<[], Anonymize<I1v7jbnil3tjns>, false, never>;
        /**
         * Storage field that keeps track of bandwidth used by the unincluded segment along with the
         * latest HRMP watermark. Used for limiting the acceptance of new blocks with
         * respect to relay chain constraints.
         */
        AggregatedUnincludedSegment: StorageDescriptor<[], Anonymize<I8jgj1nhcr2dg8>, true, never>;
        /**
         * In case of a scheduled upgrade, this storage field contains the validation code to be
         * applied.
         *
         * As soon as the relay chain gives us the go-ahead signal, we will overwrite the
         * [`:pending_code`][sp_core::storage::well_known_keys::PENDING_CODE] which will result the
         * next block to be processed with the new validation code. This concludes the upgrade process.
         */
        PendingValidationCode: StorageDescriptor<[], Uint8Array, false, never>;
        /**
         * Validation code that is set by the parachain and is to be communicated to collator and
         * consequently the relay-chain.
         *
         * This will be cleared in `on_initialize` of each new block if no other pallet already set
         * the value.
         */
        NewValidationCode: StorageDescriptor<[], Uint8Array, true, never>;
        /**
         * The [`PersistedValidationData`] set for this block.
         *
         * This value is expected to be set only once by the [`Pallet::set_validation_data`] inherent.
         */
        ValidationData: StorageDescriptor<[], Anonymize<Ifn6q3equiq9qi>, true, never>;
        /**
         * Were the validation data set to notify the relay chain?
         */
        DidSetValidationCode: StorageDescriptor<[], boolean, false, never>;
        /**
         * The relay chain block number associated with the last parachain block.
         *
         * This is updated in `on_finalize`.
         */
        LastRelayChainBlockNumber: StorageDescriptor<[], number, false, never>;
        /**
         * An option which indicates if the relay-chain restricts signalling a validation code upgrade.
         * In other words, if this is `Some` and [`NewValidationCode`] is `Some` then the produced
         * candidate will be invalid.
         *
         * This storage item is a mirror of the corresponding value for the current parachain from the
         * relay-chain. This value is ephemeral which means it doesn't hit the storage. This value is
         * set after the inherent.
         */
        UpgradeRestrictionSignal: StorageDescriptor<[], Anonymize<Ia3sb0vgvovhtg>, false, never>;
        /**
         * Optional upgrade go-ahead signal from the relay-chain.
         *
         * This storage item is a mirror of the corresponding value for the current parachain from the
         * relay-chain. This value is ephemeral which means it doesn't hit the storage. This value is
         * set after the inherent.
         */
        UpgradeGoAhead: StorageDescriptor<[], Anonymize<Iav8k1edbj86k7>, false, never>;
        /**
         * The state proof for the last relay parent block.
         *
         * This field is meant to be updated each block with the validation data inherent. Therefore,
         * before processing of the inherent, e.g. in `on_initialize` this data may be stale.
         *
         * This data is also absent from the genesis.
         */
        RelayStateProof: StorageDescriptor<[], Anonymize<Itom7fk49o0c9>, true, never>;
        /**
         * The snapshot of some state related to messaging relevant to the current parachain as per
         * the relay parent.
         *
         * This field is meant to be updated each block with the validation data inherent. Therefore,
         * before processing of the inherent, e.g. in `on_initialize` this data may be stale.
         *
         * This data is also absent from the genesis.
         */
        RelevantMessagingState: StorageDescriptor<[], Anonymize<I4i91h98n3cv1b>, true, never>;
        /**
         * The parachain host configuration that was obtained from the relay parent.
         *
         * This field is meant to be updated each block with the validation data inherent. Therefore,
         * before processing of the inherent, e.g. in `on_initialize` this data may be stale.
         *
         * This data is also absent from the genesis.
         */
        HostConfiguration: StorageDescriptor<[], Anonymize<I4iumukclgj8ej>, true, never>;
        /**
         * The last downward message queue chain head we have observed.
         *
         * This value is loaded before and saved after processing inbound downward messages carried
         * by the system inherent.
         */
        LastDmqMqcHead: StorageDescriptor<[], SizedHex<32>, false, never>;
        /**
         * The message queue chain heads we have observed per each channel incoming channel.
         *
         * This value is loaded before and saved after processing inbound downward messages carried
         * by the system inherent.
         */
        LastHrmpMqcHeads: StorageDescriptor<[], Anonymize<Iqnbvitf7a7l3>, false, never>;
        /**
         * Number of downward messages processed in a block.
         *
         * This will be cleared in `on_initialize` of each new block.
         */
        ProcessedDownwardMessages: StorageDescriptor<[], number, false, never>;
        /**
         * The last processed downward message.
         *
         * We need to keep track of this to filter the messages that have been already processed.
         */
        LastProcessedDownwardMessage: StorageDescriptor<[], Anonymize<I48i407regf59r>, true, never>;
        /**
         * HRMP watermark that was set in a block.
         */
        HrmpWatermark: StorageDescriptor<[], number, false, never>;
        /**
         * The last processed HRMP message.
         *
         * We need to keep track of this to filter the messages that have been already processed.
         */
        LastProcessedHrmpMessage: StorageDescriptor<[], Anonymize<I48i407regf59r>, true, never>;
        /**
         * HRMP messages that were sent in a block.
         *
         * This will be cleared in `on_initialize` of each new block.
         */
        HrmpOutboundMessages: StorageDescriptor<[], Anonymize<I6r5cbv8ttrb09>, false, never>;
        /**
         * Upward messages that were sent in a block.
         *
         * This will be cleared in `on_initialize` for each new block.
         */
        UpwardMessages: StorageDescriptor<[], Anonymize<Itom7fk49o0c9>, false, never>;
        /**
         * Upward messages that are still pending and not yet sent to the relay chain.
         */
        PendingUpwardMessages: StorageDescriptor<[], Anonymize<Itom7fk49o0c9>, false, never>;
        /**
         * Upward signals that are still pending and not yet sent to the relay chain.
         *
         * This will be cleared in `on_finalize` for each block.
         */
        PendingUpwardSignals: StorageDescriptor<[], Anonymize<Itom7fk49o0c9>, false, never>;
        /**
         * The factor to multiply the base delivery fee by for UMP.
         */
        UpwardDeliveryFeeFactor: StorageDescriptor<[], bigint, false, never>;
        /**
         * The number of HRMP messages we observed in `on_initialize` and thus used that number for
         * announcing the weight of `on_initialize` and `on_finalize`.
         */
        AnnouncedHrmpMessagesPerCandidate: StorageDescriptor<[], number, false, never>;
        /**
         * The weight we reserve at the beginning of the block for processing XCMP messages. This
         * overrides the amount set in the Config trait.
         */
        ReservedXcmpWeightOverride: StorageDescriptor<[], Anonymize<I4q39t5hn830vp>, true, never>;
        /**
         * The weight we reserve at the beginning of the block for processing DMP messages. This
         * overrides the amount set in the Config trait.
         */
        ReservedDmpWeightOverride: StorageDescriptor<[], Anonymize<I4q39t5hn830vp>, true, never>;
        /**
         * A custom head data that should be returned as result of `validate_block`.
         *
         * See `Pallet::set_custom_validation_head_data` for more information.
         */
        CustomValidationHeadData: StorageDescriptor<[], Uint8Array, true, never>;
        /**
         * Tracks cumulative `UMP` and `HRMP` messages sent across blocks in the current `PoV`.
         *
         * Across different candidates/PoVs the budgets are tracked by [`AggregatedUnincludedSegment`].
         */
        PoVMessagesTracker: StorageDescriptor<[], Anonymize<I9gacsa7nt0s25>, true, never>;
    };
    Timestamp: {
        /**
         * The current time for the current block.
         */
        Now: StorageDescriptor<[], bigint, false, never>;
        /**
         * Whether the timestamp has been updated in this block.
         *
         * This value is updated to `true` upon successful submission of a timestamp by a node.
         * It is then checked at the end of each block execution in the `on_finalize` hook.
         */
        DidUpdate: StorageDescriptor<[], boolean, false, never>;
    };
    ParachainInfo: {
        /**
        
         */
        ParachainId: StorageDescriptor<[], number, false, never>;
    };
    Balances: {
        /**
         * The total units issued in the system.
         */
        TotalIssuance: StorageDescriptor<[], bigint, false, never>;
        /**
         * The total units of outstanding deactivated balance in the system.
         */
        InactiveIssuance: StorageDescriptor<[], bigint, false, never>;
        /**
         * The Balances pallet example of storing the balance of an account.
         *
         * # Example
         *
         * ```nocompile
         * impl pallet_balances::Config for Runtime {
         * type AccountStore = StorageMapShim<Self::Account<Runtime>, frame_system::Provider<Runtime>, AccountId, Self::AccountData<Balance>>
         * }
         * ```
         *
         * You can also store the balance of an account in the `System` pallet.
         *
         * # Example
         *
         * ```nocompile
         * impl pallet_balances::Config for Runtime {
         * type AccountStore = System
         * }
         * ```
         *
         * But this comes with tradeoffs, storing account balances in the system pallet stores
         * `frame_system` data alongside the account data contrary to storing account balances in the
         * `Balances` pallet, which uses a `StorageMap` to store balances data only.
         * NOTE: This is only used in the case that this pallet is used to store balances.
         */
        Account: StorageDescriptor<[Key: SS58String], Anonymize<I1q8tnt1cluu5j>, false, never>;
        /**
         * Any liquidity locks on some account balances.
         * NOTE: Should only be accessed when setting, changing and freeing a lock.
         *
         * Use of locks is deprecated in favour of freezes. See `https://github.com/paritytech/substrate/pull/12951/`
         */
        Locks: StorageDescriptor<[Key: SS58String], Anonymize<I8ds64oj6581v0>, false, never>;
        /**
         * Named reserves on some account balances.
         *
         * Use of reserves is deprecated in favour of holds. See `https://github.com/paritytech/substrate/pull/12951/`
         */
        Reserves: StorageDescriptor<[Key: SS58String], Anonymize<Ia7pdug7cdsg8g>, false, never>;
        /**
         * Holds on account balances.
         */
        Holds: StorageDescriptor<[Key: SS58String], Anonymize<I64d8k4gel34fg>, false, never>;
        /**
         * Freeze locks on account balances.
         */
        Freezes: StorageDescriptor<[Key: SS58String], Anonymize<I9bin2jc70qt6q>, false, never>;
    };
    TransactionPayment: {
        /**
        
         */
        NextFeeMultiplier: StorageDescriptor<[], bigint, false, never>;
        /**
        
         */
        StorageVersion: StorageDescriptor<[], TransactionPaymentReleases, false, never>;
        /**
         * The `OnChargeTransaction` stores the withdrawn tx fee here.
         *
         * Use `withdraw_txfee` and `remaining_txfee` to access from outside the crate.
         */
        TxPaymentCredit: StorageDescriptor<[], bigint, true, never>;
    };
    Authorship: {
        /**
         * Author of current block.
         */
        Author: StorageDescriptor<[], SS58String, true, never>;
    };
    CollatorSelection: {
        /**
         * The invulnerable, permissioned collators. This list must be sorted.
         */
        Invulnerables: StorageDescriptor<[], Anonymize<Ia2lhg7l2hilo3>, false, never>;
        /**
         * The (community, limited) collation candidates. `Candidates` and `Invulnerables` should be
         * mutually exclusive.
         *
         * This list is sorted in ascending order by deposit and when the deposits are equal, the least
         * recently updated is considered greater.
         */
        CandidateList: StorageDescriptor<[], Anonymize<Ifi4da1gej1fri>, false, never>;
        /**
         * Last block authored by collator.
         */
        LastAuthoredBlock: StorageDescriptor<[Key: SS58String], number, false, never>;
        /**
         * Desired number of candidates.
         *
         * This should ideally always be less than [`Config::MaxCandidates`] for weights to be correct.
         */
        DesiredCandidates: StorageDescriptor<[], number, false, never>;
        /**
         * Fixed amount to deposit to become a collator.
         *
         * When a collator calls `leave_intent` they immediately receive the deposit back.
         */
        CandidacyBond: StorageDescriptor<[], bigint, false, never>;
    };
    Session: {
        /**
         * The current set of validators.
         */
        Validators: StorageDescriptor<[], Anonymize<Ia2lhg7l2hilo3>, false, never>;
        /**
         * Current index of the session.
         */
        CurrentIndex: StorageDescriptor<[], number, false, never>;
        /**
         * True if the underlying economic identities or weighting behind the validators
         * has changed in the queued validator set.
         */
        QueuedChanged: StorageDescriptor<[], boolean, false, never>;
        /**
         * The queued keys for the next session. When the next session begins, these keys
         * will be used to determine the validator's session keys.
         */
        QueuedKeys: StorageDescriptor<[], Anonymize<Ifvgo9568rpmqc>, false, never>;
        /**
         * Indices of disabled validators.
         *
         * The vec is always kept sorted so that we can find whether a given validator is
         * disabled using binary search. It gets cleared when `on_session_ending` returns
         * a new set of identities.
         */
        DisabledValidators: StorageDescriptor<[], Anonymize<I95g6i7ilua7lq>, false, never>;
        /**
         * The next session keys for a validator.
         */
        NextKeys: StorageDescriptor<[Key: SS58String], SizedHex<32>, true, never>;
        /**
         * The owner of a key. The key is the `KeyTypeId` + the encoded key.
         */
        KeyOwner: StorageDescriptor<[Key: Anonymize<I82jm9g7pufuel>], SS58String, true, never>;
        /**
         * Accounts whose keys were set via `SessionInterface` (external path) without
         * incrementing the consumer reference or placing a key deposit. `do_purge_keys`
         * only decrements consumers for accounts that were registered through the local
         * session pallet.
         */
        ExternallySetKeys: StorageDescriptor<[Key: SS58String], null, true, never>;
    };
    Aura: {
        /**
         * The current authority set.
         */
        Authorities: StorageDescriptor<[], Anonymize<Ic5m5lp1oioo8r>, false, never>;
        /**
         * The current slot of this block.
         *
         * This will be set in `on_initialize`.
         */
        CurrentSlot: StorageDescriptor<[], bigint, false, never>;
    };
    AuraExt: {
        /**
         * Serves as cache for the authorities.
         *
         * The authorities in AuRa are overwritten in `on_initialize` when we switch to a new session,
         * but we require the old authorities to verify the seal when validating a PoV. This will
         * always be updated to the latest AuRa authorities in `on_finalize`.
         */
        Authorities: StorageDescriptor<[], Anonymize<Ic5m5lp1oioo8r>, false, never>;
        /**
         * Current relay chain slot paired with a number of authored blocks.
         *
         * This is updated in [`FixedVelocityConsensusHook::on_state_proof`] with the current relay
         * chain slot as provided by the relay chain state proof.
         */
        RelaySlotInfo: StorageDescriptor<[], Anonymize<I6cs1itejju2vv>, true, never>;
    };
    XcmpQueue: {
        /**
         * The suspended inbound XCMP channels. All others are not suspended.
         *
         * This is a `StorageValue` instead of a `StorageMap` since we expect multiple reads per block
         * to different keys with a one byte payload. The access to `BoundedBTreeSet` will be cached
         * within the block and therefore only included once in the proof size.
         *
         * NOTE: The PoV benchmarking cannot know this and will over-estimate, but the actual proof
         * will be smaller.
         */
        InboundXcmpSuspended: StorageDescriptor<[], Anonymize<Icgljjb6j82uhn>, false, never>;
        /**
         * The non-empty XCMP channels in order of becoming non-empty, and the index of the first
         * and last outbound message. If the two indices are equal, then it indicates an empty
         * queue and there must be a non-`Ok` `OutboundStatus`. We assume queues grow no greater
         * than 65535 items. Queue indices for normal messages begin at one; zero is reserved in
         * case of the need to send a high-priority signal message this block.
         * The bool is true if there is a signal message waiting to be sent.
         */
        OutboundXcmpStatus: StorageDescriptor<[], Anonymize<I9pvau8qut93lg>, false, never>;
        /**
         * The messages outbound in a given XCMP channel.
         */
        OutboundXcmpMessages: StorageDescriptor<Anonymize<I5g2vv0ckl2m8b>, Uint8Array, false, never>;
        /**
         * Any signal messages waiting to be sent.
         */
        SignalMessages: StorageDescriptor<[Key: number], Uint8Array, false, never>;
        /**
         * The configuration which controls the dynamics of the outbound queue.
         */
        QueueConfig: StorageDescriptor<[], Anonymize<Ifup3lg9ro8a0f>, false, never>;
        /**
         * Whether or not the XCMP queue is suspended from executing incoming XCMs or not.
         */
        QueueSuspended: StorageDescriptor<[], boolean, false, never>;
        /**
         * The factor to multiply the base delivery fee by.
         */
        DeliveryFeeFactor: StorageDescriptor<[Key: number], bigint, false, never>;
    };
    PolkadotXcm: {
        /**
         * The latest available query index.
         */
        QueryCounter: StorageDescriptor<[], bigint, false, never>;
        /**
         * The ongoing queries.
         */
        Queries: StorageDescriptor<[Key: bigint], Anonymize<I5qfubnuvrnqn6>, true, never>;
        /**
         * The existing asset traps.
         *
         * Key is the blake2 256 hash of (origin, versioned `Assets`) pair. Value is the number of
         * times this pair has been trapped (usually just 1 if it exists at all).
         */
        AssetTraps: StorageDescriptor<[Key: SizedHex<32>], number, false, never>;
        /**
         * Default version to encode XCM when latest version of destination is unknown. If `None`,
         * then the destinations whose XCM version is unknown are considered unreachable.
         */
        SafeXcmVersion: StorageDescriptor<[], number, true, never>;
        /**
         * The Latest versions that we know various locations support.
         */
        SupportedVersion: StorageDescriptor<Anonymize<I8t3u2dv73ahbd>, number, true, never>;
        /**
         * All locations that we have requested version notifications from.
         */
        VersionNotifiers: StorageDescriptor<Anonymize<I8t3u2dv73ahbd>, bigint, true, never>;
        /**
         * The target locations that are subscribed to our version changes, as well as the most recent
         * of our versions we informed them of.
         */
        VersionNotifyTargets: StorageDescriptor<Anonymize<I8t3u2dv73ahbd>, Anonymize<I7vlvrrl2pnbgk>, true, never>;
        /**
         * Destinations whose latest XCM version we would like to know. Duplicates not allowed, and
         * the `u32` counter is the number of times that a send to the destination has been attempted,
         * which is used as a prioritization.
         */
        VersionDiscoveryQueue: StorageDescriptor<[], Anonymize<Ie0rpl5bahldfk>, false, never>;
        /**
         * The current migration's stage, if any.
         */
        CurrentMigration: StorageDescriptor<[], XcmPalletVersionMigrationStage, true, never>;
        /**
         * Fungible assets which we know are locked on a remote chain.
         */
        RemoteLockedFungibles: StorageDescriptor<Anonymize<Ie849h3gncgvok>, Anonymize<I7e5oaj2qi4kl1>, true, never>;
        /**
         * Fungible assets which we know are locked on this chain.
         */
        LockedFungibles: StorageDescriptor<[Key: SS58String], Anonymize<Iat62vud7hlod2>, true, never>;
        /**
         * Global suspension state of the XCM executor.
         */
        XcmExecutionSuspended: StorageDescriptor<[], boolean, false, never>;
        /**
         * Whether or not incoming XCMs (both executed locally and received) should be recorded.
         * Only one XCM program will be recorded at a time.
         * This is meant to be used in runtime APIs, and it's advised it stays false
         * for all other use cases, so as to not degrade regular performance.
         *
         * Only relevant if this pallet is being used as the [`xcm_executor::traits::RecordXcm`]
         * implementation in the XCM executor configuration.
         */
        ShouldRecordXcm: StorageDescriptor<[], boolean, false, never>;
        /**
         * If [`ShouldRecordXcm`] is set to true, then the last XCM program executed locally
         * will be stored here.
         * Runtime APIs can fetch the XCM that was executed by accessing this value.
         *
         * Only relevant if this pallet is being used as the [`xcm_executor::traits::RecordXcm`]
         * implementation in the XCM executor configuration.
         */
        RecordedXcm: StorageDescriptor<[], Anonymize<Ict03eedr8de9s>, true, never>;
        /**
         * Map of authorized aliasers of local origins. Each local location can authorize a list of
         * other locations to alias into it. Each aliaser is only valid until its inner `expiry`
         * block number.
         */
        AuthorizedAliases: StorageDescriptor<[Key: XcmVersionedLocation], Anonymize<Ibkm2gcn4pji30>, true, never>;
    };
    MessageQueue: {
        /**
         * The index of the first and last (non-empty) pages.
         */
        BookStateFor: StorageDescriptor<[Key: Anonymize<Iejeo53sea6n4q>], Anonymize<Idh2ug6ou4a8og>, false, never>;
        /**
         * The origin at which we should begin servicing.
         */
        ServiceHead: StorageDescriptor<[], Anonymize<Iejeo53sea6n4q>, true, never>;
        /**
         * The map of page indices to pages.
         */
        Pages: StorageDescriptor<Anonymize<Ib4jhb8tt3uung>, Anonymize<I53esa2ms463bk>, true, never>;
    };
    Multisig: {
        /**
         * The set of open multisig operations.
         */
        Multisigs: StorageDescriptor<Anonymize<I8uo3fpd3bcc6f>, Anonymize<Iag146hmjgqfgj>, true, never>;
    };
    Proxy: {
        /**
         * The set of account proxies. Maps the account which has delegated to the accounts
         * which are being delegated to, together with the amount held on deposit.
         */
        Proxies: StorageDescriptor<[Key: SS58String], Anonymize<If6n5it43h5lo7>, false, never>;
        /**
         * The announcements made by the proxy (key).
         */
        Announcements: StorageDescriptor<[Key: SS58String], Anonymize<I9p9lq3rej5bhc>, false, never>;
    };
    Preimage: {
        /**
         * The request status of a given hash.
         */
        StatusFor: StorageDescriptor<[Key: SizedHex<32>], PreimageOldRequestStatus, true, never>;
        /**
         * The request status of a given hash.
         */
        RequestStatusFor: StorageDescriptor<[Key: SizedHex<32>], PreimageRequestStatus, true, never>;
        /**
        
         */
        PreimageFor: StorageDescriptor<[Key: Anonymize<I4pact7n2e9a0i>], Uint8Array, true, never>;
    };
    Scheduler: {
        /**
         * Block number at which the agenda began incomplete execution.
         */
        IncompleteSince: StorageDescriptor<[], number, true, never>;
        /**
         * Items to be executed, indexed by the block number that they should be executed on.
         */
        Agenda: StorageDescriptor<[Key: number], Anonymize<Ieiuv359ridbmg>, false, never>;
        /**
         * Retry configurations for items to be executed, indexed by task address.
         */
        Retries: StorageDescriptor<[Key: Anonymize<I9jd27rnpm8ttv>], Anonymize<I56u24ncejr5kt>, true, never>;
        /**
         * Lookup from a name to the block number and index of the task.
         *
         * For v3 -> v4 the previously unbounded identities are Blake2-256 hashed to form the v4
         * identities.
         */
        Lookup: StorageDescriptor<[Key: SizedHex<32>], Anonymize<I9jd27rnpm8ttv>, true, never>;
    };
    AssetRate: {
        /**
         * Maps an asset to its fixed point representation in the native balance.
         *
         * E.g. `native_amount = asset_amount * ConversionRateToNative::<T>::get(asset_kind)`
         */
        ConversionRateToNative: StorageDescriptor<[Key: Anonymize<I2q3ri6itcjj5u>], bigint, true, never>;
    };
    Alliance: {
        /**
         * The IPFS CID of the alliance rule.
         * Fellows can propose a new rule with a super-majority.
         */
        Rule: StorageDescriptor<[], Anonymize<I982189ri79b4u>, true, never>;
        /**
         * The current IPFS CIDs of any announcements.
         */
        Announcements: StorageDescriptor<[], Anonymize<I26e9b3ail50ji>, false, never>;
        /**
         * Maps members to their candidacy deposit.
         */
        DepositOf: StorageDescriptor<[Key: SS58String], bigint, true, never>;
        /**
         * Maps member type to members of each type.
         */
        Members: StorageDescriptor<[Key: Anonymize<Iee1c44rpikfmk>], Anonymize<Ia2lhg7l2hilo3>, false, never>;
        /**
         * A set of members who gave a retirement notice. They can retire after the end of retirement
         * period stored as a future block number.
         */
        RetiringMembers: StorageDescriptor<[Key: SS58String], number, true, never>;
        /**
         * The current list of accounts deemed unscrupulous. These accounts non grata cannot submit
         * candidacy.
         */
        UnscrupulousAccounts: StorageDescriptor<[], Anonymize<Ia2lhg7l2hilo3>, false, never>;
        /**
         * The current list of websites deemed unscrupulous.
         */
        UnscrupulousWebsites: StorageDescriptor<[], Anonymize<Itom7fk49o0c9>, false, never>;
    };
    AllianceMotion: {
        /**
         * The hashes of the active proposals.
         */
        Proposals: StorageDescriptor<[], Anonymize<Ic5m5lp1oioo8r>, false, never>;
        /**
         * Actual proposal for a given hash, if it's current.
         */
        ProposalOf: StorageDescriptor<[Key: SizedHex<32>], Anonymize<I7amu2774tu62e>, true, never>;
        /**
         * Consideration cost created for publishing and storing a proposal.
         *
         * Determined by [Config::Consideration] and may be not present for certain proposals (e.g. if
         * the proposal count at the time of creation was below threshold N).
         */
        CostOf: StorageDescriptor<[Key: SizedHex<32>], Anonymize<Ifvqn3ldat80ai>, true, never>;
        /**
         * Votes on a given proposal, if it is ongoing.
         */
        Voting: StorageDescriptor<[Key: SizedHex<32>], Anonymize<I99bb69usss9gs>, true, never>;
        /**
         * Proposals so far.
         */
        ProposalCount: StorageDescriptor<[], number, false, never>;
        /**
         * The current members of the collective. This is stored sorted (just by value).
         */
        Members: StorageDescriptor<[], Anonymize<Ia2lhg7l2hilo3>, false, never>;
        /**
         * The prime member that helps determine the default vote behavior in case of abstentions.
         */
        Prime: StorageDescriptor<[], SS58String, true, never>;
    };
    FellowshipCollective: {
        /**
         * The number of members in the collective who have at least the rank according to the index
         * of the vec.
         */
        MemberCount: StorageDescriptor<[Key: number], number, false, never>;
        /**
         * The current members of the collective.
         */
        Members: StorageDescriptor<[Key: SS58String], number, true, never>;
        /**
         * The index of each ranks's member into the group of members who have at least that rank.
         */
        IdToIndex: StorageDescriptor<Anonymize<I7svnfko10tq2e>, number, true, never>;
        /**
         * The members in the collective by index. All indices in the range `0..MemberCount` will
         * return `Some`, however a member's index is not guaranteed to remain unchanged over time.
         */
        IndexToId: StorageDescriptor<Anonymize<I5g2vv0ckl2m8b>, SS58String, true, never>;
        /**
         * Votes on a given proposal, if it is ongoing.
         */
        Voting: StorageDescriptor<Anonymize<I7svnfko10tq2e>, Anonymize<I3gg47bgkgq9tr>, true, never>;
        /**
        
         */
        VotingCleanup: StorageDescriptor<[Key: number], Uint8Array, true, never>;
    };
    FellowshipReferenda: {
        /**
         * The next free referendum index, aka the number of referenda started so far.
         */
        ReferendumCount: StorageDescriptor<[], number, false, never>;
        /**
         * Information concerning any given referendum.
         */
        ReferendumInfoFor: StorageDescriptor<[Key: number], Anonymize<I70rn7tl6dsdj2>, true, never>;
        /**
         * The sorted list of referenda ready to be decided but not yet being decided, ordered by
         * conviction-weighted approvals.
         *
         * This should be empty if `DecidingCount` is less than `TrackInfo::max_deciding`.
         */
        TrackQueue: StorageDescriptor<[Key: number], Anonymize<I95g6i7ilua7lq>, false, never>;
        /**
         * The number of referenda being decided currently.
         */
        DecidingCount: StorageDescriptor<[Key: number], number, false, never>;
        /**
         * The metadata is a general information concerning the referendum.
         * The `Hash` refers to the preimage of the `Preimages` provider which can be a JSON
         * dump or IPFS hash of a JSON file.
         *
         * Consider a garbage collection for a metadata of finished referendums to `unrequest` (remove)
         * large preimages.
         */
        MetadataOf: StorageDescriptor<[Key: number], SizedHex<32>, true, never>;
    };
    FellowshipCore: {
        /**
         * The overall status of the system.
         */
        Params: StorageDescriptor<[], Anonymize<I6qcggph46iog7>, false, never>;
        /**
         * The status of a claimant.
         */
        Member: StorageDescriptor<[Key: SS58String], Anonymize<Iq1c24rdj7v7p>, true, never>;
        /**
         * Some evidence together with the desired outcome for which it was presented.
         */
        MemberEvidence: StorageDescriptor<[Key: SS58String], Anonymize<I9uq9b728jtlkj>, true, never>;
    };
    FellowshipSalary: {
        /**
         * The overall status of the system.
         */
        Status: StorageDescriptor<[], Anonymize<Idg0lipm04tfnv>, true, never>;
        /**
         * The status of a claimant.
         */
        Claimant: StorageDescriptor<[Key: SS58String], Anonymize<I34qfon4stjc0g>, true, never>;
    };
    FellowshipTreasury: {
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Number of proposals that have been made.
         */
        ProposalCount: StorageDescriptor<[], number, false, never>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Proposals that have been made.
         */
        Proposals: StorageDescriptor<[Key: number], Anonymize<Iegmj7n48sc3am>, true, never>;
        /**
         * The amount which has been reported as inactive to Currency.
         */
        Deactivated: StorageDescriptor<[], bigint, false, never>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Proposal indices that have been approved but not yet awarded.
         */
        Approvals: StorageDescriptor<[], Anonymize<Icgljjb6j82uhn>, false, never>;
        /**
         * The count of spends that have been made.
         */
        SpendCount: StorageDescriptor<[], number, false, never>;
        /**
         * Spends that have been approved and being processed.
         */
        Spends: StorageDescriptor<[Key: number], Anonymize<I3s9vvjt0el98d>, true, never>;
        /**
         * The blocknumber for the last triggered spend period.
         */
        LastSpendPeriod: StorageDescriptor<[], number, true, never>;
    };
    AmbassadorCollective: {
        /**
         * The number of members in the collective who have at least the rank according to the index
         * of the vec.
         */
        MemberCount: StorageDescriptor<[Key: number], number, false, never>;
        /**
         * The current members of the collective.
         */
        Members: StorageDescriptor<[Key: SS58String], number, true, never>;
        /**
         * The index of each ranks's member into the group of members who have at least that rank.
         */
        IdToIndex: StorageDescriptor<Anonymize<I7svnfko10tq2e>, number, true, never>;
        /**
         * The members in the collective by index. All indices in the range `0..MemberCount` will
         * return `Some`, however a member's index is not guaranteed to remain unchanged over time.
         */
        IndexToId: StorageDescriptor<Anonymize<I5g2vv0ckl2m8b>, SS58String, true, never>;
        /**
         * Votes on a given proposal, if it is ongoing.
         */
        Voting: StorageDescriptor<Anonymize<I7svnfko10tq2e>, Anonymize<I3gg47bgkgq9tr>, true, never>;
        /**
        
         */
        VotingCleanup: StorageDescriptor<[Key: number], Uint8Array, true, never>;
    };
    AmbassadorReferenda: {
        /**
         * The next free referendum index, aka the number of referenda started so far.
         */
        ReferendumCount: StorageDescriptor<[], number, false, never>;
        /**
         * Information concerning any given referendum.
         */
        ReferendumInfoFor: StorageDescriptor<[Key: number], Anonymize<I70rn7tl6dsdj2>, true, never>;
        /**
         * The sorted list of referenda ready to be decided but not yet being decided, ordered by
         * conviction-weighted approvals.
         *
         * This should be empty if `DecidingCount` is less than `TrackInfo::max_deciding`.
         */
        TrackQueue: StorageDescriptor<[Key: number], Anonymize<I95g6i7ilua7lq>, false, never>;
        /**
         * The number of referenda being decided currently.
         */
        DecidingCount: StorageDescriptor<[Key: number], number, false, never>;
        /**
         * The metadata is a general information concerning the referendum.
         * The `Hash` refers to the preimage of the `Preimages` provider which can be a JSON
         * dump or IPFS hash of a JSON file.
         *
         * Consider a garbage collection for a metadata of finished referendums to `unrequest` (remove)
         * large preimages.
         */
        MetadataOf: StorageDescriptor<[Key: number], SizedHex<32>, true, never>;
    };
    AmbassadorCore: {
        /**
         * The overall status of the system.
         */
        Params: StorageDescriptor<[], Anonymize<I6qcggph46iog7>, false, never>;
        /**
         * The status of a claimant.
         */
        Member: StorageDescriptor<[Key: SS58String], Anonymize<Iq1c24rdj7v7p>, true, never>;
        /**
         * Some evidence together with the desired outcome for which it was presented.
         */
        MemberEvidence: StorageDescriptor<[Key: SS58String], Anonymize<I9uq9b728jtlkj>, true, never>;
    };
    AmbassadorSalary: {
        /**
         * The overall status of the system.
         */
        Status: StorageDescriptor<[], Anonymize<Idg0lipm04tfnv>, true, never>;
        /**
         * The status of a claimant.
         */
        Claimant: StorageDescriptor<[Key: SS58String], Anonymize<I34qfon4stjc0g>, true, never>;
    };
    AmbassadorTreasury: {
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Number of proposals that have been made.
         */
        ProposalCount: StorageDescriptor<[], number, false, never>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Proposals that have been made.
         */
        Proposals: StorageDescriptor<[Key: number], Anonymize<Iegmj7n48sc3am>, true, never>;
        /**
         * The amount which has been reported as inactive to Currency.
         */
        Deactivated: StorageDescriptor<[], bigint, false, never>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * Proposal indices that have been approved but not yet awarded.
         */
        Approvals: StorageDescriptor<[], Anonymize<Icgljjb6j82uhn>, false, never>;
        /**
         * The count of spends that have been made.
         */
        SpendCount: StorageDescriptor<[], number, false, never>;
        /**
         * Spends that have been approved and being processed.
         */
        Spends: StorageDescriptor<[Key: number], Anonymize<I3s9vvjt0el98d>, true, never>;
        /**
         * The blocknumber for the last triggered spend period.
         */
        LastSpendPeriod: StorageDescriptor<[], number, true, never>;
    };
    SecretaryCollective: {
        /**
         * The number of members in the collective who have at least the rank according to the index
         * of the vec.
         */
        MemberCount: StorageDescriptor<[Key: number], number, false, never>;
        /**
         * The current members of the collective.
         */
        Members: StorageDescriptor<[Key: SS58String], number, true, never>;
        /**
         * The index of each ranks's member into the group of members who have at least that rank.
         */
        IdToIndex: StorageDescriptor<Anonymize<I7svnfko10tq2e>, number, true, never>;
        /**
         * The members in the collective by index. All indices in the range `0..MemberCount` will
         * return `Some`, however a member's index is not guaranteed to remain unchanged over time.
         */
        IndexToId: StorageDescriptor<Anonymize<I5g2vv0ckl2m8b>, SS58String, true, never>;
        /**
         * Votes on a given proposal, if it is ongoing.
         */
        Voting: StorageDescriptor<Anonymize<I7svnfko10tq2e>, Anonymize<I3gg47bgkgq9tr>, true, never>;
        /**
        
         */
        VotingCleanup: StorageDescriptor<[Key: number], Uint8Array, true, never>;
    };
    SecretarySalary: {
        /**
         * The overall status of the system.
         */
        Status: StorageDescriptor<[], Anonymize<Idg0lipm04tfnv>, true, never>;
        /**
         * The status of a claimant.
         */
        Claimant: StorageDescriptor<[Key: SS58String], Anonymize<I34qfon4stjc0g>, true, never>;
    };
};
type ICalls = {
    System: {
        /**
         * Make some on-chain remark.
         *
         * Can be executed by every `origin`.
         */
        remark: TxDescriptor<Anonymize<I8ofcg5rbj0g2c>>;
        /**
         * Set the number of pages in the WebAssembly environment's heap.
         */
        set_heap_pages: TxDescriptor<Anonymize<I4adgbll7gku4i>>;
        /**
         * Set the new runtime code.
         */
        set_code: TxDescriptor<Anonymize<I6pjjpfvhvcfru>>;
        /**
         * Set the new runtime code without doing any checks of the given `code`.
         *
         * Note that runtime upgrades will not run if this is called with a not-increasing spec
         * version!
         */
        set_code_without_checks: TxDescriptor<Anonymize<I6pjjpfvhvcfru>>;
        /**
         * Set some items of storage.
         */
        set_storage: TxDescriptor<Anonymize<I9pj91mj79qekl>>;
        /**
         * Kill some items from storage.
         */
        kill_storage: TxDescriptor<Anonymize<I39uah9nss64h9>>;
        /**
         * Kill all storage items with a key that starts with the given prefix.
         *
         * **NOTE:** We rely on the Root origin to provide us the number of subkeys under
         * the prefix we are removing to accurately calculate the weight of this function.
         */
        kill_prefix: TxDescriptor<Anonymize<Ik64dknsq7k08>>;
        /**
         * Make some on-chain remark and emit event.
         */
        remark_with_event: TxDescriptor<Anonymize<I8ofcg5rbj0g2c>>;
        /**
         * Authorize an upgrade to a given `code_hash` for the runtime. The runtime can be supplied
         * later.
         *
         * This call requires Root origin.
         */
        authorize_upgrade: TxDescriptor<Anonymize<Ib51vk42m1po4n>>;
        /**
         * Authorize an upgrade to a given `code_hash` for the runtime. The runtime can be supplied
         * later.
         *
         * WARNING: This authorizes an upgrade that will take place without any safety checks, for
         * example that the spec name remains the same and that the version number increases. Not
         * recommended for normal use. Use `authorize_upgrade` instead.
         *
         * This call requires Root origin.
         */
        authorize_upgrade_without_checks: TxDescriptor<Anonymize<Ib51vk42m1po4n>>;
        /**
         * Provide the preimage (runtime binary) `code` for an upgrade that has been authorized.
         *
         * If the authorization required a version check, this call will ensure the spec name
         * remains unchanged and that the spec version has increased.
         *
         * Depending on the runtime's `OnSetCode` configuration, this function may directly apply
         * the new `code` in the same block or attempt to schedule the upgrade.
         *
         * All origins are allowed.
         */
        apply_authorized_upgrade: TxDescriptor<Anonymize<I6pjjpfvhvcfru>>;
    };
    ParachainSystem: {
        /**
         * Set the current validation data.
         *
         * This should be invoked exactly once per block. It will panic at the finalization
         * phase if the call was not invoked.
         *
         * The dispatch origin for this call must be `Inherent`
         *
         * As a side effect, this function upgrades the current validation function
         * if the appropriate time has come.
         */
        set_validation_data: TxDescriptor<Anonymize<Ial23jn8hp0aen>>;
        /**
        
         */
        sudo_send_upward_message: TxDescriptor<Anonymize<Ifpj261e8s63m3>>;
    };
    Timestamp: {
        /**
         * Set the current time.
         *
         * This call should be invoked exactly once per block. It will panic at the finalization
         * phase, if this call hasn't been invoked by that time.
         *
         * The timestamp should be greater than the previous one by the amount specified by
         * [`Config::MinimumPeriod`].
         *
         * The dispatch origin for this call must be _None_.
         *
         * This dispatch class is _Mandatory_ to ensure it gets executed in the block. Be aware
         * that changing the complexity of this call could result exhausting the resources in a
         * block to execute any other calls.
         *
         * ## Complexity
         * - `O(1)` (Note that implementations of `OnTimestampSet` must also be `O(1)`)
         * - 1 storage read and 1 storage mutation (codec `O(1)` because of `DidUpdate::take` in
         * `on_finalize`)
         * - 1 event handler `on_timestamp_set`. Must be `O(1)`.
         */
        set: TxDescriptor<Anonymize<Idcr6u6361oad9>>;
    };
    Balances: {
        /**
         * Transfer some liquid free balance to another account.
         *
         * `transfer_allow_death` will set the `FreeBalance` of the sender and receiver.
         * If the sender's account is below the existential deposit as a result
         * of the transfer, the account will be reaped.
         *
         * The dispatch origin for this call must be `Signed` by the transactor.
         */
        transfer_allow_death: TxDescriptor<Anonymize<I4ktuaksf5i1gk>>;
        /**
         * Exactly as `transfer_allow_death`, except the origin must be root and the source account
         * may be specified.
         */
        force_transfer: TxDescriptor<Anonymize<I9bqtpv2ii35mp>>;
        /**
         * Same as the [`transfer_allow_death`] call, but with a check that the transfer will not
         * kill the origin account.
         *
         * 99% of the time you want [`transfer_allow_death`] instead.
         *
         * [`transfer_allow_death`]: struct.Pallet.html#method.transfer
         */
        transfer_keep_alive: TxDescriptor<Anonymize<I4ktuaksf5i1gk>>;
        /**
         * Transfer the entire transferable balance from the caller account.
         *
         * NOTE: This function only attempts to transfer _transferable_ balances. This means that
         * any locked, reserved, or existential deposits (when `keep_alive` is `true`), will not be
         * transferred by this function. To ensure that this function results in a killed account,
         * you might need to prepare the account by removing any reference counters, storage
         * deposits, etc...
         *
         * The dispatch origin of this call must be Signed.
         *
         * - `dest`: The recipient of the transfer.
         * - `keep_alive`: A boolean to determine if the `transfer_all` operation should send all
         * of the funds the account has, causing the sender account to be killed (false), or
         * transfer everything except at least the existential deposit, which will guarantee to
         * keep the sender account alive (true).
         */
        transfer_all: TxDescriptor<Anonymize<I9j7pagd6d4bda>>;
        /**
         * Unreserve some balance from a user by force.
         *
         * Can only be called by ROOT.
         */
        force_unreserve: TxDescriptor<Anonymize<I2h9pmio37r7fb>>;
        /**
         * Upgrade a specified account.
         *
         * - `origin`: Must be `Signed`.
         * - `who`: The account to be upgraded.
         *
         * This will waive the transaction fee if at least all but 10% of the accounts needed to
         * be upgraded. (We let some not have to be upgraded just in order to allow for the
         * possibility of churn).
         */
        upgrade_accounts: TxDescriptor<Anonymize<Ibmr18suc9ikh9>>;
        /**
         * Set the regular balance of a given account.
         *
         * The dispatch origin for this call is `root`.
         */
        force_set_balance: TxDescriptor<Anonymize<I9iq22t0burs89>>;
        /**
         * Adjust the total issuance in a saturating way.
         *
         * Can only be called by root and always needs a positive `delta`.
         *
         * # Example
         */
        force_adjust_total_issuance: TxDescriptor<Anonymize<I5u8olqbbvfnvf>>;
        /**
         * Burn the specified liquid free balance from the origin account.
         *
         * If the origin's account ends up below the existential deposit as a result
         * of the burn and `keep_alive` is false, the account will be reaped.
         *
         * Unlike sending funds to a _burn_ address, which merely makes the funds inaccessible,
         * this `burn` operation will reduce total issuance by the amount _burned_.
         */
        burn: TxDescriptor<Anonymize<I5utcetro501ir>>;
    };
    CollatorSelection: {
        /**
         * Set the list of invulnerable (fixed) collators. These collators must do some
         * preparation, namely to have registered session keys.
         *
         * The call will remove any accounts that have not registered keys from the set. That is,
         * it is non-atomic; the caller accepts all `AccountId`s passed in `new` _individually_ as
         * acceptable Invulnerables, and is not proposing a _set_ of new Invulnerables.
         *
         * This call does not maintain mutual exclusivity of `Invulnerables` and `Candidates`. It
         * is recommended to use a batch of `add_invulnerable` and `remove_invulnerable` instead. A
         * `batch_all` can also be used to enforce atomicity. If any candidates are included in
         * `new`, they should be removed with `remove_invulnerable_candidate` after execution.
         *
         * Must be called by the `UpdateOrigin`.
         */
        set_invulnerables: TxDescriptor<Anonymize<Ifccifqltb5obi>>;
        /**
         * Set the ideal number of non-invulnerable collators. If lowering this number, then the
         * number of running collators could be higher than this figure. Aside from that edge case,
         * there should be no other way to have more candidates than the desired number.
         *
         * The origin for this call must be the `UpdateOrigin`.
         */
        set_desired_candidates: TxDescriptor<Anonymize<Iadtsfv699cq8b>>;
        /**
         * Set the candidacy bond amount.
         *
         * If the candidacy bond is increased by this call, all current candidates which have a
         * deposit lower than the new bond will be kicked from the list and get their deposits
         * back.
         *
         * The origin for this call must be the `UpdateOrigin`.
         */
        set_candidacy_bond: TxDescriptor<Anonymize<Ialpmgmhr3gk5r>>;
        /**
         * Register this account as a collator candidate. The account must (a) already have
         * registered session keys and (b) be able to reserve the `CandidacyBond`.
         *
         * This call is not available to `Invulnerable` collators.
         */
        register_as_candidate: TxDescriptor<undefined>;
        /**
         * Deregister `origin` as a collator candidate. Note that the collator can only leave on
         * session change. The `CandidacyBond` will be unreserved immediately.
         *
         * This call will fail if the total number of candidates would drop below
         * `MinEligibleCollators`.
         */
        leave_intent: TxDescriptor<undefined>;
        /**
         * Add a new account `who` to the list of `Invulnerables` collators. `who` must have
         * registered session keys. If `who` is a candidate, they will be removed.
         *
         * The origin for this call must be the `UpdateOrigin`.
         */
        add_invulnerable: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Remove an account `who` from the list of `Invulnerables` collators. `Invulnerables` must
         * be sorted.
         *
         * The origin for this call must be the `UpdateOrigin`.
         */
        remove_invulnerable: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Update the candidacy bond of collator candidate `origin` to a new amount `new_deposit`.
         *
         * Setting a `new_deposit` that is lower than the current deposit while `origin` is
         * occupying a top-`DesiredCandidates` slot is not allowed.
         *
         * This call will fail if `origin` is not a collator candidate, the updated bond is lower
         * than the minimum candidacy bond, and/or the amount cannot be reserved.
         */
        update_bond: TxDescriptor<Anonymize<I3sdol54kg5jaq>>;
        /**
         * The caller `origin` replaces a candidate `target` in the collator candidate list by
         * reserving `deposit`. The amount `deposit` reserved by the caller must be greater than
         * the existing bond of the target it is trying to replace.
         *
         * This call will fail if the caller is already a collator candidate or invulnerable, the
         * caller does not have registered session keys, the target is not a collator candidate,
         * and/or the `deposit` amount cannot be reserved.
         */
        take_candidate_slot: TxDescriptor<Anonymize<I8fougodaj6di6>>;
    };
    Session: {
        /**
         * Sets the session key(s) of the function caller to `keys`.
         *
         * Allows an account to set its session key prior to becoming a validator.
         * This doesn't take effect until the next session.
         *
         * - `origin`: The dispatch origin of this function must be signed.
         * - `keys`: The new session keys to set. These are the public keys of all sessions keys
         * setup in the runtime.
         * - `proof`: The proof that `origin` has access to the private keys of `keys`. See
         * [`impl_opaque_keys`](sp_runtime::impl_opaque_keys) for more information about the
         * proof format.
         */
        set_keys: TxDescriptor<Anonymize<I81vt5eq60l4b6>>;
        /**
         * Removes any session key(s) of the function caller.
         *
         * This doesn't take effect until the next session.
         *
         * The dispatch origin of this function must be Signed and the account must be either be
         * convertible to a validator ID using the chain's typical addressing system (this usually
         * means being a controller account) or directly convertible into a validator ID (which
         * usually means being a stash account).
         */
        purge_keys: TxDescriptor<undefined>;
    };
    XcmpQueue: {
        /**
         * Suspends all XCM executions for the XCMP queue, regardless of the sender's origin.
         *
         * - `origin`: Must pass `ControllerOrigin`.
         */
        suspend_xcm_execution: TxDescriptor<undefined>;
        /**
         * Resumes all XCM executions for the XCMP queue.
         *
         * Note that this function doesn't change the status of the in/out bound channels.
         *
         * - `origin`: Must pass `ControllerOrigin`.
         */
        resume_xcm_execution: TxDescriptor<undefined>;
        /**
         * Overwrites the number of pages which must be in the queue for the other side to be
         * told to suspend their sending.
         *
         * - `origin`: Must pass `Root`.
         * - `new`: Desired value for `QueueConfigData.suspend_value`
         */
        update_suspend_threshold: TxDescriptor<Anonymize<I3vh014cqgmrfd>>;
        /**
         * Overwrites the number of pages which must be in the queue after which we drop any
         * further messages from the channel.
         *
         * - `origin`: Must pass `Root`.
         * - `new`: Desired value for `QueueConfigData.drop_threshold`
         */
        update_drop_threshold: TxDescriptor<Anonymize<I3vh014cqgmrfd>>;
        /**
         * Overwrites the number of pages which the queue must be reduced to before it signals
         * that message sending may recommence after it has been suspended.
         *
         * - `origin`: Must pass `Root`.
         * - `new`: Desired value for `QueueConfigData.resume_threshold`
         */
        update_resume_threshold: TxDescriptor<Anonymize<I3vh014cqgmrfd>>;
    };
    PolkadotXcm: {
        /**
        
         */
        send: TxDescriptor<Anonymize<Ia5cotcvi888ln>>;
        /**
         * Teleport some assets from the local chain to some destination chain.
         *
         * **This function is deprecated: Use `limited_teleport_assets` instead.**
         *
         * Fee payment on the destination side is made from the asset in the `assets` vector of
         * index `fee_asset_item`. The weight limit for fees is not provided and thus is unlimited,
         * with all fees taken as needed from the asset.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `[Parent,
         * Parachain(..)]` to send from parachain to parachain, or `[Parachain(..)]` to send from
         * relay to parachain.
         * - `beneficiary`: A beneficiary location for the assets in the context of `dest`. Will
         * generally be an `AccountId32` value.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` chain.
         * - `fee_asset_item`: The index into `assets` of the item which should be used to pay
         * fees.
         */
        teleport_assets: TxDescriptor<Anonymize<I21jsa919m88fd>>;
        /**
         * Transfer some assets from the local chain to the destination chain through their local,
         * destination or remote reserve.
         *
         * `assets` must have same reserve location and may not be teleportable to `dest`.
         * - `assets` have local reserve: transfer assets to sovereign account of destination
         * chain and forward a notification XCM to `dest` to mint and deposit reserve-based
         * assets to `beneficiary`.
         * - `assets` have destination reserve: burn local assets and forward a notification to
         * `dest` chain to withdraw the reserve assets from this chain's sovereign account and
         * deposit them to `beneficiary`.
         * - `assets` have remote reserve: burn local assets, forward XCM to reserve chain to move
         * reserves from this chain's SA to `dest` chain's SA, and forward another XCM to `dest`
         * to mint and deposit reserve-based assets to `beneficiary`.
         *
         * **This function is deprecated: Use `limited_reserve_transfer_assets` instead.**
         *
         * Fee payment on the destination side is made from the asset in the `assets` vector of
         * index `fee_asset_item`. The weight limit for fees is not provided and thus is unlimited,
         * with all fees taken as needed from the asset.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `[Parent,
         * Parachain(..)]` to send from parachain to parachain, or `[Parachain(..)]` to send from
         * relay to parachain.
         * - `beneficiary`: A beneficiary location for the assets in the context of `dest`. Will
         * generally be an `AccountId32` value.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` (and possibly reserve) chains.
         * - `fee_asset_item`: The index into `assets` of the item which should be used to pay
         * fees.
         */
        reserve_transfer_assets: TxDescriptor<Anonymize<I21jsa919m88fd>>;
        /**
         * Execute an XCM message from a local, signed, origin.
         *
         * An event is deposited indicating whether `msg` could be executed completely or only
         * partially.
         *
         * No more than `max_weight` will be used in its attempted execution. If this is less than
         * the maximum amount of weight that the message could take to be executed, then no
         * execution attempt will be made.
         */
        execute: TxDescriptor<Anonymize<Iegif7m3upfe1k>>;
        /**
         * Extoll that a particular destination can be communicated with through a particular
         * version of XCM.
         *
         * - `origin`: Must be an origin specified by AdminOrigin.
         * - `location`: The destination that is being described.
         * - `xcm_version`: The latest version of XCM that `location` supports.
         */
        force_xcm_version: TxDescriptor<Anonymize<I9kt8c221c83ln>>;
        /**
         * Set a safe XCM version (the version that XCM should be encoded with if the most recent
         * version a destination can accept is unknown).
         *
         * - `origin`: Must be an origin specified by AdminOrigin.
         * - `maybe_xcm_version`: The default XCM encoding version, or `None` to disable.
         */
        force_default_xcm_version: TxDescriptor<Anonymize<Ic76kfh5ebqkpl>>;
        /**
         * Ask a location to notify us regarding their XCM version and any changes to it.
         *
         * - `origin`: Must be an origin specified by AdminOrigin.
         * - `location`: The location to which we should subscribe for XCM version notifications.
         */
        force_subscribe_version_notify: TxDescriptor<Anonymize<Icscpmubum33bq>>;
        /**
         * Require that a particular destination should no longer notify us regarding any XCM
         * version changes.
         *
         * - `origin`: Must be an origin specified by AdminOrigin.
         * - `location`: The location to which we are currently subscribed for XCM version
         * notifications which we no longer desire.
         */
        force_unsubscribe_version_notify: TxDescriptor<Anonymize<Icscpmubum33bq>>;
        /**
         * Transfer some assets from the local chain to the destination chain through their local,
         * destination or remote reserve.
         *
         * `assets` must have same reserve location and may not be teleportable to `dest`.
         * - `assets` have local reserve: transfer assets to sovereign account of destination
         * chain and forward a notification XCM to `dest` to mint and deposit reserve-based
         * assets to `beneficiary`.
         * - `assets` have destination reserve: burn local assets and forward a notification to
         * `dest` chain to withdraw the reserve assets from this chain's sovereign account and
         * deposit them to `beneficiary`.
         * - `assets` have remote reserve: burn local assets, forward XCM to reserve chain to move
         * reserves from this chain's SA to `dest` chain's SA, and forward another XCM to `dest`
         * to mint and deposit reserve-based assets to `beneficiary`.
         *
         * Fee payment on the destination side is made from the asset in the `assets` vector of
         * index `fee_asset_item`, up to enough to pay for `weight_limit` of weight. If more weight
         * is needed than `weight_limit`, then the operation will fail and the sent assets may be
         * at risk.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `[Parent,
         * Parachain(..)]` to send from parachain to parachain, or `[Parachain(..)]` to send from
         * relay to parachain.
         * - `beneficiary`: A beneficiary location for the assets in the context of `dest`. Will
         * generally be an `AccountId32` value.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` (and possibly reserve) chains.
         * - `fee_asset_item`: The index into `assets` of the item which should be used to pay
         * fees.
         * - `weight_limit`: The remote-side weight limit, if any, for the XCM fee purchase.
         */
        limited_reserve_transfer_assets: TxDescriptor<Anonymize<I21d2olof7eb60>>;
        /**
         * Teleport some assets from the local chain to some destination chain.
         *
         * Fee payment on the destination side is made from the asset in the `assets` vector of
         * index `fee_asset_item`, up to enough to pay for `weight_limit` of weight. If more weight
         * is needed than `weight_limit`, then the operation will fail and the sent assets may be
         * at risk.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `[Parent,
         * Parachain(..)]` to send from parachain to parachain, or `[Parachain(..)]` to send from
         * relay to parachain.
         * - `beneficiary`: A beneficiary location for the assets in the context of `dest`. Will
         * generally be an `AccountId32` value.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` chain.
         * - `fee_asset_item`: The index into `assets` of the item which should be used to pay
         * fees.
         * - `weight_limit`: The remote-side weight limit, if any, for the XCM fee purchase.
         */
        limited_teleport_assets: TxDescriptor<Anonymize<I21d2olof7eb60>>;
        /**
         * Set or unset the global suspension state of the XCM executor.
         *
         * - `origin`: Must be an origin specified by AdminOrigin.
         * - `suspended`: `true` to suspend, `false` to resume.
         */
        force_suspension: TxDescriptor<Anonymize<Ibgm4rnf22lal1>>;
        /**
         * Transfer some assets from the local chain to the destination chain through their local,
         * destination or remote reserve, or through teleports.
         *
         * Fee payment on the destination side is made from the asset in the `assets` vector of
         * index `fee_asset_item` (hence referred to as `fees`), up to enough to pay for
         * `weight_limit` of weight. If more weight is needed than `weight_limit`, then the
         * operation will fail and the sent assets may be at risk.
         *
         * `assets` (excluding `fees`) must have same reserve location or otherwise be teleportable
         * to `dest`, no limitations imposed on `fees`.
         * - for local reserve: transfer assets to sovereign account of destination chain and
         * forward a notification XCM to `dest` to mint and deposit reserve-based assets to
         * `beneficiary`.
         * - for destination reserve: burn local assets and forward a notification to `dest` chain
         * to withdraw the reserve assets from this chain's sovereign account and deposit them
         * to `beneficiary`.
         * - for remote reserve: burn local assets, forward XCM to reserve chain to move reserves
         * from this chain's SA to `dest` chain's SA, and forward another XCM to `dest` to mint
         * and deposit reserve-based assets to `beneficiary`.
         * - for teleports: burn local assets and forward XCM to `dest` chain to mint/teleport
         * assets and deposit them to `beneficiary`.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `X2(Parent,
         * Parachain(..))` to send from parachain to parachain, or `X1(Parachain(..))` to send
         * from relay to parachain.
         * - `beneficiary`: A beneficiary location for the assets in the context of `dest`. Will
         * generally be an `AccountId32` value.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` (and possibly reserve) chains.
         * - `fee_asset_item`: The index into `assets` of the item which should be used to pay
         * fees.
         * - `weight_limit`: The remote-side weight limit, if any, for the XCM fee purchase.
         */
        transfer_assets: TxDescriptor<Anonymize<I21d2olof7eb60>>;
        /**
         * Claims assets trapped on this pallet because of leftover assets during XCM execution.
         *
         * - `origin`: Anyone can call this extrinsic.
         * - `assets`: The exact assets that were trapped. Use the version to specify what version
         * was the latest when they were trapped.
         * - `beneficiary`: The location/account where the claimed assets will be deposited.
         */
        claim_assets: TxDescriptor<Anonymize<Ie68np0vpihith>>;
        /**
         * Transfer assets from the local chain to the destination chain using explicit transfer
         * types for assets and fees.
         *
         * `assets` must have same reserve location or may be teleportable to `dest`. Caller must
         * provide the `assets_transfer_type` to be used for `assets`:
         * - `TransferType::LocalReserve`: transfer assets to sovereign account of destination
         * chain and forward a notification XCM to `dest` to mint and deposit reserve-based
         * assets to `beneficiary`.
         * - `TransferType::DestinationReserve`: burn local assets and forward a notification to
         * `dest` chain to withdraw the reserve assets from this chain's sovereign account and
         * deposit them to `beneficiary`.
         * - `TransferType::RemoteReserve(reserve)`: burn local assets, forward XCM to `reserve`
         * chain to move reserves from this chain's SA to `dest` chain's SA, and forward another
         * XCM to `dest` to mint and deposit reserve-based assets to `beneficiary`. Typically
         * the remote `reserve` is Asset Hub.
         * - `TransferType::Teleport`: burn local assets and forward XCM to `dest` chain to
         * mint/teleport assets and deposit them to `beneficiary`.
         *
         * On the destination chain, as well as any intermediary hops, `BuyExecution` is used to
         * buy execution using transferred `assets` identified by `remote_fees_id`.
         * Make sure enough of the specified `remote_fees_id` asset is included in the given list
         * of `assets`. `remote_fees_id` should be enough to pay for `weight_limit`. If more weight
         * is needed than `weight_limit`, then the operation will fail and the sent assets may be
         * at risk.
         *
         * `remote_fees_id` may use different transfer type than rest of `assets` and can be
         * specified through `fees_transfer_type`.
         *
         * The caller needs to specify what should happen to the transferred assets once they reach
         * the `dest` chain. This is done through the `custom_xcm_on_dest` parameter, which
         * contains the instructions to execute on `dest` as a final step.
         * This is usually as simple as:
         * `Xcm(vec![DepositAsset { assets: Wild(AllCounted(assets.len())), beneficiary }])`,
         * but could be something more exotic like sending the `assets` even further.
         *
         * - `origin`: Must be capable of withdrawing the `assets` and executing XCM.
         * - `dest`: Destination context for the assets. Will typically be `[Parent,
         * Parachain(..)]` to send from parachain to parachain, or `[Parachain(..)]` to send from
         * relay to parachain, or `(parents: 2, (GlobalConsensus(..), ..))` to send from
         * parachain across a bridge to another ecosystem destination.
         * - `assets`: The assets to be withdrawn. This should include the assets used to pay the
         * fee on the `dest` (and possibly reserve) chains.
         * - `assets_transfer_type`: The XCM `TransferType` used to transfer the `assets`.
         * - `remote_fees_id`: One of the included `assets` to be used to pay fees.
         * - `fees_transfer_type`: The XCM `TransferType` used to transfer the `fees` assets.
         * - `custom_xcm_on_dest`: The XCM to be executed on `dest` chain as the last step of the
         * transfer, which also determines what happens to the assets on the destination chain.
         * - `weight_limit`: The remote-side weight limit, if any, for the XCM fee purchase.
         */
        transfer_assets_using_type_and_then: TxDescriptor<Anonymize<I9bnv6lu0crf1q>>;
        /**
         * Authorize another `aliaser` location to alias into the local `origin` making this call.
         * The `aliaser` is only authorized until the provided `expiry` block number.
         * The call can also be used for a previously authorized alias in order to update its
         * `expiry` block number.
         *
         * Usually useful to allow your local account to be aliased into from a remote location
         * also under your control (like your account on another chain).
         *
         * WARNING: make sure the caller `origin` (you) trusts the `aliaser` location to act in
         * their/your name. Once authorized using this call, the `aliaser` can freely impersonate
         * `origin` in XCM programs executed on the local chain.
         */
        add_authorized_alias: TxDescriptor<Anonymize<Iauhjqifrdklq7>>;
        /**
         * Remove a previously authorized `aliaser` from the list of locations that can alias into
         * the local `origin` making this call.
         */
        remove_authorized_alias: TxDescriptor<Anonymize<Ie1uso9m8rt5cf>>;
        /**
         * Remove all previously authorized `aliaser`s that can alias into the local `origin`
         * making this call.
         */
        remove_all_authorized_aliases: TxDescriptor<undefined>;
    };
    MessageQueue: {
        /**
         * Remove a page which has no more messages remaining to be processed or is stale.
         */
        reap_page: TxDescriptor<Anonymize<I40pqum1mu8qg3>>;
        /**
         * Execute an overweight message.
         *
         * Temporary processing errors will be propagated whereas permanent errors are treated
         * as success condition.
         *
         * - `origin`: Must be `Signed`.
         * - `message_origin`: The origin from which the message to be executed arrived.
         * - `page`: The page in the queue in which the message to be executed is sitting.
         * - `index`: The index into the queue of the message to be executed.
         * - `weight_limit`: The maximum amount of weight allowed to be consumed in the execution
         * of the message.
         *
         * Benchmark complexity considerations: O(index + weight_limit).
         */
        execute_overweight: TxDescriptor<Anonymize<I1r4c2ghbtvjuc>>;
    };
    Utility: {
        /**
         * Send a batch of dispatch calls.
         *
         * May be called from any origin except `None`.
         *
         * - `calls`: The calls to be dispatched from the same origin. The number of call must not
         * exceed the constant: `batched_calls_limit` (available in constant metadata).
         *
         * If origin is root then the calls are dispatched without checking origin filter. (This
         * includes bypassing `frame_system::Config::BaseCallFilter`).
         *
         * ## Complexity
         * - O(C) where C is the number of calls to be batched.
         *
         * This will return `Ok` in all circumstances. To determine the success of the batch, an
         * event is deposited. If a call failed and the batch was interrupted, then the
         * `BatchInterrupted` event is deposited, along with the number of successful calls made
         * and the error of the failed call. If all were successful, then the `BatchCompleted`
         * event is deposited.
         */
        batch: TxDescriptor<Anonymize<I2eo57miukmm8b>>;
        /**
         * Send a call through an indexed pseudonym of the sender.
         *
         * Filter from origin are passed along. The call will be dispatched with an origin which
         * use the same filter as the origin of this call.
         *
         * NOTE: If you need to ensure that any account-based filtering is not honored (i.e.
         * because you expect `proxy` to have been used prior in the call stack and you do not want
         * the call restrictions to apply to any sub-accounts), then use `as_multi_threshold_1`
         * in the Multisig pallet instead.
         *
         * NOTE: Prior to version *12, this was called `as_limited_sub`.
         *
         * The dispatch origin for this call must be _Signed_.
         */
        as_derivative: TxDescriptor<Anonymize<Ic6go0lokd61vu>>;
        /**
         * Send a batch of dispatch calls and atomically execute them.
         * The whole transaction will rollback and fail if any of the calls failed.
         *
         * May be called from any origin except `None`.
         *
         * - `calls`: The calls to be dispatched from the same origin. The number of call must not
         * exceed the constant: `batched_calls_limit` (available in constant metadata).
         *
         * If origin is root then the calls are dispatched without checking origin filter. (This
         * includes bypassing `frame_system::Config::BaseCallFilter`).
         *
         * ## Complexity
         * - O(C) where C is the number of calls to be batched.
         */
        batch_all: TxDescriptor<Anonymize<I2eo57miukmm8b>>;
        /**
         * Dispatches a function call with a provided origin.
         *
         * The dispatch origin for this call must be _Root_.
         *
         * ## Complexity
         * - O(1).
         */
        dispatch_as: TxDescriptor<Anonymize<I75gjumrbf7721>>;
        /**
         * Send a batch of dispatch calls.
         * Unlike `batch`, it allows errors and won't interrupt.
         *
         * May be called from any origin except `None`.
         *
         * - `calls`: The calls to be dispatched from the same origin. The number of call must not
         * exceed the constant: `batched_calls_limit` (available in constant metadata).
         *
         * If origin is root then the calls are dispatch without checking origin filter. (This
         * includes bypassing `frame_system::Config::BaseCallFilter`).
         *
         * ## Complexity
         * - O(C) where C is the number of calls to be batched.
         */
        force_batch: TxDescriptor<Anonymize<I2eo57miukmm8b>>;
        /**
         * Dispatch a function call with a specified weight.
         *
         * This function does not check the weight of the call, and instead allows the
         * Root origin to specify the weight of the call.
         *
         * The dispatch origin for this call must be _Root_.
         */
        with_weight: TxDescriptor<Anonymize<I6615brjv6tue2>>;
        /**
         * Dispatch a fallback call in the event the main call fails to execute.
         * May be called from any origin except `None`.
         *
         * This function first attempts to dispatch the `main` call.
         * If the `main` call fails, the `fallback` is attemted.
         * if the fallback is successfully dispatched, the weights of both calls
         * are accumulated and an event containing the main call error is deposited.
         *
         * In the event of a fallback failure the whole call fails
         * with the weights returned.
         *
         * - `main`: The main call to be dispatched. This is the primary action to execute.
         * - `fallback`: The fallback call to be dispatched in case the `main` call fails.
         *
         * ## Dispatch Logic
         * - If the origin is `root`, both the main and fallback calls are executed without
         * applying any origin filters.
         * - If the origin is not `root`, the origin filter is applied to both the `main` and
         * `fallback` calls.
         *
         * ## Use Case
         * - Some use cases might involve submitting a `batch` type call in either main, fallback
         * or both.
         */
        if_else: TxDescriptor<Anonymize<I95rdeeh0vpq7r>>;
        /**
         * Dispatches a function call with a provided origin.
         *
         * Almost the same as [`Pallet::dispatch_as`] but forwards any error of the inner call.
         *
         * The dispatch origin for this call must be _Root_.
         */
        dispatch_as_fallible: TxDescriptor<Anonymize<I75gjumrbf7721>>;
    };
    Multisig: {
        /**
         * Immediately dispatch a multi-signature call using a single approval from the caller.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * - `other_signatories`: The accounts (other than the sender) who are part of the
         * multi-signature, but do not participate in the approval process.
         * - `call`: The call to be executed.
         *
         * Result is equivalent to the dispatched result.
         *
         * ## Complexity
         * O(Z + C) where Z is the length of the call and C its execution weight.
         */
        as_multi_threshold_1: TxDescriptor<Anonymize<I2c4n6ll6fucck>>;
        /**
         * Register approval for a dispatch to be made from a deterministic composite account if
         * approved by a total of `threshold - 1` of `other_signatories`.
         *
         * **If the approval threshold is met (including the sender's approval), this will
         * immediately execute the call.** This is the only way to execute a multisig call -
         * `approve_as_multi` will never trigger execution.
         *
         * Payment: `DepositBase` will be reserved if this is the first approval, plus
         * `threshold` times `DepositFactor`. It is returned once this dispatch happens or
         * is cancelled.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * - `threshold`: The total number of approvals for this dispatch before it is executed.
         * - `other_signatories`: The accounts (other than the sender) who can approve this
         * dispatch. May not be empty.
         * - `maybe_timepoint`: If this is the first approval, then this must be `None`. If it is
         * not the first approval, then it must be `Some`, with the timepoint (block number and
         * transaction index) of the first approval transaction.
         * - `call`: The call to be executed.
         *
         * NOTE: For intermediate approvals (not the final approval), you should generally use
         * `approve_as_multi` instead, since it only requires a hash of the call and is more
         * efficient.
         *
         * Result is equivalent to the dispatched result if `threshold` is exactly `1`. Otherwise
         * on success, result is `Ok` and the result from the interior call, if it was executed,
         * may be found in the deposited `MultisigExecuted` event.
         *
         * ## Complexity
         * - `O(S + Z + Call)`.
         * - Up to one balance-reserve or unreserve operation.
         * - One passthrough operation, one insert, both `O(S)` where `S` is the number of
         * signatories. `S` is capped by `MaxSignatories`, with weight being proportional.
         * - One call encode & hash, both of complexity `O(Z)` where `Z` is tx-len.
         * - One encode & hash, both of complexity `O(S)`.
         * - Up to one binary search and insert (`O(logS + S)`).
         * - I/O: 1 read `O(S)`, up to 1 mutate `O(S)`. Up to one remove.
         * - One event.
         * - The weight of the `call`.
         * - Storage: inserts one item, value size bounded by `MaxSignatories`, with a deposit
         * taken for its lifetime of `DepositBase + threshold * DepositFactor`.
         */
        as_multi: TxDescriptor<Anonymize<I5ap28jt3ngolg>>;
        /**
         * Register approval for a dispatch to be made from a deterministic composite account if
         * approved by a total of `threshold - 1` of `other_signatories`.
         *
         * **This function will NEVER execute the call, even if the approval threshold is
         * reached.** It only registers approval. To actually execute the call, `as_multi` must
         * be called with the full call data by any of the signatories.
         *
         * This function is more efficient than `as_multi` for intermediate approvals since it
         * only requires the call hash, not the full call data.
         *
         * Payment: `DepositBase` will be reserved if this is the first approval, plus
         * `threshold` times `DepositFactor`. It is returned once this dispatch happens or
         * is cancelled.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * - `threshold`: The total number of approvals for this dispatch before it is executed.
         * - `other_signatories`: The accounts (other than the sender) who can approve this
         * dispatch. May not be empty.
         * - `maybe_timepoint`: If this is the first approval, then this must be `None`. If it is
         * not the first approval, then it must be `Some`, with the timepoint (block number and
         * transaction index) of the first approval transaction.
         * - `call_hash`: The hash of the call to be executed.
         *
         * NOTE: To execute the call after approvals are gathered, any signatory must call
         * `as_multi` with the full call data. This function cannot execute the call.
         *
         * ## Complexity
         * - `O(S)`.
         * - Up to one balance-reserve or unreserve operation.
         * - One passthrough operation, one insert, both `O(S)` where `S` is the number of
         * signatories. `S` is capped by `MaxSignatories`, with weight being proportional.
         * - One encode & hash, both of complexity `O(S)`.
         * - Up to one binary search and insert (`O(logS + S)`).
         * - I/O: 1 read `O(S)`, up to 1 mutate `O(S)`. Up to one remove.
         * - One event.
         * - Storage: inserts one item, value size bounded by `MaxSignatories`, with a deposit
         * taken for its lifetime of `DepositBase + threshold * DepositFactor`.
         */
        approve_as_multi: TxDescriptor<Anonymize<Ideaemvoneh309>>;
        /**
         * Cancel a pre-existing, on-going multisig transaction. Any deposit reserved previously
         * for this operation will be unreserved on success.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * - `threshold`: The total number of approvals for this dispatch before it is executed.
         * - `other_signatories`: The accounts (other than the sender) who can approve this
         * dispatch. May not be empty.
         * - `timepoint`: The timepoint (block number and transaction index) of the first approval
         * transaction for this dispatch.
         * - `call_hash`: The hash of the call to be executed.
         *
         * ## Complexity
         * - `O(S)`.
         * - Up to one balance-reserve or unreserve operation.
         * - One passthrough operation, one insert, both `O(S)` where `S` is the number of
         * signatories. `S` is capped by `MaxSignatories`, with weight being proportional.
         * - One encode & hash, both of complexity `O(S)`.
         * - One event.
         * - I/O: 1 read `O(S)`, one remove.
         * - Storage: removes one item.
         */
        cancel_as_multi: TxDescriptor<Anonymize<I3d9o9d7epp66v>>;
        /**
         * Poke the deposit reserved for an existing multisig operation.
         *
         * The dispatch origin for this call must be _Signed_ and must be the original depositor of
         * the multisig operation.
         *
         * The transaction fee is waived if the deposit amount has changed.
         *
         * - `threshold`: The total number of approvals needed for this multisig.
         * - `other_signatories`: The accounts (other than the sender) who are part of the
         * multisig.
         * - `call_hash`: The hash of the call this deposit is reserved for.
         *
         * Emits `DepositPoked` if successful.
         */
        poke_deposit: TxDescriptor<Anonymize<I6lqh1vgb4mcja>>;
    };
    Proxy: {
        /**
         * Dispatch the given `call` from an account that the sender is authorised for through
         * `add_proxy`.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `real`: The account that the proxy will make a call on behalf of.
         * - `force_proxy_type`: Specify the exact proxy type to be used and checked for this call.
         * - `call`: The call to be made by the `real` account.
         */
        proxy: TxDescriptor<Anonymize<I63fta9lljd740>>;
        /**
         * Register a proxy account for the sender that is able to make calls on its behalf.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `proxy`: The account that the `caller` would like to make a proxy.
         * - `proxy_type`: The permissions allowed for this proxy account.
         * - `delay`: The announcement period required of the initial proxy. Will generally be
         * zero.
         */
        add_proxy: TxDescriptor<Anonymize<Ieo0t3g18srm0g>>;
        /**
         * Unregister a proxy account for the sender.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `proxy`: The account that the `caller` would like to remove as a proxy.
         * - `proxy_type`: The permissions currently enabled for the removed proxy account.
         */
        remove_proxy: TxDescriptor<Anonymize<Ieo0t3g18srm0g>>;
        /**
         * Unregister all proxy accounts for the sender.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * WARNING: This may be called on accounts created by `create_pure`, however if done, then
         * the unreserved fees will be inaccessible. **All access to this account will be lost.**
         */
        remove_proxies: TxDescriptor<undefined>;
        /**
         * Spawn a fresh new account that is guaranteed to be otherwise inaccessible, and
         * initialize it with a proxy of `proxy_type` for `origin` sender.
         *
         * Requires a `Signed` origin.
         *
         * - `proxy_type`: The type of the proxy that the sender will be registered as over the
         * new account. This will almost always be the most permissive `ProxyType` possible to
         * allow for maximum flexibility.
         * - `index`: A disambiguation index, in case this is called multiple times in the same
         * transaction (e.g. with `utility::batch`). Unless you're using `batch` you probably just
         * want to use `0`.
         * - `delay`: The announcement period required of the initial proxy. Will generally be
         * zero.
         *
         * Fails with `Duplicate` if this has already been called in this transaction, from the
         * same sender, with the same parameters.
         *
         * Fails if there are insufficient funds to pay for deposit.
         */
        create_pure: TxDescriptor<Anonymize<I9jcbqm9l47vmu>>;
        /**
         * Removes a previously spawned pure proxy.
         *
         * WARNING: **All access to this account will be lost.** Any funds held in it will be
         * inaccessible.
         *
         * Requires a `Signed` origin, and the sender account must have been created by a call to
         * `create_pure` with corresponding parameters.
         *
         * - `spawner`: The account that originally called `create_pure` to create this account.
         * - `index`: The disambiguation index originally passed to `create_pure`. Probably `0`.
         * - `proxy_type`: The proxy type originally passed to `create_pure`.
         * - `height`: The height of the chain when the call to `create_pure` was processed.
         * - `ext_index`: The extrinsic index in which the call to `create_pure` was processed.
         *
         * Fails with `NoPermission` in case the caller is not a previously created pure
         * account whose `create_pure` call has corresponding parameters.
         */
        kill_pure: TxDescriptor<Anonymize<I6j9khqhmttlmc>>;
        /**
         * Publish the hash of a proxy-call that will be made in the future.
         *
         * This must be called some number of blocks before the corresponding `proxy` is attempted
         * if the delay associated with the proxy relationship is greater than zero.
         *
         * No more than `MaxPending` announcements may be made at any one time.
         *
         * This will take a deposit of `AnnouncementDepositFactor` as well as
         * `AnnouncementDepositBase` if there are no other pending announcements.
         *
         * The dispatch origin for this call must be _Signed_ and a proxy of `real`.
         *
         * Parameters:
         * - `real`: The account that the proxy will make a call on behalf of.
         * - `call_hash`: The hash of the call to be made by the `real` account.
         */
        announce: TxDescriptor<Anonymize<I2eb501t8s6hsq>>;
        /**
         * Remove a given announcement.
         *
         * May be called by a proxy account to remove a call they previously announced and return
         * the deposit.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `real`: The account that the proxy will make a call on behalf of.
         * - `call_hash`: The hash of the call to be made by the `real` account.
         */
        remove_announcement: TxDescriptor<Anonymize<I2eb501t8s6hsq>>;
        /**
         * Remove the given announcement of a delegate.
         *
         * May be called by a target (proxied) account to remove a call that one of their delegates
         * (`delegate`) has announced they want to execute. The deposit is returned.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `delegate`: The account that previously announced the call.
         * - `call_hash`: The hash of the call to be made.
         */
        reject_announcement: TxDescriptor<Anonymize<Ianmuoljk2sk1u>>;
        /**
         * Dispatch the given `call` from an account that the sender is authorized for through
         * `add_proxy`.
         *
         * Removes any corresponding announcement(s).
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * Parameters:
         * - `real`: The account that the proxy will make a call on behalf of.
         * - `force_proxy_type`: Specify the exact proxy type to be used and checked for this call.
         * - `call`: The call to be made by the `real` account.
         */
        proxy_announced: TxDescriptor<Anonymize<I4ro3h76fk8qmr>>;
        /**
         * Poke / Adjust deposits made for proxies and announcements based on current values.
         * This can be used by accounts to possibly lower their locked amount.
         *
         * The dispatch origin for this call must be _Signed_.
         *
         * The transaction fee is waived if the deposit amount has changed.
         *
         * Emits `DepositPoked` if successful.
         */
        poke_deposit: TxDescriptor<undefined>;
    };
    Preimage: {
        /**
         * Register a preimage on-chain.
         *
         * If the preimage was previously requested, no fees or deposits are taken for providing
         * the preimage. Otherwise, a deposit is taken proportional to the size of the preimage.
         */
        note_preimage: TxDescriptor<Anonymize<I82nfqfkd48n10>>;
        /**
         * Clear an unrequested preimage from the runtime storage.
         *
         * If `len` is provided, then it will be a much cheaper operation.
         *
         * - `hash`: The hash of the preimage to be removed from the store.
         * - `len`: The length of the preimage of `hash`.
         */
        unnote_preimage: TxDescriptor<Anonymize<I1jm8m1rh9e20v>>;
        /**
         * Request a preimage be uploaded to the chain without paying any fees or deposits.
         *
         * If the preimage requests has already been provided on-chain, we unreserve any deposit
         * a user may have paid, and take the control of the preimage out of their hands.
         */
        request_preimage: TxDescriptor<Anonymize<I1jm8m1rh9e20v>>;
        /**
         * Clear a previously made request for a preimage.
         *
         * NOTE: THIS MUST NOT BE CALLED ON `hash` MORE TIMES THAN `request_preimage`.
         */
        unrequest_preimage: TxDescriptor<Anonymize<I1jm8m1rh9e20v>>;
        /**
         * Ensure that the bulk of pre-images is upgraded.
         *
         * The caller pays no fee if at least 90% of pre-images were successfully updated.
         */
        ensure_updated: TxDescriptor<Anonymize<I3o5j3bli1pd8e>>;
    };
    Scheduler: {
        /**
         * Anonymously schedule a task.
         */
        schedule: TxDescriptor<Anonymize<I8sn7103tnqt7i>>;
        /**
         * Cancel a scheduled task (named or anonymous), by providing the block it is scheduled for
         * execution in, as well as the index of the task in that block's agenda.
         *
         * In the case of a named task, it will remove it from the lookup table as well.
         */
        cancel: TxDescriptor<Anonymize<I5n4sebgkfr760>>;
        /**
         * Schedule a named task.
         */
        schedule_named: TxDescriptor<Anonymize<Ibett4ik8t9cia>>;
        /**
         * Cancel a named scheduled task.
         */
        cancel_named: TxDescriptor<Anonymize<Ifs1i5fk9cqvr6>>;
        /**
         * Anonymously schedule a task after a delay.
         */
        schedule_after: TxDescriptor<Anonymize<I3kkq7pse0860j>>;
        /**
         * Schedule a named task after a delay.
         */
        schedule_named_after: TxDescriptor<Anonymize<I53mj6mot6nvhu>>;
        /**
         * Set a retry configuration for a task so that, in case its scheduled run fails, it will
         * be retried after `period` blocks, for a total amount of `retries` retries or until it
         * succeeds.
         *
         * Tasks which need to be scheduled for a retry are still subject to weight metering and
         * agenda space, same as a regular task. If a periodic task fails, it will be scheduled
         * normally while the task is retrying.
         *
         * Tasks scheduled as a result of a retry for a periodic task are unnamed, non-periodic
         * clones of the original task. Their retry configuration will be derived from the
         * original task's configuration, but will have a lower value for `remaining` than the
         * original `total_retries`.
         *
         * This call **cannot** be used to set a retry configuration for a named task.
         */
        set_retry: TxDescriptor<Anonymize<Ieg3fd8p4pkt10>>;
        /**
         * Set a retry configuration for a named task so that, in case its scheduled run fails, it
         * will be retried after `period` blocks, for a total amount of `retries` retries or until
         * it succeeds.
         *
         * Tasks which need to be scheduled for a retry are still subject to weight metering and
         * agenda space, same as a regular task. If a periodic task fails, it will be scheduled
         * normally while the task is retrying.
         *
         * Tasks scheduled as a result of a retry for a periodic task are unnamed, non-periodic
         * clones of the original task. Their retry configuration will be derived from the
         * original task's configuration, but will have a lower value for `remaining` than the
         * original `total_retries`.
         *
         * This is the only way to set a retry configuration for a named task.
         */
        set_retry_named: TxDescriptor<Anonymize<I8kg5ll427kfqq>>;
        /**
         * Removes the retry configuration of a task.
         */
        cancel_retry: TxDescriptor<Anonymize<I467333262q1l9>>;
        /**
         * Cancel the retry configuration of a named task.
         */
        cancel_retry_named: TxDescriptor<Anonymize<Ifs1i5fk9cqvr6>>;
    };
    AssetRate: {
        /**
         * Initialize a conversion rate to native balance for the given asset.
         *
         * ## Complexity
         * - O(1)
         */
        create: TxDescriptor<Anonymize<I9c4d50jrp7as1>>;
        /**
         * Update the conversion rate to native balance for the given asset.
         *
         * ## Complexity
         * - O(1)
         */
        update: TxDescriptor<Anonymize<I9c4d50jrp7as1>>;
        /**
         * Remove an existing conversion rate to native balance for the given asset.
         *
         * ## Complexity
         * - O(1)
         */
        remove: TxDescriptor<Anonymize<Ifplevr9hp8jo3>>;
    };
    Alliance: {
        /**
         * Add a new proposal to be voted on.
         *
         * Must be called by a Fellow.
         */
        propose: TxDescriptor<Anonymize<I9lf8a927r9bdc>>;
        /**
         * Add an aye or nay vote for the sender to the given proposal.
         *
         * Must be called by a Fellow.
         */
        vote: TxDescriptor<Anonymize<I2dtrijkm5601t>>;
        /**
         * Initialize the Alliance, onboard fellows and allies.
         *
         * The Alliance must be empty, and the call must provide some founding members.
         *
         * Must be called by the Root origin.
         */
        init_members: TxDescriptor<Anonymize<Ia61kag3grdevk>>;
        /**
         * Disband the Alliance, remove all active members and unreserve deposits.
         *
         * Witness data must be set.
         */
        disband: TxDescriptor<Anonymize<Icq0crsj7vrl4j>>;
        /**
         * Set a new IPFS CID to the alliance rule.
         */
        set_rule: TxDescriptor<Anonymize<I465k81tqg3usk>>;
        /**
         * Make an announcement of a new IPFS CID about alliance issues.
         */
        announce: TxDescriptor<Anonymize<I54d7mcgvp9b3a>>;
        /**
         * Remove an announcement.
         */
        remove_announcement: TxDescriptor<Anonymize<I54d7mcgvp9b3a>>;
        /**
         * Submit oneself for candidacy. A fixed deposit is reserved.
         */
        join_alliance: TxDescriptor<undefined>;
        /**
         * A Fellow can nominate someone to join the alliance as an Ally. There is no deposit
         * required from the nominator or nominee.
         */
        nominate_ally: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Elevate an Ally to Fellow.
         */
        elevate_ally: TxDescriptor<Anonymize<Ifh7bf8l1mktj3>>;
        /**
         * As a member, give a retirement notice and start a retirement period required to pass in
         * order to retire.
         */
        give_retirement_notice: TxDescriptor<undefined>;
        /**
         * As a member, retire from the Alliance and unreserve the deposit.
         *
         * This can only be done once you have called `give_retirement_notice` and the
         * `RetirementPeriod` has passed.
         */
        retire: TxDescriptor<undefined>;
        /**
         * Kick a member from the Alliance and slash its deposit.
         */
        kick_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Add accounts or websites to the list of unscrupulous items.
         */
        add_unscrupulous_items: TxDescriptor<Anonymize<Ickqr13ag0mv3c>>;
        /**
         * Deem some items no longer unscrupulous.
         */
        remove_unscrupulous_items: TxDescriptor<Anonymize<Ickqr13ag0mv3c>>;
        /**
         * Close a vote that is either approved, disapproved, or whose voting period has ended.
         *
         * Must be called by a Fellow.
         */
        close: TxDescriptor<Anonymize<Ib2obgji960euh>>;
        /**
         * Abdicate one's position as a voting member and just be an Ally. May be used by Fellows
         * who do not want to leave the Alliance but do not have the capacity to participate
         * operationally for some time.
         */
        abdicate_fellow_status: TxDescriptor<undefined>;
    };
    AllianceMotion: {
        /**
         * Set the collective's membership.
         *
         * - `new_members`: The new member list. Be nice to the chain and provide it sorted.
         * - `prime`: The prime member whose vote sets the default.
         * - `old_count`: The upper bound for the previous number of members in storage. Used for
         * weight estimation.
         *
         * The dispatch of this call must be `SetMembersOrigin`.
         *
         * NOTE: Does not enforce the expected `MaxMembers` limit on the amount of members, but
         * the weight estimations rely on it to estimate dispatchable weight.
         *
         * # WARNING:
         *
         * The `pallet-collective` can also be managed by logic outside of the pallet through the
         * implementation of the trait [`ChangeMembers`].
         * Any call to `set_members` must be careful that the member set doesn't get out of sync
         * with other logic managing the member set.
         *
         * ## Complexity:
         * - `O(MP + N)` where:
         * - `M` old-members-count (code- and governance-bounded)
         * - `N` new-members-count (code- and governance-bounded)
         * - `P` proposals-count (code-bounded)
         */
        set_members: TxDescriptor<Anonymize<I38jfk5li8iang>>;
        /**
         * Dispatch a proposal from a member using the `Member` origin.
         *
         * Origin must be a member of the collective.
         *
         * ## Complexity:
         * - `O(B + M + P)` where:
         * - `B` is `proposal` size in bytes (length-fee-bounded)
         * - `M` members-count (code-bounded)
         * - `P` complexity of dispatching `proposal`
         */
        execute: TxDescriptor<Anonymize<Icp4mrre3jvd64>>;
        /**
         * Add a new proposal to either be voted on or executed directly.
         *
         * Requires the sender to be member.
         *
         * `threshold` determines whether `proposal` is executed directly (`threshold < 2`)
         * or put up for voting.
         *
         * ## Complexity
         * - `O(B + M + P1)` or `O(B + M + P2)` where:
         * - `B` is `proposal` size in bytes (length-fee-bounded)
         * - `M` is members-count (code- and governance-bounded)
         * - branching is influenced by `threshold` where:
         * - `P1` is proposal execution complexity (`threshold < 2`)
         * - `P2` is proposals-count (code-bounded) (`threshold >= 2`)
         */
        propose: TxDescriptor<Anonymize<I9lf8a927r9bdc>>;
        /**
         * Add an aye or nay vote for the sender to the given proposal.
         *
         * Requires the sender to be a member.
         *
         * Transaction fees will be waived if the member is voting on any particular proposal
         * for the first time and the call is successful. Subsequent vote changes will charge a
         * fee.
         * ## Complexity
         * - `O(M)` where `M` is members-count (code- and governance-bounded)
         */
        vote: TxDescriptor<Anonymize<I2dtrijkm5601t>>;
        /**
         * Disapprove a proposal, close, and remove it from the system, regardless of its current
         * state.
         *
         * Must be called by the Root origin.
         *
         * Parameters:
         * * `proposal_hash`: The hash of the proposal that should be disapproved.
         *
         * ## Complexity
         * O(P) where P is the number of max proposals
         */
        disapprove_proposal: TxDescriptor<Anonymize<I2ev73t79f46tb>>;
        /**
         * Close a vote that is either approved, disapproved or whose voting period has ended.
         *
         * May be called by any signed account in order to finish voting and close the proposal.
         *
         * If called before the end of the voting period it will only close the vote if it is
         * has enough votes to be approved or disapproved.
         *
         * If called after the end of the voting period abstentions are counted as rejections
         * unless there is a prime member set and the prime member cast an approval.
         *
         * If the close operation completes successfully with disapproval, the transaction fee will
         * be waived. Otherwise execution of the approved operation will be charged to the caller.
         *
         * + `proposal_weight_bound`: The maximum amount of weight consumed by executing the closed
         * proposal.
         * + `length_bound`: The upper bound for the length of the proposal in storage. Checked via
         * `storage::read` so it is `size_of::<u32>() == 4` larger than the pure length.
         *
         * ## Complexity
         * - `O(B + M + P1 + P2)` where:
         * - `B` is `proposal` size in bytes (length-fee-bounded)
         * - `M` is members-count (code- and governance-bounded)
         * - `P1` is the complexity of `proposal` preimage.
         * - `P2` is proposal-count (code-bounded)
         */
        close: TxDescriptor<Anonymize<Ib2obgji960euh>>;
        /**
         * Disapprove the proposal and burn the cost held for storing this proposal.
         *
         * Parameters:
         * - `origin`: must be the `KillOrigin`.
         * - `proposal_hash`: The hash of the proposal that should be killed.
         *
         * Emits `Killed` and `ProposalCostBurned` if any cost was held for a given proposal.
         */
        kill: TxDescriptor<Anonymize<I2ev73t79f46tb>>;
        /**
         * Release the cost held for storing a proposal once the given proposal is completed.
         *
         * If there is no associated cost for the given proposal, this call will have no effect.
         *
         * Parameters:
         * - `origin`: must be `Signed` or `Root`.
         * - `proposal_hash`: The hash of the proposal.
         *
         * Emits `ProposalCostReleased` if any cost held for a given proposal.
         */
        release_proposal_cost: TxDescriptor<Anonymize<I2ev73t79f46tb>>;
    };
    FellowshipCollective: {
        /**
         * Introduce a new member.
         *
         * - `origin`: Must be the `AddOrigin`.
         * - `who`: Account of non-member which will become a member.
         *
         * Weight: `O(1)`
         */
        add_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Increment the rank of an existing member by one.
         *
         * - `origin`: Must be the `PromoteOrigin`.
         * - `who`: Account of existing member.
         *
         * Weight: `O(1)`
         */
        promote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Decrement the rank of an existing member by one. If the member is already at rank zero,
         * then they are removed entirely.
         *
         * - `origin`: Must be the `DemoteOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         *
         * Weight: `O(1)`, less if the member's index is highest in its rank.
         */
        demote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Remove the member entirely.
         *
         * - `origin`: Must be the `RemoveOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         * - `min_rank`: The rank of the member or greater.
         *
         * Weight: `O(min_rank)`.
         */
        remove_member: TxDescriptor<Anonymize<I3amdclkdfaipk>>;
        /**
         * Add an aye or nay vote for the sender to the given proposal.
         *
         * - `origin`: Must be `Signed` by a member account.
         * - `poll`: Index of a poll which is ongoing.
         * - `aye`: `true` if the vote is to approve the proposal, `false` otherwise.
         *
         * Transaction fees are be waived if the member is voting on any particular proposal
         * for the first time and the call is successful. Subsequent vote changes will charge a
         * fee.
         *
         * Weight: `O(1)`, less if there was no previous vote on the poll by the member.
         */
        vote: TxDescriptor<Anonymize<I8bvk21lpmah75>>;
        /**
         * Remove votes from the given poll. It must have ended.
         *
         * - `origin`: Must be `Signed` by any account.
         * - `poll_index`: Index of a poll which is completed and for which votes continue to
         * exist.
         * - `max`: Maximum number of vote items from remove in this call.
         *
         * Transaction fees are waived if the operation is successful.
         *
         * Weight `O(max)` (less if there are fewer items to remove than `max`).
         */
        cleanup_poll: TxDescriptor<Anonymize<I449n3riv6jbum>>;
        /**
         * Exchanges a member with a new account and the same existing rank.
         *
         * - `origin`: Must be the `ExchangeOrigin`.
         * - `who`: Account of existing member of rank greater than zero to be exchanged.
         * - `new_who`: New Account of existing member of rank greater than zero to exchanged to.
         */
        exchange_member: TxDescriptor<Anonymize<I9a7qiue67urvk>>;
    };
    FellowshipReferenda: {
        /**
         * Propose a referendum on a privileged action.
         *
         * - `origin`: must be `SubmitOrigin` and the account must have `SubmissionDeposit` funds
         * available.
         * - `proposal_origin`: The origin from which the proposal should be executed.
         * - `proposal`: The proposal.
         * - `enactment_moment`: The moment that the proposal should be enacted.
         *
         * Emits `Submitted`.
         */
        submit: TxDescriptor<Anonymize<I1121uie4s8u64>>;
        /**
         * Post the Decision Deposit for a referendum.
         *
         * - `origin`: must be `Signed` and the account must have funds available for the
         * referendum's track's Decision Deposit.
         * - `index`: The index of the submitted referendum whose Decision Deposit is yet to be
         * posted.
         *
         * Emits `DecisionDepositPlaced`.
         */
        place_decision_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Refund the Decision Deposit for a closed referendum back to the depositor.
         *
         * - `origin`: must be `Signed` or `Root`.
         * - `index`: The index of a closed referendum whose Decision Deposit has not yet been
         * refunded.
         *
         * Emits `DecisionDepositRefunded`.
         */
        refund_decision_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Cancel an ongoing referendum.
         *
         * - `origin`: must be the `CancelOrigin`.
         * - `index`: The index of the referendum to be cancelled.
         *
         * Emits `Cancelled`.
         */
        cancel: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Cancel an ongoing referendum and slash the deposits.
         *
         * - `origin`: must be the `KillOrigin`.
         * - `index`: The index of the referendum to be cancelled.
         *
         * Emits `Killed` and `DepositSlashed`.
         */
        kill: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Advance a referendum onto its next logical state. Only used internally.
         *
         * - `origin`: must be `Root`.
         * - `index`: the referendum to be advanced.
         */
        nudge_referendum: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Advance a track onto its next logical state. Only used internally.
         *
         * - `origin`: must be `Root`.
         * - `track`: the track to be advanced.
         *
         * Action item for when there is now one fewer referendum in the deciding phase and the
         * `DecidingCount` is not yet updated. This means that we should either:
         * - begin deciding another referendum (and leave `DecidingCount` alone); or
         * - decrement `DecidingCount`.
         */
        one_fewer_deciding: TxDescriptor<Anonymize<Icbio0e1f0034b>>;
        /**
         * Refund the Submission Deposit for a closed referendum back to the depositor.
         *
         * - `origin`: must be `Signed` or `Root`.
         * - `index`: The index of a closed referendum whose Submission Deposit has not yet been
         * refunded.
         *
         * Emits `SubmissionDepositRefunded`.
         */
        refund_submission_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Set or clear metadata of a referendum.
         *
         * Parameters:
         * - `origin`: Must be `Signed` by a creator of a referendum or by anyone to clear a
         * metadata of a finished referendum.
         * - `index`:  The index of a referendum to set or clear metadata for.
         * - `maybe_hash`: The hash of an on-chain stored preimage. `None` to clear a metadata.
         */
        set_metadata: TxDescriptor<Anonymize<I8c0vkqjjipnuj>>;
    };
    FellowshipCore: {
        /**
         * Bump the state of a member.
         *
         * This will demote a member whose `last_proof` is now beyond their rank's
         * `demotion_period`.
         *
         * - `origin`: A `Signed` origin of an account.
         * - `who`: A member account whose state is to be updated.
         */
        bump: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Set the parameters.
         *
         * - `origin`: An origin complying with `ParamsOrigin` or root.
         * - `params`: The new parameters for the pallet.
         */
        set_params: TxDescriptor<Anonymize<I5mruatkavn9hn>>;
        /**
         * Set whether a member is active or not.
         *
         * - `origin`: A `Signed` origin of a member's account.
         * - `is_active`: `true` iff the member is active.
         */
        set_active: TxDescriptor<Anonymize<I27vrusv8rgd90>>;
        /**
         * Approve a member to continue at their rank.
         *
         * This resets `last_proof` to the current block, thereby delaying any automatic demotion.
         *
         * `who` must already be tracked by this pallet for this to have an effect.
         *
         * - `origin`: An origin which satisfies `ApproveOrigin` or root.
         * - `who`: A member (i.e. of non-zero rank).
         * - `at_rank`: The rank of member.
         */
        approve: TxDescriptor<Anonymize<Ic79d2eioda33s>>;
        /**
         * Introduce a new and unranked candidate (rank zero).
         *
         * - `origin`: An origin which satisfies `InductOrigin` or root.
         * - `who`: The account ID of the candidate to be inducted and become a member.
         */
        induct: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Increment the rank of a ranked and tracked account.
         *
         * - `origin`: An origin which satisfies `PromoteOrigin` with a `Success` result of
         * `to_rank` or more or root.
         * - `who`: The account ID of the member to be promoted to `to_rank`.
         * - `to_rank`: One more than the current rank of `who`.
         */
        promote: TxDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Fast promotions can skip ranks and ignore the `min_promotion_period`.
         *
         * This is useful for out-of-band promotions, hence it has its own `FastPromoteOrigin` to
         * be (possibly) more restrictive than `PromoteOrigin`. Note that the member must already
         * be inducted.
         */
        promote_fast: TxDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Stop tracking a prior member who is now not a ranked member of the collective.
         *
         * - `origin`: A `Signed` origin of an account.
         * - `who`: The ID of an account which was tracked in this pallet but which is now not a
         * ranked member of the collective.
         */
        offboard: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Provide evidence that a rank is deserved.
         *
         * This is free as long as no evidence for the forthcoming judgement is already submitted.
         * Evidence is cleared after an outcome (either demotion, promotion of approval).
         *
         * - `origin`: A `Signed` origin of an inducted and ranked account.
         * - `wish`: The stated desire of the member.
         * - `evidence`: A dump of evidence to be considered. This should generally be either a
         * Markdown-encoded document or a series of 32-byte hashes which can be found on a
         * decentralised content-based-indexing system such as IPFS.
         */
        submit_evidence: TxDescriptor<Anonymize<I5il2eoab4j61e>>;
        /**
         * Introduce an already-ranked individual of the collective into this pallet.
         *
         * The rank may still be zero. This resets `last_proof` to the current block and
         * `last_promotion` will be set to zero, thereby delaying any automatic demotion but
         * allowing immediate promotion.
         *
         * - `origin`: A signed origin of a ranked, but not tracked, account.
         */
        import: TxDescriptor<undefined>;
        /**
         * Introduce an already-ranked individual of the collective into this pallet.
         *
         * The rank may still be zero. Can be called by anyone on any collective member - including
         * the sender.
         *
         * This resets `last_proof` to the current block and `last_promotion` will be set to zero,
         * thereby delaying any automatic demotion but allowing immediate promotion.
         *
         * - `origin`: A signed origin of a ranked, but not tracked, account.
         * - `who`: The account ID of the collective member to be inducted.
         */
        import_member: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Set the parameters partially.
         *
         * - `origin`: An origin complying with `ParamsOrigin` or root.
         * - `partial_params`: The new parameters for the pallet.
         *
         * This update config with multiple arguments without duplicating
         * the fields that does not need to update (set to None).
         */
        set_partial_params: TxDescriptor<Anonymize<Idt0cq08n4po4d>>;
    };
    FellowshipSalary: {
        /**
         * Start the first payout cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        init: TxDescriptor<undefined>;
        /**
         * Move to next payout cycle, assuming that the present block is now within that cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        bump: TxDescriptor<undefined>;
        /**
         * Induct oneself into the payout system.
         */
        induct: TxDescriptor<undefined>;
        /**
         * Register for a payout.
         *
         * Will only work if we are in the first `RegistrationPeriod` blocks since the cycle
         * started.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        register: TxDescriptor<undefined>;
        /**
         * Request a payout.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        payout: TxDescriptor<undefined>;
        /**
         * Request a payout to a secondary account.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         * - `beneficiary`: The account to receive payment.
         */
        payout_other: TxDescriptor<Anonymize<I8ligieds2efci>>;
        /**
         * Update a payment's status; if it failed, alter the state so the payment can be retried.
         *
         * This must be called within the same cycle as the failed payment. It will fail with
         * `Event::NotCurrent` otherwise.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members` who has
         * received a payment this cycle.
         */
        check_payment: TxDescriptor<undefined>;
    };
    FellowshipTreasury: {
        /**
         * Propose and approve a spend of treasury funds.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::SpendOrigin`] with the `Success` value being at least `amount`.
         *
         * ### Details
         * NOTE: For record-keeping purposes, the proposer is deemed to be equivalent to the
         * beneficiary.
         *
         * ### Parameters
         * - `amount`: The amount to be transferred from the treasury to the `beneficiary`.
         * - `beneficiary`: The destination account for the transfer.
         *
         * ## Events
         *
         * Emits [`Event::SpendApproved`] if successful.
         */
        spend_local: TxDescriptor<Anonymize<Icnrv1mfbd3in1>>;
        /**
         * Force a previously approved proposal to be removed from the approval queue.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::RejectOrigin`].
         *
         * ## Details
         *
         * The original deposit will no longer be returned.
         *
         * ### Parameters
         * - `proposal_id`: The index of a proposal
         *
         * ### Complexity
         * - O(A) where `A` is the number of approvals
         *
         * ### Errors
         * - [`Error::ProposalNotApproved`]: The `proposal_id` supplied was not found in the
         * approval queue, i.e., the proposal has not been approved. This could also mean the
         * proposal does not exist altogether, thus there is no way it would have been approved
         * in the first place.
         */
        remove_approval: TxDescriptor<Anonymize<Icm9m0qeemu66d>>;
        /**
         * Propose and approve a spend of treasury funds.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::SpendOrigin`] with the `Success` value being at least
         * `amount` of `asset_kind` in the native asset. The amount of `asset_kind` is converted
         * for assertion using the [`Config::BalanceConverter`].
         *
         * ## Details
         *
         * Create an approved spend for transferring a specific `amount` of `asset_kind` to a
         * designated beneficiary. The spend must be claimed using the `payout` dispatchable within
         * the [`Config::PayoutPeriod`].
         *
         * ### Parameters
         * - `asset_kind`: An indicator of the specific asset class to be spent.
         * - `amount`: The amount to be transferred from the treasury to the `beneficiary`.
         * - `beneficiary`: The beneficiary of the spend.
         * - `valid_from`: The block number from which the spend can be claimed. It can refer to
         * the past if the resulting spend has not yet expired according to the
         * [`Config::PayoutPeriod`]. If `None`, the spend can be claimed immediately after
         * approval.
         *
         * ## Events
         *
         * Emits [`Event::AssetSpendApproved`] if successful.
         */
        spend: TxDescriptor<Anonymize<I3pnhorh539dti>>;
        /**
         * Claim a spend.
         *
         * ## Dispatch Origin
         *
         * Must be signed
         *
         * ## Details
         *
         * Spends must be claimed within some temporal bounds. A spend may be claimed within one
         * [`Config::PayoutPeriod`] from the `valid_from` block.
         * In case of a payout failure, the spend status must be updated with the `check_status`
         * dispatchable before retrying with the current function.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::Paid`] if successful.
         */
        payout: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Check the status of the spend and remove it from the storage if processed.
         *
         * ## Dispatch Origin
         *
         * Must be signed.
         *
         * ## Details
         *
         * The status check is a prerequisite for retrying a failed payout.
         * If a spend has either succeeded or expired, it is removed from the storage by this
         * function. In such instances, transaction fees are refunded.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::PaymentFailed`] if the spend payout has failed.
         * Emits [`Event::SpendProcessed`] if the spend payout has succeed.
         */
        check_status: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Void previously approved spend.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::RejectOrigin`].
         *
         * ## Details
         *
         * A spend void is only possible if the payout has not been attempted yet.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::AssetSpendVoided`] if successful.
         */
        void_spend: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
    };
    AmbassadorCollective: {
        /**
         * Introduce a new member.
         *
         * - `origin`: Must be the `AddOrigin`.
         * - `who`: Account of non-member which will become a member.
         *
         * Weight: `O(1)`
         */
        add_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Increment the rank of an existing member by one.
         *
         * - `origin`: Must be the `PromoteOrigin`.
         * - `who`: Account of existing member.
         *
         * Weight: `O(1)`
         */
        promote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Decrement the rank of an existing member by one. If the member is already at rank zero,
         * then they are removed entirely.
         *
         * - `origin`: Must be the `DemoteOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         *
         * Weight: `O(1)`, less if the member's index is highest in its rank.
         */
        demote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Remove the member entirely.
         *
         * - `origin`: Must be the `RemoveOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         * - `min_rank`: The rank of the member or greater.
         *
         * Weight: `O(min_rank)`.
         */
        remove_member: TxDescriptor<Anonymize<I3amdclkdfaipk>>;
        /**
         * Add an aye or nay vote for the sender to the given proposal.
         *
         * - `origin`: Must be `Signed` by a member account.
         * - `poll`: Index of a poll which is ongoing.
         * - `aye`: `true` if the vote is to approve the proposal, `false` otherwise.
         *
         * Transaction fees are be waived if the member is voting on any particular proposal
         * for the first time and the call is successful. Subsequent vote changes will charge a
         * fee.
         *
         * Weight: `O(1)`, less if there was no previous vote on the poll by the member.
         */
        vote: TxDescriptor<Anonymize<I8bvk21lpmah75>>;
        /**
         * Remove votes from the given poll. It must have ended.
         *
         * - `origin`: Must be `Signed` by any account.
         * - `poll_index`: Index of a poll which is completed and for which votes continue to
         * exist.
         * - `max`: Maximum number of vote items from remove in this call.
         *
         * Transaction fees are waived if the operation is successful.
         *
         * Weight `O(max)` (less if there are fewer items to remove than `max`).
         */
        cleanup_poll: TxDescriptor<Anonymize<I449n3riv6jbum>>;
        /**
         * Exchanges a member with a new account and the same existing rank.
         *
         * - `origin`: Must be the `ExchangeOrigin`.
         * - `who`: Account of existing member of rank greater than zero to be exchanged.
         * - `new_who`: New Account of existing member of rank greater than zero to exchanged to.
         */
        exchange_member: TxDescriptor<Anonymize<I9a7qiue67urvk>>;
    };
    AmbassadorReferenda: {
        /**
         * Propose a referendum on a privileged action.
         *
         * - `origin`: must be `SubmitOrigin` and the account must have `SubmissionDeposit` funds
         * available.
         * - `proposal_origin`: The origin from which the proposal should be executed.
         * - `proposal`: The proposal.
         * - `enactment_moment`: The moment that the proposal should be enacted.
         *
         * Emits `Submitted`.
         */
        submit: TxDescriptor<Anonymize<I1121uie4s8u64>>;
        /**
         * Post the Decision Deposit for a referendum.
         *
         * - `origin`: must be `Signed` and the account must have funds available for the
         * referendum's track's Decision Deposit.
         * - `index`: The index of the submitted referendum whose Decision Deposit is yet to be
         * posted.
         *
         * Emits `DecisionDepositPlaced`.
         */
        place_decision_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Refund the Decision Deposit for a closed referendum back to the depositor.
         *
         * - `origin`: must be `Signed` or `Root`.
         * - `index`: The index of a closed referendum whose Decision Deposit has not yet been
         * refunded.
         *
         * Emits `DecisionDepositRefunded`.
         */
        refund_decision_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Cancel an ongoing referendum.
         *
         * - `origin`: must be the `CancelOrigin`.
         * - `index`: The index of the referendum to be cancelled.
         *
         * Emits `Cancelled`.
         */
        cancel: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Cancel an ongoing referendum and slash the deposits.
         *
         * - `origin`: must be the `KillOrigin`.
         * - `index`: The index of the referendum to be cancelled.
         *
         * Emits `Killed` and `DepositSlashed`.
         */
        kill: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Advance a referendum onto its next logical state. Only used internally.
         *
         * - `origin`: must be `Root`.
         * - `index`: the referendum to be advanced.
         */
        nudge_referendum: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Advance a track onto its next logical state. Only used internally.
         *
         * - `origin`: must be `Root`.
         * - `track`: the track to be advanced.
         *
         * Action item for when there is now one fewer referendum in the deciding phase and the
         * `DecidingCount` is not yet updated. This means that we should either:
         * - begin deciding another referendum (and leave `DecidingCount` alone); or
         * - decrement `DecidingCount`.
         */
        one_fewer_deciding: TxDescriptor<Anonymize<Icbio0e1f0034b>>;
        /**
         * Refund the Submission Deposit for a closed referendum back to the depositor.
         *
         * - `origin`: must be `Signed` or `Root`.
         * - `index`: The index of a closed referendum whose Submission Deposit has not yet been
         * refunded.
         *
         * Emits `SubmissionDepositRefunded`.
         */
        refund_submission_deposit: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Set or clear metadata of a referendum.
         *
         * Parameters:
         * - `origin`: Must be `Signed` by a creator of a referendum or by anyone to clear a
         * metadata of a finished referendum.
         * - `index`:  The index of a referendum to set or clear metadata for.
         * - `maybe_hash`: The hash of an on-chain stored preimage. `None` to clear a metadata.
         */
        set_metadata: TxDescriptor<Anonymize<I8c0vkqjjipnuj>>;
    };
    AmbassadorCore: {
        /**
         * Bump the state of a member.
         *
         * This will demote a member whose `last_proof` is now beyond their rank's
         * `demotion_period`.
         *
         * - `origin`: A `Signed` origin of an account.
         * - `who`: A member account whose state is to be updated.
         */
        bump: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Set the parameters.
         *
         * - `origin`: An origin complying with `ParamsOrigin` or root.
         * - `params`: The new parameters for the pallet.
         */
        set_params: TxDescriptor<Anonymize<I5mruatkavn9hn>>;
        /**
         * Set whether a member is active or not.
         *
         * - `origin`: A `Signed` origin of a member's account.
         * - `is_active`: `true` iff the member is active.
         */
        set_active: TxDescriptor<Anonymize<I27vrusv8rgd90>>;
        /**
         * Approve a member to continue at their rank.
         *
         * This resets `last_proof` to the current block, thereby delaying any automatic demotion.
         *
         * `who` must already be tracked by this pallet for this to have an effect.
         *
         * - `origin`: An origin which satisfies `ApproveOrigin` or root.
         * - `who`: A member (i.e. of non-zero rank).
         * - `at_rank`: The rank of member.
         */
        approve: TxDescriptor<Anonymize<Ic79d2eioda33s>>;
        /**
         * Introduce a new and unranked candidate (rank zero).
         *
         * - `origin`: An origin which satisfies `InductOrigin` or root.
         * - `who`: The account ID of the candidate to be inducted and become a member.
         */
        induct: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Increment the rank of a ranked and tracked account.
         *
         * - `origin`: An origin which satisfies `PromoteOrigin` with a `Success` result of
         * `to_rank` or more or root.
         * - `who`: The account ID of the member to be promoted to `to_rank`.
         * - `to_rank`: One more than the current rank of `who`.
         */
        promote: TxDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Fast promotions can skip ranks and ignore the `min_promotion_period`.
         *
         * This is useful for out-of-band promotions, hence it has its own `FastPromoteOrigin` to
         * be (possibly) more restrictive than `PromoteOrigin`. Note that the member must already
         * be inducted.
         */
        promote_fast: TxDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Stop tracking a prior member who is now not a ranked member of the collective.
         *
         * - `origin`: A `Signed` origin of an account.
         * - `who`: The ID of an account which was tracked in this pallet but which is now not a
         * ranked member of the collective.
         */
        offboard: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Provide evidence that a rank is deserved.
         *
         * This is free as long as no evidence for the forthcoming judgement is already submitted.
         * Evidence is cleared after an outcome (either demotion, promotion of approval).
         *
         * - `origin`: A `Signed` origin of an inducted and ranked account.
         * - `wish`: The stated desire of the member.
         * - `evidence`: A dump of evidence to be considered. This should generally be either a
         * Markdown-encoded document or a series of 32-byte hashes which can be found on a
         * decentralised content-based-indexing system such as IPFS.
         */
        submit_evidence: TxDescriptor<Anonymize<I5il2eoab4j61e>>;
        /**
         * Introduce an already-ranked individual of the collective into this pallet.
         *
         * The rank may still be zero. This resets `last_proof` to the current block and
         * `last_promotion` will be set to zero, thereby delaying any automatic demotion but
         * allowing immediate promotion.
         *
         * - `origin`: A signed origin of a ranked, but not tracked, account.
         */
        import: TxDescriptor<undefined>;
        /**
         * Introduce an already-ranked individual of the collective into this pallet.
         *
         * The rank may still be zero. Can be called by anyone on any collective member - including
         * the sender.
         *
         * This resets `last_proof` to the current block and `last_promotion` will be set to zero,
         * thereby delaying any automatic demotion but allowing immediate promotion.
         *
         * - `origin`: A signed origin of a ranked, but not tracked, account.
         * - `who`: The account ID of the collective member to be inducted.
         */
        import_member: TxDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Set the parameters partially.
         *
         * - `origin`: An origin complying with `ParamsOrigin` or root.
         * - `partial_params`: The new parameters for the pallet.
         *
         * This update config with multiple arguments without duplicating
         * the fields that does not need to update (set to None).
         */
        set_partial_params: TxDescriptor<Anonymize<Idt0cq08n4po4d>>;
    };
    AmbassadorSalary: {
        /**
         * Start the first payout cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        init: TxDescriptor<undefined>;
        /**
         * Move to next payout cycle, assuming that the present block is now within that cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        bump: TxDescriptor<undefined>;
        /**
         * Induct oneself into the payout system.
         */
        induct: TxDescriptor<undefined>;
        /**
         * Register for a payout.
         *
         * Will only work if we are in the first `RegistrationPeriod` blocks since the cycle
         * started.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        register: TxDescriptor<undefined>;
        /**
         * Request a payout.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        payout: TxDescriptor<undefined>;
        /**
         * Request a payout to a secondary account.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         * - `beneficiary`: The account to receive payment.
         */
        payout_other: TxDescriptor<Anonymize<I8ligieds2efci>>;
        /**
         * Update a payment's status; if it failed, alter the state so the payment can be retried.
         *
         * This must be called within the same cycle as the failed payment. It will fail with
         * `Event::NotCurrent` otherwise.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members` who has
         * received a payment this cycle.
         */
        check_payment: TxDescriptor<undefined>;
    };
    AmbassadorTreasury: {
        /**
         * Propose and approve a spend of treasury funds.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::SpendOrigin`] with the `Success` value being at least `amount`.
         *
         * ### Details
         * NOTE: For record-keeping purposes, the proposer is deemed to be equivalent to the
         * beneficiary.
         *
         * ### Parameters
         * - `amount`: The amount to be transferred from the treasury to the `beneficiary`.
         * - `beneficiary`: The destination account for the transfer.
         *
         * ## Events
         *
         * Emits [`Event::SpendApproved`] if successful.
         */
        spend_local: TxDescriptor<Anonymize<Icnrv1mfbd3in1>>;
        /**
         * Force a previously approved proposal to be removed from the approval queue.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::RejectOrigin`].
         *
         * ## Details
         *
         * The original deposit will no longer be returned.
         *
         * ### Parameters
         * - `proposal_id`: The index of a proposal
         *
         * ### Complexity
         * - O(A) where `A` is the number of approvals
         *
         * ### Errors
         * - [`Error::ProposalNotApproved`]: The `proposal_id` supplied was not found in the
         * approval queue, i.e., the proposal has not been approved. This could also mean the
         * proposal does not exist altogether, thus there is no way it would have been approved
         * in the first place.
         */
        remove_approval: TxDescriptor<Anonymize<Icm9m0qeemu66d>>;
        /**
         * Propose and approve a spend of treasury funds.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::SpendOrigin`] with the `Success` value being at least
         * `amount` of `asset_kind` in the native asset. The amount of `asset_kind` is converted
         * for assertion using the [`Config::BalanceConverter`].
         *
         * ## Details
         *
         * Create an approved spend for transferring a specific `amount` of `asset_kind` to a
         * designated beneficiary. The spend must be claimed using the `payout` dispatchable within
         * the [`Config::PayoutPeriod`].
         *
         * ### Parameters
         * - `asset_kind`: An indicator of the specific asset class to be spent.
         * - `amount`: The amount to be transferred from the treasury to the `beneficiary`.
         * - `beneficiary`: The beneficiary of the spend.
         * - `valid_from`: The block number from which the spend can be claimed. It can refer to
         * the past if the resulting spend has not yet expired according to the
         * [`Config::PayoutPeriod`]. If `None`, the spend can be claimed immediately after
         * approval.
         *
         * ## Events
         *
         * Emits [`Event::AssetSpendApproved`] if successful.
         */
        spend: TxDescriptor<Anonymize<I3pnhorh539dti>>;
        /**
         * Claim a spend.
         *
         * ## Dispatch Origin
         *
         * Must be signed
         *
         * ## Details
         *
         * Spends must be claimed within some temporal bounds. A spend may be claimed within one
         * [`Config::PayoutPeriod`] from the `valid_from` block.
         * In case of a payout failure, the spend status must be updated with the `check_status`
         * dispatchable before retrying with the current function.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::Paid`] if successful.
         */
        payout: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Check the status of the spend and remove it from the storage if processed.
         *
         * ## Dispatch Origin
         *
         * Must be signed.
         *
         * ## Details
         *
         * The status check is a prerequisite for retrying a failed payout.
         * If a spend has either succeeded or expired, it is removed from the storage by this
         * function. In such instances, transaction fees are refunded.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::PaymentFailed`] if the spend payout has failed.
         * Emits [`Event::SpendProcessed`] if the spend payout has succeed.
         */
        check_status: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * Void previously approved spend.
         *
         * ## Dispatch Origin
         *
         * Must be [`Config::RejectOrigin`].
         *
         * ## Details
         *
         * A spend void is only possible if the payout has not been attempted yet.
         *
         * ### Parameters
         * - `index`: The spend index.
         *
         * ## Events
         *
         * Emits [`Event::AssetSpendVoided`] if successful.
         */
        void_spend: TxDescriptor<Anonymize<I666bl2fqjkejo>>;
    };
    SecretaryCollective: {
        /**
         * Introduce a new member.
         *
         * - `origin`: Must be the `AddOrigin`.
         * - `who`: Account of non-member which will become a member.
         *
         * Weight: `O(1)`
         */
        add_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Increment the rank of an existing member by one.
         *
         * - `origin`: Must be the `PromoteOrigin`.
         * - `who`: Account of existing member.
         *
         * Weight: `O(1)`
         */
        promote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Decrement the rank of an existing member by one. If the member is already at rank zero,
         * then they are removed entirely.
         *
         * - `origin`: Must be the `DemoteOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         *
         * Weight: `O(1)`, less if the member's index is highest in its rank.
         */
        demote_member: TxDescriptor<Anonymize<I59bngqm85b22v>>;
        /**
         * Remove the member entirely.
         *
         * - `origin`: Must be the `RemoveOrigin`.
         * - `who`: Account of existing member of rank greater than zero.
         * - `min_rank`: The rank of the member or greater.
         *
         * Weight: `O(min_rank)`.
         */
        remove_member: TxDescriptor<Anonymize<I3amdclkdfaipk>>;
        /**
         * Add an aye or nay vote for the sender to the given proposal.
         *
         * - `origin`: Must be `Signed` by a member account.
         * - `poll`: Index of a poll which is ongoing.
         * - `aye`: `true` if the vote is to approve the proposal, `false` otherwise.
         *
         * Transaction fees are be waived if the member is voting on any particular proposal
         * for the first time and the call is successful. Subsequent vote changes will charge a
         * fee.
         *
         * Weight: `O(1)`, less if there was no previous vote on the poll by the member.
         */
        vote: TxDescriptor<Anonymize<I8bvk21lpmah75>>;
        /**
         * Remove votes from the given poll. It must have ended.
         *
         * - `origin`: Must be `Signed` by any account.
         * - `poll_index`: Index of a poll which is completed and for which votes continue to
         * exist.
         * - `max`: Maximum number of vote items from remove in this call.
         *
         * Transaction fees are waived if the operation is successful.
         *
         * Weight `O(max)` (less if there are fewer items to remove than `max`).
         */
        cleanup_poll: TxDescriptor<Anonymize<I449n3riv6jbum>>;
        /**
         * Exchanges a member with a new account and the same existing rank.
         *
         * - `origin`: Must be the `ExchangeOrigin`.
         * - `who`: Account of existing member of rank greater than zero to be exchanged.
         * - `new_who`: New Account of existing member of rank greater than zero to exchanged to.
         */
        exchange_member: TxDescriptor<Anonymize<I9a7qiue67urvk>>;
    };
    SecretarySalary: {
        /**
         * Start the first payout cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        init: TxDescriptor<undefined>;
        /**
         * Move to next payout cycle, assuming that the present block is now within that cycle.
         *
         * - `origin`: A `Signed` origin of an account.
         */
        bump: TxDescriptor<undefined>;
        /**
         * Induct oneself into the payout system.
         */
        induct: TxDescriptor<undefined>;
        /**
         * Register for a payout.
         *
         * Will only work if we are in the first `RegistrationPeriod` blocks since the cycle
         * started.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        register: TxDescriptor<undefined>;
        /**
         * Request a payout.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         */
        payout: TxDescriptor<undefined>;
        /**
         * Request a payout to a secondary account.
         *
         * Will only work if we are after the first `RegistrationPeriod` blocks since the cycle
         * started but by no more than `PayoutPeriod` blocks.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members`.
         * - `beneficiary`: The account to receive payment.
         */
        payout_other: TxDescriptor<Anonymize<I8ligieds2efci>>;
        /**
         * Update a payment's status; if it failed, alter the state so the payment can be retried.
         *
         * This must be called within the same cycle as the failed payment. It will fail with
         * `Event::NotCurrent` otherwise.
         *
         * - `origin`: A `Signed` origin of an account which is a member of `Members` who has
         * received a payment this cycle.
         */
        check_payment: TxDescriptor<undefined>;
    };
};
type IEvent = {
    System: {
        /**
         * An extrinsic completed successfully.
         */
        ExtrinsicSuccess: PlainDescriptor<Anonymize<Ia82mnkmeo2rhc>>;
        /**
         * An extrinsic failed.
         */
        ExtrinsicFailed: PlainDescriptor<Anonymize<I21127ofgtqu6k>>;
        /**
         * `:code` was updated.
         */
        CodeUpdated: PlainDescriptor<undefined>;
        /**
         * A new account was created.
         */
        NewAccount: PlainDescriptor<Anonymize<Icbccs0ug47ilf>>;
        /**
         * An account was reaped.
         */
        KilledAccount: PlainDescriptor<Anonymize<Icbccs0ug47ilf>>;
        /**
         * On on-chain remark happened.
         */
        Remarked: PlainDescriptor<Anonymize<I855j4i3kr8ko1>>;
        /**
         * An upgrade was authorized.
         */
        UpgradeAuthorized: PlainDescriptor<Anonymize<Ibgl04rn6nbfm6>>;
        /**
         * An invalid authorized upgrade was rejected while trying to apply it.
         */
        RejectedInvalidAuthorizedUpgrade: PlainDescriptor<Anonymize<Iise13kk6jn9t>>;
    };
    ParachainSystem: {
        /**
         * The validation function has been scheduled to apply.
         */
        ValidationFunctionStored: PlainDescriptor<undefined>;
        /**
         * The validation function was applied as of the contained relay chain block number.
         */
        ValidationFunctionApplied: PlainDescriptor<Anonymize<Idd7hd99u0ho0n>>;
        /**
         * The relay-chain aborted the upgrade process.
         */
        ValidationFunctionDiscarded: PlainDescriptor<undefined>;
        /**
         * Some downward messages have been received and will be processed.
         */
        DownwardMessagesReceived: PlainDescriptor<Anonymize<Iafscmv8tjf0ou>>;
        /**
         * Downward messages were processed using the given weight.
         */
        DownwardMessagesProcessed: PlainDescriptor<Anonymize<I100l07kaehdlp>>;
        /**
         * An upward message was sent to the relay chain.
         */
        UpwardMessageSent: PlainDescriptor<Anonymize<I6gnbnvip5vvdi>>;
    };
    Balances: {
        /**
         * An account was created with some free balance.
         */
        Endowed: PlainDescriptor<Anonymize<Icv68aq8841478>>;
        /**
         * An account was removed whose balance was non-zero but below ExistentialDeposit,
         * resulting in an outright loss.
         */
        DustLost: PlainDescriptor<Anonymize<Ic262ibdoec56a>>;
        /**
         * Transfer succeeded.
         */
        Transfer: PlainDescriptor<Anonymize<Iflcfm9b6nlmdd>>;
        /**
         * A balance was set by root.
         */
        BalanceSet: PlainDescriptor<Anonymize<Ijrsf4mnp3eka>>;
        /**
         * Some balance was reserved (moved from free to reserved).
         */
        Reserved: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some balance was unreserved (moved from reserved to free).
         */
        Unreserved: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some balance was moved from the reserve of the first account to the second account.
         * Final argument indicates the destination balance type.
         */
        ReserveRepatriated: PlainDescriptor<Anonymize<I8tjvj9uq4b7hi>>;
        /**
         * Some amount was deposited (e.g. for transaction fees).
         */
        Deposit: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some amount was withdrawn from the account (e.g. for transaction fees).
         */
        Withdraw: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some amount was removed from the account (e.g. for misbehavior).
         */
        Slashed: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some amount was minted into an account.
         */
        Minted: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some credit was balanced and added to the TotalIssuance.
         */
        MintedCredit: PlainDescriptor<Anonymize<I3qt1hgg4djhgb>>;
        /**
         * Some amount was burned from an account.
         */
        Burned: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some debt has been dropped from the Total Issuance.
         */
        BurnedDebt: PlainDescriptor<Anonymize<I3qt1hgg4djhgb>>;
        /**
         * Some amount was suspended from an account (it can be restored later).
         */
        Suspended: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some amount was restored into an account.
         */
        Restored: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * An account was upgraded.
         */
        Upgraded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Total issuance was increased by `amount`, creating a credit to be balanced.
         */
        Issued: PlainDescriptor<Anonymize<I3qt1hgg4djhgb>>;
        /**
         * Total issuance was decreased by `amount`, creating a debt to be balanced.
         */
        Rescinded: PlainDescriptor<Anonymize<I3qt1hgg4djhgb>>;
        /**
         * Some balance was locked.
         */
        Locked: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some balance was unlocked.
         */
        Unlocked: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some balance was frozen.
         */
        Frozen: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * Some balance was thawed.
         */
        Thawed: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * The `TotalIssuance` was forcefully changed.
         */
        TotalIssuanceForced: PlainDescriptor<Anonymize<I4fooe9dun9o0t>>;
        /**
         * Some balance was placed on hold.
         */
        Held: PlainDescriptor<Anonymize<I94rlea5gdnfo3>>;
        /**
         * Held balance was burned from an account.
         */
        BurnedHeld: PlainDescriptor<Anonymize<I94rlea5gdnfo3>>;
        /**
         * A transfer of `amount` on hold from `source` to `dest` was initiated.
         */
        TransferOnHold: PlainDescriptor<Anonymize<Ifa9o21hgt3j2f>>;
        /**
         * The `transferred` balance is placed on hold at the `dest` account.
         */
        TransferAndHold: PlainDescriptor<Anonymize<I599q9qkrmqlb>>;
        /**
         * Some balance was released from hold.
         */
        Released: PlainDescriptor<Anonymize<I94rlea5gdnfo3>>;
        /**
         * An unexpected/defensive event was triggered.
         */
        Unexpected: PlainDescriptor<Anonymize<Iph9c4rn81ub2>>;
    };
    TransactionPayment: {
        /**
         * A transaction fee `actual_fee`, of which `tip` was added to the minimum inclusion fee,
         * has been paid by `who`.
         */
        TransactionFeePaid: PlainDescriptor<Anonymize<Ier2cke86dqbr2>>;
    };
    CollatorSelection: {
        /**
         * New Invulnerables were set.
         */
        NewInvulnerables: PlainDescriptor<Anonymize<I39t01nnod9109>>;
        /**
         * A new Invulnerable was added.
         */
        InvulnerableAdded: PlainDescriptor<Anonymize<I6v8sm60vvkmk7>>;
        /**
         * An Invulnerable was removed.
         */
        InvulnerableRemoved: PlainDescriptor<Anonymize<I6v8sm60vvkmk7>>;
        /**
         * The number of desired candidates was set.
         */
        NewDesiredCandidates: PlainDescriptor<Anonymize<I1qmtmbe5so8r3>>;
        /**
         * The candidacy bond was set.
         */
        NewCandidacyBond: PlainDescriptor<Anonymize<Ih99m6ehpcar7>>;
        /**
         * A new candidate joined.
         */
        CandidateAdded: PlainDescriptor<Anonymize<Idgorhsbgdq2ap>>;
        /**
         * Bond of a candidate updated.
         */
        CandidateBondUpdated: PlainDescriptor<Anonymize<Idgorhsbgdq2ap>>;
        /**
         * A candidate was removed.
         */
        CandidateRemoved: PlainDescriptor<Anonymize<I6v8sm60vvkmk7>>;
        /**
         * An account was replaced in the candidate list by another one.
         */
        CandidateReplaced: PlainDescriptor<Anonymize<I9ubb2kqevnu6t>>;
        /**
         * An account was unable to be added to the Invulnerables because they did not have keys
         * registered. Other Invulnerables may have been set.
         */
        InvalidInvulnerableSkipped: PlainDescriptor<Anonymize<I6v8sm60vvkmk7>>;
    };
    Session: {
        /**
         * New session has happened. Note that the argument is the session index, not the
         * block number as the type might suggest.
         */
        NewSession: PlainDescriptor<Anonymize<I2hq50pu2kdjpo>>;
        /**
         * The `NewSession` event in the current block also implies a new validator set to be
         * queued.
         */
        NewQueued: PlainDescriptor<undefined>;
        /**
         * Validator has been disabled.
         */
        ValidatorDisabled: PlainDescriptor<Anonymize<I9acqruh7322g2>>;
        /**
         * Validator has been re-enabled.
         */
        ValidatorReenabled: PlainDescriptor<Anonymize<I9acqruh7322g2>>;
    };
    XcmpQueue: {
        /**
         * An HRMP message was sent to a sibling parachain.
         */
        XcmpMessageSent: PlainDescriptor<Anonymize<I137t1cld92pod>>;
    };
    PolkadotXcm: {
        /**
         * Execution of an XCM message was attempted.
         */
        Attempted: PlainDescriptor<Anonymize<I61d51nv4cou88>>;
        /**
         * An XCM message was sent.
         */
        Sent: PlainDescriptor<Anonymize<If8u5kl4h8070m>>;
        /**
         * An XCM message failed to send.
         */
        SendFailed: PlainDescriptor<Anonymize<Ibmuil6p3vl83l>>;
        /**
         * An XCM message failed to process.
         */
        ProcessXcmError: PlainDescriptor<Anonymize<I7lul91g50ae87>>;
        /**
         * Query response received which does not match a registered query. This may be because a
         * matching query was never registered, it may be because it is a duplicate response, or
         * because the query timed out.
         */
        UnexpectedResponse: PlainDescriptor<Anonymize<Icl7nl1rfeog3i>>;
        /**
         * Query response has been received and is ready for taking with `take_response`. There is
         * no registered notification call.
         */
        ResponseReady: PlainDescriptor<Anonymize<Iasr6pj6shs0fl>>;
        /**
         * Query response has been received and query is removed. The registered notification has
         * been dispatched and executed successfully.
         */
        Notified: PlainDescriptor<Anonymize<I2uqmls7kcdnii>>;
        /**
         * Query response has been received and query is removed. The registered notification
         * could not be dispatched because the dispatch weight is greater than the maximum weight
         * originally budgeted by this runtime for the query result.
         */
        NotifyOverweight: PlainDescriptor<Anonymize<Idg69klialbkb8>>;
        /**
         * Query response has been received and query is removed. There was a general error with
         * dispatching the notification call.
         */
        NotifyDispatchError: PlainDescriptor<Anonymize<I2uqmls7kcdnii>>;
        /**
         * Query response has been received and query is removed. The dispatch was unable to be
         * decoded into a `Call`; this might be due to dispatch function having a signature which
         * is not `(origin, QueryId, Response)`.
         */
        NotifyDecodeFailed: PlainDescriptor<Anonymize<I2uqmls7kcdnii>>;
        /**
         * Expected query response has been received but the origin location of the response does
         * not match that expected. The query remains registered for a later, valid, response to
         * be received and acted upon.
         */
        InvalidResponder: PlainDescriptor<Anonymize<I7r6b7145022pp>>;
        /**
         * Expected query response has been received but the expected origin location placed in
         * storage by this runtime previously cannot be decoded. The query remains registered.
         *
         * This is unexpected (since a location placed in storage in a previously executing
         * runtime should be readable prior to query timeout) and dangerous since the possibly
         * valid response will be dropped. Manual governance intervention is probably going to be
         * needed.
         */
        InvalidResponderVersion: PlainDescriptor<Anonymize<Icl7nl1rfeog3i>>;
        /**
         * Received query response has been read and removed.
         */
        ResponseTaken: PlainDescriptor<Anonymize<I30pg328m00nr3>>;
        /**
         * Some assets have been placed in an asset trap.
         */
        AssetsTrapped: PlainDescriptor<Anonymize<Icmrn7bogp28cs>>;
        /**
         * An XCM version change notification message has been attempted to be sent.
         *
         * The cost of sending it (borne by the chain) is included.
         */
        VersionChangeNotified: PlainDescriptor<Anonymize<I7m9b5plj4h5ot>>;
        /**
         * The supported version of a location has been changed. This might be through an
         * automatic notification or a manual intervention.
         */
        SupportedVersionChanged: PlainDescriptor<Anonymize<I9kt8c221c83ln>>;
        /**
         * A given location which had a version change subscription was dropped owing to an error
         * sending the notification to it.
         */
        NotifyTargetSendFail: PlainDescriptor<Anonymize<I9onhk772nfs4f>>;
        /**
         * A given location which had a version change subscription was dropped owing to an error
         * migrating the location to our new XCM format.
         */
        NotifyTargetMigrationFail: PlainDescriptor<Anonymize<I3l6bnksrmt56r>>;
        /**
         * Expected query response has been received but the expected querier location placed in
         * storage by this runtime previously cannot be decoded. The query remains registered.
         *
         * This is unexpected (since a location placed in storage in a previously executing
         * runtime should be readable prior to query timeout) and dangerous since the possibly
         * valid response will be dropped. Manual governance intervention is probably going to be
         * needed.
         */
        InvalidQuerierVersion: PlainDescriptor<Anonymize<Icl7nl1rfeog3i>>;
        /**
         * Expected query response has been received but the querier location of the response does
         * not match the expected. The query remains registered for a later, valid, response to
         * be received and acted upon.
         */
        InvalidQuerier: PlainDescriptor<Anonymize<Idh09k0l2pmdcg>>;
        /**
         * A remote has requested XCM version change notification from us and we have honored it.
         * A version information message is sent to them and its cost is included.
         */
        VersionNotifyStarted: PlainDescriptor<Anonymize<I7uoiphbm0tj4r>>;
        /**
         * We have requested that a remote chain send us XCM version change notifications.
         */
        VersionNotifyRequested: PlainDescriptor<Anonymize<I7uoiphbm0tj4r>>;
        /**
         * We have requested that a remote chain stops sending us XCM version change
         * notifications.
         */
        VersionNotifyUnrequested: PlainDescriptor<Anonymize<I7uoiphbm0tj4r>>;
        /**
         * Fees were paid from a location for an operation (often for using `SendXcm`).
         */
        FeesPaid: PlainDescriptor<Anonymize<I512p1n7qt24l8>>;
        /**
         * Some assets have been claimed from an asset trap
         */
        AssetsClaimed: PlainDescriptor<Anonymize<Icmrn7bogp28cs>>;
        /**
         * A XCM version migration finished.
         */
        VersionMigrationFinished: PlainDescriptor<Anonymize<I6s1nbislhk619>>;
        /**
         * An `aliaser` location was authorized by `target` to alias it, authorization valid until
         * `expiry` block number.
         */
        AliasAuthorized: PlainDescriptor<Anonymize<I3gghqnh2mj0is>>;
        /**
         * `target` removed alias authorization for `aliaser`.
         */
        AliasAuthorizationRemoved: PlainDescriptor<Anonymize<I6iv852roh6t3h>>;
        /**
         * `target` removed all alias authorizations.
         */
        AliasesAuthorizationsRemoved: PlainDescriptor<Anonymize<I9oc2o6itbiopq>>;
    };
    CumulusXcm: {
        /**
         * Downward message is invalid XCM.
         * \[ id \]
         */
        InvalidFormat: PlainDescriptor<SizedHex<32>>;
        /**
         * Downward message is unsupported version of XCM.
         * \[ id \]
         */
        UnsupportedVersion: PlainDescriptor<SizedHex<32>>;
        /**
         * Downward message executed with the given outcome.
         * \[ id, outcome \]
         */
        ExecutedDownward: PlainDescriptor<Anonymize<Ibslgga81p36aa>>;
    };
    MessageQueue: {
        /**
         * Message discarded due to an error in the `MessageProcessor` (usually a format error).
         */
        ProcessingFailed: PlainDescriptor<Anonymize<I1rvj4ubaplho0>>;
        /**
         * Message is processed.
         */
        Processed: PlainDescriptor<Anonymize<Ia3uu7lqcc1q1i>>;
        /**
         * Message placed in overweight queue.
         */
        OverweightEnqueued: PlainDescriptor<Anonymize<I7crucfnonitkn>>;
        /**
         * This page was reaped.
         */
        PageReaped: PlainDescriptor<Anonymize<I7tmrp94r9sq4n>>;
    };
    Utility: {
        /**
         * Batch of dispatches did not complete fully. Index of first failing dispatch given, as
         * well as the error.
         */
        BatchInterrupted: PlainDescriptor<Anonymize<I46cr4rcv02bd>>;
        /**
         * Batch of dispatches completed fully with no error.
         */
        BatchCompleted: PlainDescriptor<undefined>;
        /**
         * Batch of dispatches completed but has errors.
         */
        BatchCompletedWithErrors: PlainDescriptor<undefined>;
        /**
         * A single item within a Batch of dispatches has completed with no error.
         */
        ItemCompleted: PlainDescriptor<undefined>;
        /**
         * A single item within a Batch of dispatches has completed with error.
         */
        ItemFailed: PlainDescriptor<Anonymize<I2kgtj06e3t0io>>;
        /**
         * A call was dispatched.
         */
        DispatchedAs: PlainDescriptor<Anonymize<I390bno483djkg>>;
        /**
         * Main call was dispatched.
         */
        IfElseMainSuccess: PlainDescriptor<undefined>;
        /**
         * The fallback call was dispatched.
         */
        IfElseFallbackCalled: PlainDescriptor<Anonymize<I4rp5raanj4h2f>>;
    };
    Multisig: {
        /**
         * A new multisig operation has begun.
         */
        NewMultisig: PlainDescriptor<Anonymize<Iep27ialq4a7o7>>;
        /**
         * A multisig operation has been approved by someone.
         */
        MultisigApproval: PlainDescriptor<Anonymize<Iasu5jvoqr43mv>>;
        /**
         * A multisig operation has been executed.
         */
        MultisigExecuted: PlainDescriptor<Anonymize<I7j36mi5eclre9>>;
        /**
         * A multisig operation has been cancelled.
         */
        MultisigCancelled: PlainDescriptor<Anonymize<I5qolde99acmd1>>;
        /**
         * The deposit for a multisig operation has been updated/poked.
         */
        DepositPoked: PlainDescriptor<Anonymize<I8gtde5abn1g9a>>;
    };
    Proxy: {
        /**
         * A proxy was executed correctly, with the given.
         */
        ProxyExecuted: PlainDescriptor<Anonymize<I390bno483djkg>>;
        /**
         * A pure account has been created by new proxy with given
         * disambiguation index and proxy type.
         */
        PureCreated: PlainDescriptor<Anonymize<Ifr2nmnf0cistq>>;
        /**
         * A pure proxy was killed by its spawner.
         */
        PureKilled: PlainDescriptor<Anonymize<I6pf8rhdm8fo17>>;
        /**
         * An announcement was placed to make a call in the future.
         */
        Announced: PlainDescriptor<Anonymize<I2ur0oeqg495j8>>;
        /**
         * A proxy was added.
         */
        ProxyAdded: PlainDescriptor<Anonymize<I56kctcqjaugbp>>;
        /**
         * A proxy was removed.
         */
        ProxyRemoved: PlainDescriptor<Anonymize<I56kctcqjaugbp>>;
        /**
         * A deposit stored for proxies or announcements was poked / updated.
         */
        DepositPoked: PlainDescriptor<Anonymize<I1bhd210c3phjj>>;
    };
    Preimage: {
        /**
         * A preimage has been noted.
         */
        Noted: PlainDescriptor<Anonymize<I1jm8m1rh9e20v>>;
        /**
         * A preimage has been requested.
         */
        Requested: PlainDescriptor<Anonymize<I1jm8m1rh9e20v>>;
        /**
         * A preimage has ben cleared.
         */
        Cleared: PlainDescriptor<Anonymize<I1jm8m1rh9e20v>>;
    };
    Scheduler: {
        /**
         * Scheduled some task.
         */
        Scheduled: PlainDescriptor<Anonymize<I5n4sebgkfr760>>;
        /**
         * Canceled some task.
         */
        Canceled: PlainDescriptor<Anonymize<I5n4sebgkfr760>>;
        /**
         * Dispatched some task.
         */
        Dispatched: PlainDescriptor<Anonymize<Icmuiqav70h6lm>>;
        /**
         * Set a retry configuration for some task.
         */
        RetrySet: PlainDescriptor<Anonymize<Ia3c82eadg79bj>>;
        /**
         * Cancel a retry configuration for some task.
         */
        RetryCancelled: PlainDescriptor<Anonymize<Ienusoeb625ftq>>;
        /**
         * The call for the provided hash was not found so the task has been aborted.
         */
        CallUnavailable: PlainDescriptor<Anonymize<Ienusoeb625ftq>>;
        /**
         * The given task was unable to be renewed since the agenda is full at that block.
         */
        PeriodicFailed: PlainDescriptor<Anonymize<Ienusoeb625ftq>>;
        /**
         * The given task was unable to be retried since the agenda is full at that block or there
         * was not enough weight to reschedule it.
         */
        RetryFailed: PlainDescriptor<Anonymize<Ienusoeb625ftq>>;
        /**
         * The given task can never be executed since it is overweight.
         */
        PermanentlyOverweight: PlainDescriptor<Anonymize<Ienusoeb625ftq>>;
        /**
         * Agenda is incomplete from `when`.
         */
        AgendaIncomplete: PlainDescriptor<Anonymize<Ibtsa3docbr9el>>;
    };
    AssetRate: {
        /**
        
         */
        AssetRateCreated: PlainDescriptor<Anonymize<I9c4d50jrp7as1>>;
        /**
        
         */
        AssetRateRemoved: PlainDescriptor<Anonymize<Ifplevr9hp8jo3>>;
        /**
        
         */
        AssetRateUpdated: PlainDescriptor<Anonymize<Idrugh2blv81ia>>;
    };
    Alliance: {
        /**
         * A new rule has been set.
         */
        NewRuleSet: PlainDescriptor<Anonymize<I465k81tqg3usk>>;
        /**
         * A new announcement has been proposed.
         */
        Announced: PlainDescriptor<Anonymize<I54d7mcgvp9b3a>>;
        /**
         * An on-chain announcement has been removed.
         */
        AnnouncementRemoved: PlainDescriptor<Anonymize<I54d7mcgvp9b3a>>;
        /**
         * Some accounts have been initialized as members (fellows/allies).
         */
        MembersInitialized: PlainDescriptor<Anonymize<Ia61kag3grdevk>>;
        /**
         * An account has been added as an Ally and reserved its deposit.
         */
        NewAllyJoined: PlainDescriptor<Anonymize<I79vua51vqq0mc>>;
        /**
         * An ally has been elevated to Fellow.
         */
        AllyElevated: PlainDescriptor<Anonymize<I3trq1j79d9t1e>>;
        /**
         * A member gave retirement notice and their retirement period started.
         */
        MemberRetirementPeriodStarted: PlainDescriptor<Anonymize<Ie3gphha4ejh40>>;
        /**
         * A member has retired with its deposit unreserved.
         */
        MemberRetired: PlainDescriptor<Anonymize<Iafhd8kv029rqj>>;
        /**
         * A member has been kicked out with its deposit slashed.
         */
        MemberKicked: PlainDescriptor<Anonymize<I2mcnoj31i9be1>>;
        /**
         * Accounts or websites have been added into the list of unscrupulous items.
         */
        UnscrupulousItemAdded: PlainDescriptor<Anonymize<Ickqr13ag0mv3c>>;
        /**
         * Accounts or websites have been removed from the list of unscrupulous items.
         */
        UnscrupulousItemRemoved: PlainDescriptor<Anonymize<Ickqr13ag0mv3c>>;
        /**
         * Alliance disbanded. Includes number deleted members and unreserved deposits.
         */
        AllianceDisbanded: PlainDescriptor<Anonymize<I9dapsurd7u7ga>>;
        /**
         * A Fellow abdicated their voting rights. They are now an Ally.
         */
        FellowAbdicated: PlainDescriptor<Anonymize<I8uij7nmvtb96e>>;
    };
    AllianceMotion: {
        /**
         * A motion (given hash) has been proposed (by given account) with a threshold (given
         * `MemberCount`).
         */
        Proposed: PlainDescriptor<Anonymize<Ift6f10887nk72>>;
        /**
         * A motion (given hash) has been voted on by given account, leaving
         * a tally (yes votes and no votes given respectively as `MemberCount`).
         */
        Voted: PlainDescriptor<Anonymize<I7qc53b1tvqjg2>>;
        /**
         * A motion was approved by the required threshold.
         */
        Approved: PlainDescriptor<Anonymize<I2ev73t79f46tb>>;
        /**
         * A motion was not approved by the required threshold.
         */
        Disapproved: PlainDescriptor<Anonymize<I2ev73t79f46tb>>;
        /**
         * A motion was executed; result will be `Ok` if it returned without error.
         */
        Executed: PlainDescriptor<Anonymize<I9n15sljqnkta7>>;
        /**
         * A single member did some action; result will be `Ok` if it returned without error.
         */
        MemberExecuted: PlainDescriptor<Anonymize<I9n15sljqnkta7>>;
        /**
         * A proposal was closed because its threshold was reached or after its duration was up.
         */
        Closed: PlainDescriptor<Anonymize<Iak7fhrgb9jnnq>>;
        /**
         * A proposal was killed.
         */
        Killed: PlainDescriptor<Anonymize<I2ev73t79f46tb>>;
        /**
         * Some cost for storing a proposal was burned.
         */
        ProposalCostBurned: PlainDescriptor<Anonymize<I9ad1o9mv4cm3>>;
        /**
         * Some cost for storing a proposal was released.
         */
        ProposalCostReleased: PlainDescriptor<Anonymize<I9ad1o9mv4cm3>>;
    };
    FellowshipCollective: {
        /**
         * A member `who` has been added.
         */
        MemberAdded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * The member `who`se rank has been changed to the given `rank`.
         */
        RankChanged: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` of given `rank` has been removed from the collective.
         */
        MemberRemoved: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` has voted for the `poll` with the given `vote` leading to an updated
         * `tally`.
         */
        Voted: PlainDescriptor<Anonymize<I21jsoeb0o6476>>;
        /**
         * The member `who` had their `AccountId` changed to `new_who`.
         */
        MemberExchanged: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    FellowshipReferenda: {
        /**
         * A referendum has been submitted.
         */
        Submitted: PlainDescriptor<Anonymize<I229ijht536qdu>>;
        /**
         * The decision deposit has been placed.
         */
        DecisionDepositPlaced: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * The decision deposit has been refunded.
         */
        DecisionDepositRefunded: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * A deposit has been slashed.
         */
        DepositSlashed: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * A referendum has moved into the deciding phase.
         */
        DecisionStarted: PlainDescriptor<Anonymize<Ic6ecdcp9ut7jd>>;
        /**
        
         */
        ConfirmStarted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
        
         */
        ConfirmAborted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A referendum has ended its confirmation phase and is ready for approval.
         */
        Confirmed: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been approved and its proposal has been scheduled.
         */
        Approved: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A proposal has been rejected by referendum.
         */
        Rejected: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been timed out without being decided.
         */
        TimedOut: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been cancelled.
         */
        Cancelled: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been killed.
         */
        Killed: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * The submission deposit has been refunded.
         */
        SubmissionDepositRefunded: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * Metadata for a referendum has been set.
         */
        MetadataSet: PlainDescriptor<Anonymize<I4f1hv034jf1dt>>;
        /**
         * Metadata for a referendum has been cleared.
         */
        MetadataCleared: PlainDescriptor<Anonymize<I4f1hv034jf1dt>>;
    };
    FellowshipCore: {
        /**
         * Parameters for the pallet have changed.
         */
        ParamsChanged: PlainDescriptor<Anonymize<I5mruatkavn9hn>>;
        /**
         * Member activity flag has been set.
         */
        ActiveChanged: PlainDescriptor<Anonymize<I9j3uq1uk06oju>>;
        /**
         * Member has begun being tracked in this pallet.
         */
        Inducted: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Member has been removed from being tracked in this pallet (i.e. because rank is now
         * zero).
         */
        Offboarded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Member has been promoted to the given rank.
         */
        Promoted: PlainDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Member has been demoted to the given (non-zero) rank.
         */
        Demoted: PlainDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Member has been proven at their current rank, postponing auto-demotion.
         */
        Proven: PlainDescriptor<Anonymize<Ic79d2eioda33s>>;
        /**
         * Member has stated evidence of their efforts their request for rank.
         */
        Requested: PlainDescriptor<Anonymize<I2t83mr73603p9>>;
        /**
         * Some submitted evidence was judged and removed. There may or may not have been a change
         * to the rank, but in any case, `last_proof` is reset.
         */
        EvidenceJudged: PlainDescriptor<Anonymize<Ibas6o69e1qaqo>>;
        /**
         * Pre-ranked account has been inducted at their current rank.
         */
        Imported: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * A member had its AccountId swapped.
         */
        Swapped: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    FellowshipSalary: {
        /**
         * A member is inducted into the payroll.
         */
        Inducted: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * A member registered for a payout.
         */
        Registered: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * A payment happened.
         */
        Paid: PlainDescriptor<Anonymize<I4vcrhqupmee7p>>;
        /**
         * The next cycle begins.
         */
        CycleStarted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A member swapped their account.
         */
        Swapped: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    FellowshipTreasury: {
        /**
         * We have ended a spend period and will now allocate funds.
         */
        Spending: PlainDescriptor<Anonymize<I8iksqi3eani0a>>;
        /**
         * Some funds have been allocated.
         */
        Awarded: PlainDescriptor<Anonymize<I16enopmju1p0q>>;
        /**
         * Some of our funds have been burnt.
         */
        Burnt: PlainDescriptor<Anonymize<I43kq8qudg7pq9>>;
        /**
         * Spending has finished; this is the amount that rolls over until next spend.
         */
        Rollover: PlainDescriptor<Anonymize<I76riseemre533>>;
        /**
         * Some funds have been deposited.
         */
        Deposit: PlainDescriptor<Anonymize<Ie5v6njpckr05b>>;
        /**
         * A new spend proposal has been approved.
         */
        SpendApproved: PlainDescriptor<Anonymize<I38bmcrmh852rk>>;
        /**
         * The inactive funds of the pallet have been updated.
         */
        UpdatedInactive: PlainDescriptor<Anonymize<I4hcillge8de5f>>;
        /**
         * A new asset spend proposal has been approved.
         */
        AssetSpendApproved: PlainDescriptor<Anonymize<I2cftk5tgrglaa>>;
        /**
         * An approved spend was voided.
         */
        AssetSpendVoided: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A payment happened.
         */
        Paid: PlainDescriptor<Anonymize<Iek7v4hrgnq6iv>>;
        /**
         * A payment failed and can be retried.
         */
        PaymentFailed: PlainDescriptor<Anonymize<Iek7v4hrgnq6iv>>;
        /**
         * A spend was processed and removed from the storage. It might have been successfully
         * paid or it may have expired.
         */
        SpendProcessed: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
    };
    AmbassadorCollective: {
        /**
         * A member `who` has been added.
         */
        MemberAdded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * The member `who`se rank has been changed to the given `rank`.
         */
        RankChanged: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` of given `rank` has been removed from the collective.
         */
        MemberRemoved: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` has voted for the `poll` with the given `vote` leading to an updated
         * `tally`.
         */
        Voted: PlainDescriptor<Anonymize<I21jsoeb0o6476>>;
        /**
         * The member `who` had their `AccountId` changed to `new_who`.
         */
        MemberExchanged: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    AmbassadorReferenda: {
        /**
         * A referendum has been submitted.
         */
        Submitted: PlainDescriptor<Anonymize<I229ijht536qdu>>;
        /**
         * The decision deposit has been placed.
         */
        DecisionDepositPlaced: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * The decision deposit has been refunded.
         */
        DecisionDepositRefunded: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * A deposit has been slashed.
         */
        DepositSlashed: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * A referendum has moved into the deciding phase.
         */
        DecisionStarted: PlainDescriptor<Anonymize<Ic6ecdcp9ut7jd>>;
        /**
        
         */
        ConfirmStarted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
        
         */
        ConfirmAborted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A referendum has ended its confirmation phase and is ready for approval.
         */
        Confirmed: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been approved and its proposal has been scheduled.
         */
        Approved: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A proposal has been rejected by referendum.
         */
        Rejected: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been timed out without being decided.
         */
        TimedOut: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been cancelled.
         */
        Cancelled: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * A referendum has been killed.
         */
        Killed: PlainDescriptor<Anonymize<I27notaksll8qt>>;
        /**
         * The submission deposit has been refunded.
         */
        SubmissionDepositRefunded: PlainDescriptor<Anonymize<I62nte77gksm0f>>;
        /**
         * Metadata for a referendum has been set.
         */
        MetadataSet: PlainDescriptor<Anonymize<I4f1hv034jf1dt>>;
        /**
         * Metadata for a referendum has been cleared.
         */
        MetadataCleared: PlainDescriptor<Anonymize<I4f1hv034jf1dt>>;
    };
    AmbassadorCore: {
        /**
         * Parameters for the pallet have changed.
         */
        ParamsChanged: PlainDescriptor<Anonymize<I5mruatkavn9hn>>;
        /**
         * Member activity flag has been set.
         */
        ActiveChanged: PlainDescriptor<Anonymize<I9j3uq1uk06oju>>;
        /**
         * Member has begun being tracked in this pallet.
         */
        Inducted: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Member has been removed from being tracked in this pallet (i.e. because rank is now
         * zero).
         */
        Offboarded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * Member has been promoted to the given rank.
         */
        Promoted: PlainDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Member has been demoted to the given (non-zero) rank.
         */
        Demoted: PlainDescriptor<Anonymize<I5kpe8b2kedtqn>>;
        /**
         * Member has been proven at their current rank, postponing auto-demotion.
         */
        Proven: PlainDescriptor<Anonymize<Ic79d2eioda33s>>;
        /**
         * Member has stated evidence of their efforts their request for rank.
         */
        Requested: PlainDescriptor<Anonymize<I2t83mr73603p9>>;
        /**
         * Some submitted evidence was judged and removed. There may or may not have been a change
         * to the rank, but in any case, `last_proof` is reset.
         */
        EvidenceJudged: PlainDescriptor<Anonymize<Ibas6o69e1qaqo>>;
        /**
         * Pre-ranked account has been inducted at their current rank.
         */
        Imported: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * A member had its AccountId swapped.
         */
        Swapped: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    AmbassadorSalary: {
        /**
         * A member is inducted into the payroll.
         */
        Inducted: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * A member registered for a payout.
         */
        Registered: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * A payment happened.
         */
        Paid: PlainDescriptor<Anonymize<I4vcrhqupmee7p>>;
        /**
         * The next cycle begins.
         */
        CycleStarted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A member swapped their account.
         */
        Swapped: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    AmbassadorTreasury: {
        /**
         * We have ended a spend period and will now allocate funds.
         */
        Spending: PlainDescriptor<Anonymize<I8iksqi3eani0a>>;
        /**
         * Some funds have been allocated.
         */
        Awarded: PlainDescriptor<Anonymize<I16enopmju1p0q>>;
        /**
         * Some of our funds have been burnt.
         */
        Burnt: PlainDescriptor<Anonymize<I43kq8qudg7pq9>>;
        /**
         * Spending has finished; this is the amount that rolls over until next spend.
         */
        Rollover: PlainDescriptor<Anonymize<I76riseemre533>>;
        /**
         * Some funds have been deposited.
         */
        Deposit: PlainDescriptor<Anonymize<Ie5v6njpckr05b>>;
        /**
         * A new spend proposal has been approved.
         */
        SpendApproved: PlainDescriptor<Anonymize<I38bmcrmh852rk>>;
        /**
         * The inactive funds of the pallet have been updated.
         */
        UpdatedInactive: PlainDescriptor<Anonymize<I4hcillge8de5f>>;
        /**
         * A new asset spend proposal has been approved.
         */
        AssetSpendApproved: PlainDescriptor<Anonymize<I2cftk5tgrglaa>>;
        /**
         * An approved spend was voided.
         */
        AssetSpendVoided: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A payment happened.
         */
        Paid: PlainDescriptor<Anonymize<Iek7v4hrgnq6iv>>;
        /**
         * A payment failed and can be retried.
         */
        PaymentFailed: PlainDescriptor<Anonymize<Iek7v4hrgnq6iv>>;
        /**
         * A spend was processed and removed from the storage. It might have been successfully
         * paid or it may have expired.
         */
        SpendProcessed: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
    };
    SecretaryCollective: {
        /**
         * A member `who` has been added.
         */
        MemberAdded: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * The member `who`se rank has been changed to the given `rank`.
         */
        RankChanged: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` of given `rank` has been removed from the collective.
         */
        MemberRemoved: PlainDescriptor<Anonymize<Im1pm2vf6llcn>>;
        /**
         * The member `who` has voted for the `poll` with the given `vote` leading to an updated
         * `tally`.
         */
        Voted: PlainDescriptor<Anonymize<I21jsoeb0o6476>>;
        /**
         * The member `who` had their `AccountId` changed to `new_who`.
         */
        MemberExchanged: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
    SecretarySalary: {
        /**
         * A member is inducted into the payroll.
         */
        Inducted: PlainDescriptor<Anonymize<I4cbvqmqadhrea>>;
        /**
         * A member registered for a payout.
         */
        Registered: PlainDescriptor<Anonymize<Id5fm4p8lj5qgi>>;
        /**
         * A payment happened.
         */
        Paid: PlainDescriptor<Anonymize<I4vcrhqupmee7p>>;
        /**
         * The next cycle begins.
         */
        CycleStarted: PlainDescriptor<Anonymize<I666bl2fqjkejo>>;
        /**
         * A member swapped their account.
         */
        Swapped: PlainDescriptor<Anonymize<Ier6ck0tpfo7>>;
    };
};
type IError = {
    System: {
        /**
         * The name of specification does not match between the current runtime
         * and the new runtime.
         */
        InvalidSpecName: PlainDescriptor<undefined>;
        /**
         * The specification version is not allowed to decrease between the current runtime
         * and the new runtime.
         */
        SpecVersionNeedsToIncrease: PlainDescriptor<undefined>;
        /**
         * Failed to extract the runtime version from the new runtime.
         *
         * Either calling `Core_version` or decoding `RuntimeVersion` failed.
         */
        FailedToExtractRuntimeVersion: PlainDescriptor<undefined>;
        /**
         * Suicide called when the account has non-default composite data.
         */
        NonDefaultComposite: PlainDescriptor<undefined>;
        /**
         * There is a non-zero reference count preventing the account from being purged.
         */
        NonZeroRefCount: PlainDescriptor<undefined>;
        /**
         * The origin filter prevent the call to be dispatched.
         */
        CallFiltered: PlainDescriptor<undefined>;
        /**
         * A multi-block migration is ongoing and prevents the current code from being replaced.
         */
        MultiBlockMigrationsOngoing: PlainDescriptor<undefined>;
        /**
         * No upgrade authorized.
         */
        NothingAuthorized: PlainDescriptor<undefined>;
        /**
         * The submitted code is not authorized.
         */
        Unauthorized: PlainDescriptor<undefined>;
    };
    ParachainSystem: {
        /**
         * Attempt to upgrade validation function while existing upgrade pending.
         */
        OverlappingUpgrades: PlainDescriptor<undefined>;
        /**
         * Polkadot currently prohibits this parachain from upgrading its validation function.
         */
        ProhibitedByPolkadot: PlainDescriptor<undefined>;
        /**
         * The supplied validation function has compiled into a blob larger than Polkadot is
         * willing to run.
         */
        TooBig: PlainDescriptor<undefined>;
        /**
         * The inherent which supplies the validation data did not run this block.
         */
        ValidationDataNotAvailable: PlainDescriptor<undefined>;
        /**
         * The inherent which supplies the host configuration did not run this block.
         */
        HostConfigurationNotAvailable: PlainDescriptor<undefined>;
        /**
         * No validation function upgrade is currently scheduled.
         */
        NotScheduled: PlainDescriptor<undefined>;
    };
    Balances: {
        /**
         * Vesting balance too high to send value.
         */
        VestingBalance: PlainDescriptor<undefined>;
        /**
         * Account liquidity restrictions prevent withdrawal.
         */
        LiquidityRestrictions: PlainDescriptor<undefined>;
        /**
         * Balance too low to send value.
         */
        InsufficientBalance: PlainDescriptor<undefined>;
        /**
         * Value too low to create account due to existential deposit.
         */
        ExistentialDeposit: PlainDescriptor<undefined>;
        /**
         * Transfer/payment would kill account.
         */
        Expendability: PlainDescriptor<undefined>;
        /**
         * A vesting schedule already exists for this account.
         */
        ExistingVestingSchedule: PlainDescriptor<undefined>;
        /**
         * Beneficiary account must pre-exist.
         */
        DeadAccount: PlainDescriptor<undefined>;
        /**
         * Number of named reserves exceed `MaxReserves`.
         */
        TooManyReserves: PlainDescriptor<undefined>;
        /**
         * Number of holds exceed `VariantCountOf<T::RuntimeHoldReason>`.
         */
        TooManyHolds: PlainDescriptor<undefined>;
        /**
         * Number of freezes exceed `MaxFreezes`.
         */
        TooManyFreezes: PlainDescriptor<undefined>;
        /**
         * The issuance cannot be modified since it is already deactivated.
         */
        IssuanceDeactivated: PlainDescriptor<undefined>;
        /**
         * The delta cannot be zero.
         */
        DeltaZero: PlainDescriptor<undefined>;
    };
    CollatorSelection: {
        /**
         * The pallet has too many candidates.
         */
        TooManyCandidates: PlainDescriptor<undefined>;
        /**
         * Leaving would result in too few candidates.
         */
        TooFewEligibleCollators: PlainDescriptor<undefined>;
        /**
         * Account is already a candidate.
         */
        AlreadyCandidate: PlainDescriptor<undefined>;
        /**
         * Account is not a candidate.
         */
        NotCandidate: PlainDescriptor<undefined>;
        /**
         * There are too many Invulnerables.
         */
        TooManyInvulnerables: PlainDescriptor<undefined>;
        /**
         * Account is already an Invulnerable.
         */
        AlreadyInvulnerable: PlainDescriptor<undefined>;
        /**
         * Account is not an Invulnerable.
         */
        NotInvulnerable: PlainDescriptor<undefined>;
        /**
         * Account has no associated validator ID.
         */
        NoAssociatedValidatorId: PlainDescriptor<undefined>;
        /**
         * Validator ID is not yet registered.
         */
        ValidatorNotRegistered: PlainDescriptor<undefined>;
        /**
         * Could not insert in the candidate list.
         */
        InsertToCandidateListFailed: PlainDescriptor<undefined>;
        /**
         * Could not remove from the candidate list.
         */
        RemoveFromCandidateListFailed: PlainDescriptor<undefined>;
        /**
         * New deposit amount would be below the minimum candidacy bond.
         */
        DepositTooLow: PlainDescriptor<undefined>;
        /**
         * Could not update the candidate list.
         */
        UpdateCandidateListFailed: PlainDescriptor<undefined>;
        /**
         * Deposit amount is too low to take the target's slot in the candidate list.
         */
        InsufficientBond: PlainDescriptor<undefined>;
        /**
         * The target account to be replaced in the candidate list is not a candidate.
         */
        TargetIsNotCandidate: PlainDescriptor<undefined>;
        /**
         * The updated deposit amount is equal to the amount already reserved.
         */
        IdenticalDeposit: PlainDescriptor<undefined>;
        /**
         * Cannot lower candidacy bond while occupying a future collator slot in the list.
         */
        InvalidUnreserve: PlainDescriptor<undefined>;
    };
    Session: {
        /**
         * Invalid ownership proof.
         */
        InvalidProof: PlainDescriptor<undefined>;
        /**
         * No associated validator ID for account.
         */
        NoAssociatedValidatorId: PlainDescriptor<undefined>;
        /**
         * Registered duplicate key.
         */
        DuplicatedKey: PlainDescriptor<undefined>;
        /**
         * No keys are associated with this account.
         */
        NoKeys: PlainDescriptor<undefined>;
        /**
         * Key setting account is not live, so it's impossible to associate keys.
         */
        NoAccount: PlainDescriptor<undefined>;
    };
    XcmpQueue: {
        /**
         * Setting the queue config failed since one of its values was invalid.
         */
        BadQueueConfig: PlainDescriptor<undefined>;
        /**
         * The execution is already suspended.
         */
        AlreadySuspended: PlainDescriptor<undefined>;
        /**
         * The execution is already resumed.
         */
        AlreadyResumed: PlainDescriptor<undefined>;
        /**
         * There are too many active outbound channels.
         */
        TooManyActiveOutboundChannels: PlainDescriptor<undefined>;
        /**
         * The message is too big.
         */
        TooBig: PlainDescriptor<undefined>;
    };
    PolkadotXcm: {
        /**
         * The desired destination was unreachable, generally because there is a no way of routing
         * to it.
         */
        Unreachable: PlainDescriptor<undefined>;
        /**
         * There was some other issue (i.e. not to do with routing) in sending the message.
         * Perhaps a lack of space for buffering the message.
         */
        SendFailure: PlainDescriptor<undefined>;
        /**
         * The message execution fails the filter.
         */
        Filtered: PlainDescriptor<undefined>;
        /**
         * The message's weight could not be determined.
         */
        UnweighableMessage: PlainDescriptor<undefined>;
        /**
         * The destination `Location` provided cannot be inverted.
         */
        DestinationNotInvertible: PlainDescriptor<undefined>;
        /**
         * The assets to be sent are empty.
         */
        Empty: PlainDescriptor<undefined>;
        /**
         * Could not re-anchor the assets to declare the fees for the destination chain.
         */
        CannotReanchor: PlainDescriptor<undefined>;
        /**
         * Too many assets have been attempted for transfer.
         */
        TooManyAssets: PlainDescriptor<undefined>;
        /**
         * Origin is invalid for sending.
         */
        InvalidOrigin: PlainDescriptor<undefined>;
        /**
         * The version of the `Versioned` value used is not able to be interpreted.
         */
        BadVersion: PlainDescriptor<undefined>;
        /**
         * The given location could not be used (e.g. because it cannot be expressed in the
         * desired version of XCM).
         */
        BadLocation: PlainDescriptor<undefined>;
        /**
         * The referenced subscription could not be found.
         */
        NoSubscription: PlainDescriptor<undefined>;
        /**
         * The location is invalid since it already has a subscription from us.
         */
        AlreadySubscribed: PlainDescriptor<undefined>;
        /**
         * Could not check-out the assets for teleportation to the destination chain.
         */
        CannotCheckOutTeleport: PlainDescriptor<undefined>;
        /**
         * The owner does not own (all) of the asset that they wish to do the operation on.
         */
        LowBalance: PlainDescriptor<undefined>;
        /**
         * The asset owner has too many locks on the asset.
         */
        TooManyLocks: PlainDescriptor<undefined>;
        /**
         * The given account is not an identifiable sovereign account for any location.
         */
        AccountNotSovereign: PlainDescriptor<undefined>;
        /**
         * The operation required fees to be paid which the initiator could not meet.
         */
        FeesNotMet: PlainDescriptor<undefined>;
        /**
         * A remote lock with the corresponding data could not be found.
         */
        LockNotFound: PlainDescriptor<undefined>;
        /**
         * The unlock operation cannot succeed because there are still consumers of the lock.
         */
        InUse: PlainDescriptor<undefined>;
        /**
         * Invalid asset, reserve chain could not be determined for it.
         */
        InvalidAssetUnknownReserve: PlainDescriptor<undefined>;
        /**
         * Invalid asset, do not support remote asset reserves with different fees reserves.
         */
        InvalidAssetUnsupportedReserve: PlainDescriptor<undefined>;
        /**
         * Too many assets with different reserve locations have been attempted for transfer.
         */
        TooManyReserves: PlainDescriptor<undefined>;
        /**
         * Local XCM execution incomplete.
         */
        LocalExecutionIncomplete: PlainDescriptor<undefined>;
        /**
         * Too many locations authorized to alias origin.
         */
        TooManyAuthorizedAliases: PlainDescriptor<undefined>;
        /**
         * Expiry block number is in the past.
         */
        ExpiresInPast: PlainDescriptor<undefined>;
        /**
         * The alias to remove authorization for was not found.
         */
        AliasNotFound: PlainDescriptor<undefined>;
        /**
         * Local XCM execution incomplete with the actual XCM error and the index of the
         * instruction that caused the error.
         */
        LocalExecutionIncompleteWithError: PlainDescriptor<Anonymize<I5r8t4iaend96p>>;
    };
    MessageQueue: {
        /**
         * Page is not reapable because it has items remaining to be processed and is not old
         * enough.
         */
        NotReapable: PlainDescriptor<undefined>;
        /**
         * Page to be reaped does not exist.
         */
        NoPage: PlainDescriptor<undefined>;
        /**
         * The referenced message could not be found.
         */
        NoMessage: PlainDescriptor<undefined>;
        /**
         * The message was already processed and cannot be processed again.
         */
        AlreadyProcessed: PlainDescriptor<undefined>;
        /**
         * The message is queued for future execution.
         */
        Queued: PlainDescriptor<undefined>;
        /**
         * There is temporarily not enough weight to continue servicing messages.
         */
        InsufficientWeight: PlainDescriptor<undefined>;
        /**
         * This message is temporarily unprocessable.
         *
         * Such errors are expected, but not guaranteed, to resolve themselves eventually through
         * retrying.
         */
        TemporarilyUnprocessable: PlainDescriptor<undefined>;
        /**
         * The queue is paused and no message can be executed from it.
         *
         * This can change at any time and may resolve in the future by re-trying.
         */
        QueuePaused: PlainDescriptor<undefined>;
        /**
         * Another call is in progress and needs to finish before this call can happen.
         */
        RecursiveDisallowed: PlainDescriptor<undefined>;
    };
    Utility: {
        /**
         * Too many calls batched.
         */
        TooManyCalls: PlainDescriptor<undefined>;
    };
    Multisig: {
        /**
         * Threshold must be 2 or greater.
         */
        MinimumThreshold: PlainDescriptor<undefined>;
        /**
         * Call is already approved by this signatory.
         */
        AlreadyApproved: PlainDescriptor<undefined>;
        /**
         * Call doesn't need any (more) approvals.
         */
        NoApprovalsNeeded: PlainDescriptor<undefined>;
        /**
         * There are too few signatories in the list.
         */
        TooFewSignatories: PlainDescriptor<undefined>;
        /**
         * There are too many signatories in the list.
         */
        TooManySignatories: PlainDescriptor<undefined>;
        /**
         * The signatories were provided out of order; they should be ordered.
         */
        SignatoriesOutOfOrder: PlainDescriptor<undefined>;
        /**
         * The sender was contained in the other signatories; it shouldn't be.
         */
        SenderInSignatories: PlainDescriptor<undefined>;
        /**
         * Multisig operation not found in storage.
         */
        NotFound: PlainDescriptor<undefined>;
        /**
         * Only the account that originally created the multisig is able to cancel it or update
         * its deposits.
         */
        NotOwner: PlainDescriptor<undefined>;
        /**
         * No timepoint was given, yet the multisig operation is already underway.
         */
        NoTimepoint: PlainDescriptor<undefined>;
        /**
         * A different timepoint was given to the multisig operation that is underway.
         */
        WrongTimepoint: PlainDescriptor<undefined>;
        /**
         * A timepoint was given, yet no multisig operation is underway.
         */
        UnexpectedTimepoint: PlainDescriptor<undefined>;
        /**
         * The maximum weight information provided was too low.
         */
        MaxWeightTooLow: PlainDescriptor<undefined>;
        /**
         * The data to be stored is already stored.
         */
        AlreadyStored: PlainDescriptor<undefined>;
    };
    Proxy: {
        /**
         * There are too many proxies registered or too many announcements pending.
         */
        TooMany: PlainDescriptor<undefined>;
        /**
         * Proxy registration not found.
         */
        NotFound: PlainDescriptor<undefined>;
        /**
         * Sender is not a proxy of the account to be proxied.
         */
        NotProxy: PlainDescriptor<undefined>;
        /**
         * A call which is incompatible with the proxy type's filter was attempted.
         */
        Unproxyable: PlainDescriptor<undefined>;
        /**
         * Account is already a proxy.
         */
        Duplicate: PlainDescriptor<undefined>;
        /**
         * Call may not be made by proxy because it may escalate its privileges.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * Announcement, if made at all, was made too recently.
         */
        Unannounced: PlainDescriptor<undefined>;
        /**
         * Cannot add self as proxy.
         */
        NoSelfProxy: PlainDescriptor<undefined>;
    };
    Preimage: {
        /**
         * Preimage is too large to store on-chain.
         */
        TooBig: PlainDescriptor<undefined>;
        /**
         * Preimage has already been noted on-chain.
         */
        AlreadyNoted: PlainDescriptor<undefined>;
        /**
         * The user is not authorized to perform this action.
         */
        NotAuthorized: PlainDescriptor<undefined>;
        /**
         * The preimage cannot be removed since it has not yet been noted.
         */
        NotNoted: PlainDescriptor<undefined>;
        /**
         * A preimage may not be removed when there are outstanding requests.
         */
        Requested: PlainDescriptor<undefined>;
        /**
         * The preimage request cannot be removed since no outstanding requests exist.
         */
        NotRequested: PlainDescriptor<undefined>;
        /**
         * More than `MAX_HASH_UPGRADE_BULK_COUNT` hashes were requested to be upgraded at once.
         */
        TooMany: PlainDescriptor<undefined>;
        /**
         * Too few hashes were requested to be upgraded (i.e. zero).
         */
        TooFew: PlainDescriptor<undefined>;
    };
    Scheduler: {
        /**
         * Failed to schedule a call
         */
        FailedToSchedule: PlainDescriptor<undefined>;
        /**
         * Cannot find the scheduled call.
         */
        NotFound: PlainDescriptor<undefined>;
        /**
         * Given target block number is in the past.
         */
        TargetBlockNumberInPast: PlainDescriptor<undefined>;
        /**
         * Reschedule failed because it does not change scheduled time.
         */
        RescheduleNoChange: PlainDescriptor<undefined>;
        /**
         * Attempt to use a non-named function on a named task.
         */
        Named: PlainDescriptor<undefined>;
    };
    AssetRate: {
        /**
         * The given asset ID is unknown.
         */
        UnknownAssetKind: PlainDescriptor<undefined>;
        /**
         * The given asset ID already has an assigned conversion rate and cannot be re-created.
         */
        AlreadyExists: PlainDescriptor<undefined>;
        /**
         * Overflow ocurred when calculating the inverse rate.
         */
        Overflow: PlainDescriptor<undefined>;
    };
    Alliance: {
        /**
         * The Alliance has not been initialized yet, therefore accounts cannot join it.
         */
        AllianceNotYetInitialized: PlainDescriptor<undefined>;
        /**
         * The Alliance has been initialized, therefore cannot be initialized again.
         */
        AllianceAlreadyInitialized: PlainDescriptor<undefined>;
        /**
         * Account is already a member.
         */
        AlreadyMember: PlainDescriptor<undefined>;
        /**
         * Account is not a member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * Account is not an ally.
         */
        NotAlly: PlainDescriptor<undefined>;
        /**
         * Account does not have voting rights.
         */
        NoVotingRights: PlainDescriptor<undefined>;
        /**
         * Account is already an elevated (fellow) member.
         */
        AlreadyElevated: PlainDescriptor<undefined>;
        /**
         * Item is already listed as unscrupulous.
         */
        AlreadyUnscrupulous: PlainDescriptor<undefined>;
        /**
         * Account has been deemed unscrupulous by the Alliance and is not welcome to join or be
         * nominated.
         */
        AccountNonGrata: PlainDescriptor<undefined>;
        /**
         * Item has not been deemed unscrupulous.
         */
        NotListedAsUnscrupulous: PlainDescriptor<undefined>;
        /**
         * The number of unscrupulous items exceeds `MaxUnscrupulousItems`.
         */
        TooManyUnscrupulousItems: PlainDescriptor<undefined>;
        /**
         * Length of website URL exceeds `MaxWebsiteUrlLength`.
         */
        TooLongWebsiteUrl: PlainDescriptor<undefined>;
        /**
         * Balance is insufficient for the required deposit.
         */
        InsufficientFunds: PlainDescriptor<undefined>;
        /**
         * The account's identity does not have display field and website field.
         */
        WithoutRequiredIdentityFields: PlainDescriptor<undefined>;
        /**
         * The account's identity has no good judgement.
         */
        WithoutGoodIdentityJudgement: PlainDescriptor<undefined>;
        /**
         * The proposal hash is not found.
         */
        MissingProposalHash: PlainDescriptor<undefined>;
        /**
         * The announcement is not found.
         */
        MissingAnnouncement: PlainDescriptor<undefined>;
        /**
         * Number of members exceeds `MaxMembersCount`.
         */
        TooManyMembers: PlainDescriptor<undefined>;
        /**
         * Number of announcements exceeds `MaxAnnouncementsCount`.
         */
        TooManyAnnouncements: PlainDescriptor<undefined>;
        /**
         * Invalid witness data given.
         */
        BadWitness: PlainDescriptor<undefined>;
        /**
         * Account already gave retirement notice
         */
        AlreadyRetiring: PlainDescriptor<undefined>;
        /**
         * Account did not give a retirement notice required to retire.
         */
        RetirementNoticeNotGiven: PlainDescriptor<undefined>;
        /**
         * Retirement period has not passed.
         */
        RetirementPeriodNotPassed: PlainDescriptor<undefined>;
        /**
         * Fellows must be provided to initialize the Alliance.
         */
        FellowsMissing: PlainDescriptor<undefined>;
    };
    AllianceMotion: {
        /**
         * Account is not a member
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * Duplicate proposals not allowed
         */
        DuplicateProposal: PlainDescriptor<undefined>;
        /**
         * Proposal must exist
         */
        ProposalMissing: PlainDescriptor<undefined>;
        /**
         * Mismatched index
         */
        WrongIndex: PlainDescriptor<undefined>;
        /**
         * Duplicate vote ignored
         */
        DuplicateVote: PlainDescriptor<undefined>;
        /**
         * Members are already initialized!
         */
        AlreadyInitialized: PlainDescriptor<undefined>;
        /**
         * The close call was made too early, before the end of the voting.
         */
        TooEarly: PlainDescriptor<undefined>;
        /**
         * There can only be a maximum of `MaxProposals` active proposals.
         */
        TooManyProposals: PlainDescriptor<undefined>;
        /**
         * The given weight bound for the proposal was too low.
         */
        WrongProposalWeight: PlainDescriptor<undefined>;
        /**
         * The given length bound for the proposal was too low.
         */
        WrongProposalLength: PlainDescriptor<undefined>;
        /**
         * Prime account is not a member
         */
        PrimeAccountNotMember: PlainDescriptor<undefined>;
        /**
         * Proposal is still active.
         */
        ProposalActive: PlainDescriptor<undefined>;
    };
    FellowshipCollective: {
        /**
         * Account is already a member.
         */
        AlreadyMember: PlainDescriptor<undefined>;
        /**
         * Account is not a member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The given poll index is unknown or has closed.
         */
        NotPolling: PlainDescriptor<undefined>;
        /**
         * The given poll is still ongoing.
         */
        Ongoing: PlainDescriptor<undefined>;
        /**
         * There are no further records to be removed.
         */
        NoneRemaining: PlainDescriptor<undefined>;
        /**
         * Unexpected error in state.
         */
        Corruption: PlainDescriptor<undefined>;
        /**
         * The member's rank is too low to vote.
         */
        RankTooLow: PlainDescriptor<undefined>;
        /**
         * The information provided is incorrect.
         */
        InvalidWitness: PlainDescriptor<undefined>;
        /**
         * The origin is not sufficiently privileged to do the operation.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * The new member to exchange is the same as the old member
         */
        SameMember: PlainDescriptor<undefined>;
        /**
         * The max member count for the rank has been reached.
         */
        TooManyMembers: PlainDescriptor<undefined>;
    };
    FellowshipReferenda: {
        /**
         * Referendum is not ongoing.
         */
        NotOngoing: PlainDescriptor<undefined>;
        /**
         * Referendum's decision deposit is already paid.
         */
        HasDeposit: PlainDescriptor<undefined>;
        /**
         * The track identifier given was invalid.
         */
        BadTrack: PlainDescriptor<undefined>;
        /**
         * There are already a full complement of referenda in progress for this track.
         */
        Full: PlainDescriptor<undefined>;
        /**
         * The queue of the track is empty.
         */
        QueueEmpty: PlainDescriptor<undefined>;
        /**
         * The referendum index provided is invalid in this context.
         */
        BadReferendum: PlainDescriptor<undefined>;
        /**
         * There was nothing to do in the advancement.
         */
        NothingToDo: PlainDescriptor<undefined>;
        /**
         * No track exists for the proposal origin.
         */
        NoTrack: PlainDescriptor<undefined>;
        /**
         * Any deposit cannot be refunded until after the decision is over.
         */
        Unfinished: PlainDescriptor<undefined>;
        /**
         * The deposit refunder is not the depositor.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * The deposit cannot be refunded since none was made.
         */
        NoDeposit: PlainDescriptor<undefined>;
        /**
         * The referendum status is invalid for this operation.
         */
        BadStatus: PlainDescriptor<undefined>;
        /**
         * The preimage does not exist.
         */
        PreimageNotExist: PlainDescriptor<undefined>;
        /**
         * The preimage is stored with a different length than the one provided.
         */
        PreimageStoredWithDifferentLength: PlainDescriptor<undefined>;
    };
    FellowshipCore: {
        /**
         * Member's rank is too low.
         */
        Unranked: PlainDescriptor<undefined>;
        /**
         * Member's rank is not zero.
         */
        Ranked: PlainDescriptor<undefined>;
        /**
         * Member's rank is not as expected - generally means that the rank provided to the call
         * does not agree with the state of the system.
         */
        UnexpectedRank: PlainDescriptor<undefined>;
        /**
         * The given rank is invalid - this generally means it's not between 1 and `RANK_COUNT`.
         */
        InvalidRank: PlainDescriptor<undefined>;
        /**
         * The origin does not have enough permission to do this operation.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * No work needs to be done at present for this member.
         */
        NothingDoing: PlainDescriptor<undefined>;
        /**
         * The candidate has already been inducted. This should never happen since it would
         * require a candidate (rank 0) to already be tracked in the pallet.
         */
        AlreadyInducted: PlainDescriptor<undefined>;
        /**
         * The candidate has not been inducted, so cannot be offboarded from this pallet.
         */
        NotTracked: PlainDescriptor<undefined>;
        /**
         * Operation cannot be done yet since not enough time has passed.
         */
        TooSoon: PlainDescriptor<undefined>;
    };
    FellowshipSalary: {
        /**
         * The salary system has already been started.
         */
        AlreadyStarted: PlainDescriptor<undefined>;
        /**
         * The account is not a ranked member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The account is already inducted.
         */
        AlreadyInducted: PlainDescriptor<undefined>;
        /**
        
         */
        NotInducted: PlainDescriptor<undefined>;
        /**
         * The member does not have a current valid claim.
         */
        NoClaim: PlainDescriptor<undefined>;
        /**
         * The member's claim is zero.
         */
        ClaimZero: PlainDescriptor<undefined>;
        /**
         * Current cycle's registration period is over.
         */
        TooLate: PlainDescriptor<undefined>;
        /**
         * Current cycle's payment period is not yet begun.
         */
        TooEarly: PlainDescriptor<undefined>;
        /**
         * Cycle is not yet over.
         */
        NotYet: PlainDescriptor<undefined>;
        /**
         * The payout cycles have not yet started.
         */
        NotStarted: PlainDescriptor<undefined>;
        /**
         * There is no budget left for the payout.
         */
        Bankrupt: PlainDescriptor<undefined>;
        /**
         * There was some issue with the mechanism of payment.
         */
        PayError: PlainDescriptor<undefined>;
        /**
         * The payment has neither failed nor succeeded yet.
         */
        Inconclusive: PlainDescriptor<undefined>;
        /**
         * The cycle is after that in which the payment was made.
         */
        NotCurrent: PlainDescriptor<undefined>;
    };
    FellowshipTreasury: {
        /**
         * No proposal, bounty or spend at that index.
         */
        InvalidIndex: PlainDescriptor<undefined>;
        /**
         * Too many approvals in the queue.
         */
        TooManyApprovals: PlainDescriptor<undefined>;
        /**
         * The spend origin is valid but the amount it is allowed to spend is lower than the
         * amount to be spent.
         */
        InsufficientPermission: PlainDescriptor<undefined>;
        /**
         * Proposal has not been approved.
         */
        ProposalNotApproved: PlainDescriptor<undefined>;
        /**
         * The balance of the asset kind is not convertible to the balance of the native asset.
         */
        FailedToConvertBalance: PlainDescriptor<undefined>;
        /**
         * The spend has expired and cannot be claimed.
         */
        SpendExpired: PlainDescriptor<undefined>;
        /**
         * The spend is not yet eligible for payout.
         */
        EarlyPayout: PlainDescriptor<undefined>;
        /**
         * The payment has already been attempted.
         */
        AlreadyAttempted: PlainDescriptor<undefined>;
        /**
         * There was some issue with the mechanism of payment.
         */
        PayoutError: PlainDescriptor<undefined>;
        /**
         * The payout was not yet attempted/claimed.
         */
        NotAttempted: PlainDescriptor<undefined>;
        /**
         * The payment has neither failed nor succeeded yet.
         */
        Inconclusive: PlainDescriptor<undefined>;
    };
    AmbassadorCollective: {
        /**
         * Account is already a member.
         */
        AlreadyMember: PlainDescriptor<undefined>;
        /**
         * Account is not a member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The given poll index is unknown or has closed.
         */
        NotPolling: PlainDescriptor<undefined>;
        /**
         * The given poll is still ongoing.
         */
        Ongoing: PlainDescriptor<undefined>;
        /**
         * There are no further records to be removed.
         */
        NoneRemaining: PlainDescriptor<undefined>;
        /**
         * Unexpected error in state.
         */
        Corruption: PlainDescriptor<undefined>;
        /**
         * The member's rank is too low to vote.
         */
        RankTooLow: PlainDescriptor<undefined>;
        /**
         * The information provided is incorrect.
         */
        InvalidWitness: PlainDescriptor<undefined>;
        /**
         * The origin is not sufficiently privileged to do the operation.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * The new member to exchange is the same as the old member
         */
        SameMember: PlainDescriptor<undefined>;
        /**
         * The max member count for the rank has been reached.
         */
        TooManyMembers: PlainDescriptor<undefined>;
    };
    AmbassadorReferenda: {
        /**
         * Referendum is not ongoing.
         */
        NotOngoing: PlainDescriptor<undefined>;
        /**
         * Referendum's decision deposit is already paid.
         */
        HasDeposit: PlainDescriptor<undefined>;
        /**
         * The track identifier given was invalid.
         */
        BadTrack: PlainDescriptor<undefined>;
        /**
         * There are already a full complement of referenda in progress for this track.
         */
        Full: PlainDescriptor<undefined>;
        /**
         * The queue of the track is empty.
         */
        QueueEmpty: PlainDescriptor<undefined>;
        /**
         * The referendum index provided is invalid in this context.
         */
        BadReferendum: PlainDescriptor<undefined>;
        /**
         * There was nothing to do in the advancement.
         */
        NothingToDo: PlainDescriptor<undefined>;
        /**
         * No track exists for the proposal origin.
         */
        NoTrack: PlainDescriptor<undefined>;
        /**
         * Any deposit cannot be refunded until after the decision is over.
         */
        Unfinished: PlainDescriptor<undefined>;
        /**
         * The deposit refunder is not the depositor.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * The deposit cannot be refunded since none was made.
         */
        NoDeposit: PlainDescriptor<undefined>;
        /**
         * The referendum status is invalid for this operation.
         */
        BadStatus: PlainDescriptor<undefined>;
        /**
         * The preimage does not exist.
         */
        PreimageNotExist: PlainDescriptor<undefined>;
        /**
         * The preimage is stored with a different length than the one provided.
         */
        PreimageStoredWithDifferentLength: PlainDescriptor<undefined>;
    };
    AmbassadorCore: {
        /**
         * Member's rank is too low.
         */
        Unranked: PlainDescriptor<undefined>;
        /**
         * Member's rank is not zero.
         */
        Ranked: PlainDescriptor<undefined>;
        /**
         * Member's rank is not as expected - generally means that the rank provided to the call
         * does not agree with the state of the system.
         */
        UnexpectedRank: PlainDescriptor<undefined>;
        /**
         * The given rank is invalid - this generally means it's not between 1 and `RANK_COUNT`.
         */
        InvalidRank: PlainDescriptor<undefined>;
        /**
         * The origin does not have enough permission to do this operation.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * No work needs to be done at present for this member.
         */
        NothingDoing: PlainDescriptor<undefined>;
        /**
         * The candidate has already been inducted. This should never happen since it would
         * require a candidate (rank 0) to already be tracked in the pallet.
         */
        AlreadyInducted: PlainDescriptor<undefined>;
        /**
         * The candidate has not been inducted, so cannot be offboarded from this pallet.
         */
        NotTracked: PlainDescriptor<undefined>;
        /**
         * Operation cannot be done yet since not enough time has passed.
         */
        TooSoon: PlainDescriptor<undefined>;
    };
    AmbassadorSalary: {
        /**
         * The salary system has already been started.
         */
        AlreadyStarted: PlainDescriptor<undefined>;
        /**
         * The account is not a ranked member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The account is already inducted.
         */
        AlreadyInducted: PlainDescriptor<undefined>;
        /**
        
         */
        NotInducted: PlainDescriptor<undefined>;
        /**
         * The member does not have a current valid claim.
         */
        NoClaim: PlainDescriptor<undefined>;
        /**
         * The member's claim is zero.
         */
        ClaimZero: PlainDescriptor<undefined>;
        /**
         * Current cycle's registration period is over.
         */
        TooLate: PlainDescriptor<undefined>;
        /**
         * Current cycle's payment period is not yet begun.
         */
        TooEarly: PlainDescriptor<undefined>;
        /**
         * Cycle is not yet over.
         */
        NotYet: PlainDescriptor<undefined>;
        /**
         * The payout cycles have not yet started.
         */
        NotStarted: PlainDescriptor<undefined>;
        /**
         * There is no budget left for the payout.
         */
        Bankrupt: PlainDescriptor<undefined>;
        /**
         * There was some issue with the mechanism of payment.
         */
        PayError: PlainDescriptor<undefined>;
        /**
         * The payment has neither failed nor succeeded yet.
         */
        Inconclusive: PlainDescriptor<undefined>;
        /**
         * The cycle is after that in which the payment was made.
         */
        NotCurrent: PlainDescriptor<undefined>;
    };
    AmbassadorTreasury: {
        /**
         * No proposal, bounty or spend at that index.
         */
        InvalidIndex: PlainDescriptor<undefined>;
        /**
         * Too many approvals in the queue.
         */
        TooManyApprovals: PlainDescriptor<undefined>;
        /**
         * The spend origin is valid but the amount it is allowed to spend is lower than the
         * amount to be spent.
         */
        InsufficientPermission: PlainDescriptor<undefined>;
        /**
         * Proposal has not been approved.
         */
        ProposalNotApproved: PlainDescriptor<undefined>;
        /**
         * The balance of the asset kind is not convertible to the balance of the native asset.
         */
        FailedToConvertBalance: PlainDescriptor<undefined>;
        /**
         * The spend has expired and cannot be claimed.
         */
        SpendExpired: PlainDescriptor<undefined>;
        /**
         * The spend is not yet eligible for payout.
         */
        EarlyPayout: PlainDescriptor<undefined>;
        /**
         * The payment has already been attempted.
         */
        AlreadyAttempted: PlainDescriptor<undefined>;
        /**
         * There was some issue with the mechanism of payment.
         */
        PayoutError: PlainDescriptor<undefined>;
        /**
         * The payout was not yet attempted/claimed.
         */
        NotAttempted: PlainDescriptor<undefined>;
        /**
         * The payment has neither failed nor succeeded yet.
         */
        Inconclusive: PlainDescriptor<undefined>;
    };
    SecretaryCollective: {
        /**
         * Account is already a member.
         */
        AlreadyMember: PlainDescriptor<undefined>;
        /**
         * Account is not a member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The given poll index is unknown or has closed.
         */
        NotPolling: PlainDescriptor<undefined>;
        /**
         * The given poll is still ongoing.
         */
        Ongoing: PlainDescriptor<undefined>;
        /**
         * There are no further records to be removed.
         */
        NoneRemaining: PlainDescriptor<undefined>;
        /**
         * Unexpected error in state.
         */
        Corruption: PlainDescriptor<undefined>;
        /**
         * The member's rank is too low to vote.
         */
        RankTooLow: PlainDescriptor<undefined>;
        /**
         * The information provided is incorrect.
         */
        InvalidWitness: PlainDescriptor<undefined>;
        /**
         * The origin is not sufficiently privileged to do the operation.
         */
        NoPermission: PlainDescriptor<undefined>;
        /**
         * The new member to exchange is the same as the old member
         */
        SameMember: PlainDescriptor<undefined>;
        /**
         * The max member count for the rank has been reached.
         */
        TooManyMembers: PlainDescriptor<undefined>;
    };
    SecretarySalary: {
        /**
         * The salary system has already been started.
         */
        AlreadyStarted: PlainDescriptor<undefined>;
        /**
         * The account is not a ranked member.
         */
        NotMember: PlainDescriptor<undefined>;
        /**
         * The account is already inducted.
         */
        AlreadyInducted: PlainDescriptor<undefined>;
        /**
        
         */
        NotInducted: PlainDescriptor<undefined>;
        /**
         * The member does not have a current valid claim.
         */
        NoClaim: PlainDescriptor<undefined>;
        /**
         * The member's claim is zero.
         */
        ClaimZero: PlainDescriptor<undefined>;
        /**
         * Current cycle's registration period is over.
         */
        TooLate: PlainDescriptor<undefined>;
        /**
         * Current cycle's payment period is not yet begun.
         */
        TooEarly: PlainDescriptor<undefined>;
        /**
         * Cycle is not yet over.
         */
        NotYet: PlainDescriptor<undefined>;
        /**
         * The payout cycles have not yet started.
         */
        NotStarted: PlainDescriptor<undefined>;
        /**
         * There is no budget left for the payout.
         */
        Bankrupt: PlainDescriptor<undefined>;
        /**
         * There was some issue with the mechanism of payment.
         */
        PayError: PlainDescriptor<undefined>;
        /**
         * The payment has neither failed nor succeeded yet.
         */
        Inconclusive: PlainDescriptor<undefined>;
        /**
         * The cycle is after that in which the payment was made.
         */
        NotCurrent: PlainDescriptor<undefined>;
    };
};
type IConstants = {
    System: {
        /**
         * Block & extrinsics weights: base values and limits.
         */
        BlockWeights: PlainDescriptor<Anonymize<In7a38730s6qs>>;
        /**
         * The maximum length of a block (in bytes).
         */
        BlockLength: PlainDescriptor<Anonymize<Ibtil0ss5munbk>>;
        /**
         * Maximum number of block number to block hash mappings to keep (oldest pruned first).
         */
        BlockHashCount: PlainDescriptor<number>;
        /**
         * The weight of runtime database operations the runtime can invoke.
         */
        DbWeight: PlainDescriptor<Anonymize<I9s0ave7t0vnrk>>;
        /**
         * Get the chain's in-code version.
         */
        Version: PlainDescriptor<Anonymize<I4fo08joqmcqnm>>;
        /**
         * The designated SS58 prefix of this chain.
         *
         * This replaces the "ss58Format" property declared in the chain spec. Reason is
         * that the runtime should know about the prefix in order to make use of it as
         * an identifier of the chain.
         */
        SS58Prefix: PlainDescriptor<number>;
    };
    ParachainSystem: {
        /**
         * Returns the parachain ID we are running with.
         */
        SelfParaId: PlainDescriptor<number>;
    };
    Timestamp: {
        /**
         * The minimum period between blocks.
         *
         * Be aware that this is different to the *expected* period that the block production
         * apparatus provides. Your chosen consensus system will generally work with this to
         * determine a sensible block time. For example, in the Aura pallet it will be double this
         * period on default settings.
         */
        MinimumPeriod: PlainDescriptor<bigint>;
    };
    Balances: {
        /**
         * The minimum amount required to keep an account open. MUST BE GREATER THAN ZERO!
         *
         * If you *really* need it to be zero, you can enable the feature `insecure_zero_ed` for
         * this pallet. However, you do so at your own risk: this will open up a major DoS vector.
         * In case you have multiple sources of provider references, you may also get unexpected
         * behaviour if you set this to zero.
         *
         * Bottom line: Do yourself a favour and make it at least one!
         */
        ExistentialDeposit: PlainDescriptor<bigint>;
        /**
         * The maximum number of locks that should exist on an account.
         * Not strictly enforced, but used for weight estimation.
         *
         * Use of locks is deprecated in favour of freezes. See `https://github.com/paritytech/substrate/pull/12951/`
         */
        MaxLocks: PlainDescriptor<number>;
        /**
         * The maximum number of named reserves that can exist on an account.
         *
         * Use of reserves is deprecated in favour of holds. See `https://github.com/paritytech/substrate/pull/12951/`
         */
        MaxReserves: PlainDescriptor<number>;
        /**
         * The maximum number of individual freeze locks that can exist on an account at any time.
         */
        MaxFreezes: PlainDescriptor<number>;
    };
    TransactionPayment: {
        /**
         * A fee multiplier for `Operational` extrinsics to compute "virtual tip" to boost their
         * `priority`
         *
         * This value is multiplied by the `final_fee` to obtain a "virtual tip" that is later
         * added to a tip component in regular `priority` calculations.
         * It means that a `Normal` transaction can front-run a similarly-sized `Operational`
         * extrinsic (with no tip), by including a tip value greater than the virtual tip.
         *
         * ```rust,ignore
         * // For `Normal`
         * let priority = priority_calc(tip);
         *
         * // For `Operational`
         * let virtual_tip = (inclusion_fee + tip) * OperationalFeeMultiplier;
         * let priority = priority_calc(tip + virtual_tip);
         * ```
         *
         * Note that since we use `final_fee` the multiplier applies also to the regular `tip`
         * sent with the transaction. So, not only does the transaction get a priority bump based
         * on the `inclusion_fee`, but we also amplify the impact of tips applied to `Operational`
         * transactions.
         */
        OperationalFeeMultiplier: PlainDescriptor<number>;
    };
    CollatorSelection: {
        /**
         * Account Identifier from which the internal Pot is generated.
         */
        PotId: PlainDescriptor<SizedHex<8>>;
        /**
         * Maximum number of candidates that we should have.
         *
         * This does not take into account the invulnerables.
         */
        MaxCandidates: PlainDescriptor<number>;
        /**
         * Minimum number eligible collators. Should always be greater than zero. This includes
         * Invulnerable collators. This ensures that there will always be one collator who can
         * produce a block.
         */
        MinEligibleCollators: PlainDescriptor<number>;
        /**
         * Maximum number of invulnerables.
         */
        MaxInvulnerables: PlainDescriptor<number>;
        /**
        
         */
        KickThreshold: PlainDescriptor<number>;
        /**
         * Gets this pallet's derived pot account.
         */
        pot_account: PlainDescriptor<SS58String>;
    };
    Session: {
        /**
         * The amount to be held when setting keys.
         */
        KeyDeposit: PlainDescriptor<bigint>;
    };
    Aura: {
        /**
         * The slot duration Aura should run with, expressed in milliseconds.
         *
         * The effective value of this type can be changed with a runtime upgrade.
         *
         * For backwards compatibility either use [`MinimumPeriodTimesTwo`] or a const.
         */
        SlotDuration: PlainDescriptor<bigint>;
    };
    XcmpQueue: {
        /**
         * The maximum number of inbound XCMP channels that can be suspended simultaneously.
         *
         * Any further channel suspensions will fail and messages may get dropped without further
         * notice. Choosing a high value (1000) is okay; the trade-off that is described in
         * [`InboundXcmpSuspended`] still applies at that scale.
         */
        MaxInboundSuspended: PlainDescriptor<number>;
        /**
         * Maximal number of outbound XCMP channels that can have messages queued at the same time.
         *
         * If this is reached, then no further messages can be sent to channels that do not yet
         * have a message queued. This should be set to the expected maximum of outbound channels
         * which is determined by [`Self::ChannelInfo`]. It is important to set this large enough,
         * since otherwise the congestion control protocol will not work as intended and messages
         * may be dropped. This value increases the PoV and should therefore not be picked too
         * high. Governance needs to pay attention to not open more channels than this value.
         */
        MaxActiveOutboundChannels: PlainDescriptor<number>;
        /**
         * The maximal page size for HRMP message pages.
         *
         * A lower limit can be set dynamically, but this is the hard-limit for the PoV worst case
         * benchmarking. The limit for the size of a message is slightly below this, since some
         * overhead is incurred for encoding the format.
         */
        MaxPageSize: PlainDescriptor<number>;
    };
    PolkadotXcm: {
        /**
         * This chain's Universal Location.
         */
        UniversalLocation: PlainDescriptor<XcmV5Junctions>;
        /**
         * The latest supported version that we advertise. Generally just set it to
         * `pallet_xcm::CurrentXcmVersion`.
         */
        AdvertisedXcmVersion: PlainDescriptor<number>;
        /**
         * The maximum number of local XCM locks that a single account may have.
         */
        MaxLockers: PlainDescriptor<number>;
        /**
         * The maximum number of consumers a single remote lock may have.
         */
        MaxRemoteLockConsumers: PlainDescriptor<number>;
    };
    MessageQueue: {
        /**
         * The size of the page; this implies the maximum message size which can be sent.
         *
         * A good value depends on the expected message sizes, their weights, the weight that is
         * available for processing them and the maximal needed message size. The maximal message
         * size is slightly lower than this as defined by [`MaxMessageLenOf`].
         */
        HeapSize: PlainDescriptor<number>;
        /**
         * The maximum number of stale pages (i.e. of overweight messages) allowed before culling
         * can happen. Once there are more stale pages than this, then historical pages may be
         * dropped, even if they contain unprocessed overweight messages.
         */
        MaxStale: PlainDescriptor<number>;
        /**
         * The amount of weight (if any) which should be provided to the message queue for
         * servicing enqueued items `on_initialize`.
         *
         * This may be legitimately `None` in the case that you will call
         * `ServiceQueues::service_queues` manually or set [`Self::IdleMaxServiceWeight`] to have
         * it run in `on_idle`.
         */
        ServiceWeight: PlainDescriptor<Anonymize<Iasb8k6ash5mjn>>;
        /**
         * The maximum amount of weight (if any) to be used from remaining weight `on_idle` which
         * should be provided to the message queue for servicing enqueued items `on_idle`.
         * Useful for parachains to process messages at the same block they are received.
         *
         * If `None`, it will not call `ServiceQueues::service_queues` in `on_idle`.
         */
        IdleMaxServiceWeight: PlainDescriptor<Anonymize<Iasb8k6ash5mjn>>;
    };
    Utility: {
        /**
         * The limit on the number of batched calls.
         */
        batched_calls_limit: PlainDescriptor<number>;
    };
    Multisig: {
        /**
         * The base amount of currency needed to reserve for creating a multisig execution or to
         * store a dispatch call for later.
         *
         * This is held for an additional storage item whose value size is
         * `4 + sizeof((BlockNumber, Balance, AccountId))` bytes and whose key size is
         * `32 + sizeof(AccountId)` bytes.
         */
        DepositBase: PlainDescriptor<bigint>;
        /**
         * The amount of currency needed per unit threshold when creating a multisig execution.
         *
         * This is held for adding 32 bytes more into a pre-existing storage value.
         */
        DepositFactor: PlainDescriptor<bigint>;
        /**
         * The maximum amount of signatories allowed in the multisig.
         */
        MaxSignatories: PlainDescriptor<number>;
    };
    Proxy: {
        /**
         * The base amount of currency needed to reserve for creating a proxy.
         *
         * This is held for an additional storage item whose value size is
         * `sizeof(Balance)` bytes and whose key size is `sizeof(AccountId)` bytes.
         */
        ProxyDepositBase: PlainDescriptor<bigint>;
        /**
         * The amount of currency needed per proxy added.
         *
         * This is held for adding 32 bytes plus an instance of `ProxyType` more into a
         * pre-existing storage value. Thus, when configuring `ProxyDepositFactor` one should take
         * into account `32 + proxy_type.encode().len()` bytes of data.
         */
        ProxyDepositFactor: PlainDescriptor<bigint>;
        /**
         * The maximum amount of proxies allowed for a single account.
         */
        MaxProxies: PlainDescriptor<number>;
        /**
         * The maximum amount of time-delayed announcements that are allowed to be pending.
         */
        MaxPending: PlainDescriptor<number>;
        /**
         * The base amount of currency needed to reserve for creating an announcement.
         *
         * This is held when a new storage item holding a `Balance` is created (typically 16
         * bytes).
         */
        AnnouncementDepositBase: PlainDescriptor<bigint>;
        /**
         * The amount of currency needed per announcement made.
         *
         * This is held for adding an `AccountId`, `Hash` and `BlockNumber` (typically 68 bytes)
         * into a pre-existing storage value.
         */
        AnnouncementDepositFactor: PlainDescriptor<bigint>;
    };
    Scheduler: {
        /**
         * The maximum weight that may be scheduled per block for any dispatchables.
         */
        MaximumWeight: PlainDescriptor<Anonymize<I4q39t5hn830vp>>;
        /**
         * The maximum number of scheduled calls in the queue for a single block.
         *
         * NOTE:
         * + Dependent pallets' benchmarks might require a higher limit for the setting. Set a
         * higher limit under `runtime-benchmarks` feature.
         */
        MaxScheduledPerBlock: PlainDescriptor<number>;
    };
    Alliance: {
        /**
         * The maximum number of the unscrupulous items supported by the pallet.
         */
        MaxUnscrupulousItems: PlainDescriptor<number>;
        /**
         * The maximum length of a website URL.
         */
        MaxWebsiteUrlLength: PlainDescriptor<number>;
        /**
         * The deposit required for submitting candidacy.
         */
        AllyDeposit: PlainDescriptor<bigint>;
        /**
         * The maximum number of announcements.
         */
        MaxAnnouncementsCount: PlainDescriptor<number>;
        /**
         * The maximum number of members per member role.
         */
        MaxMembersCount: PlainDescriptor<number>;
    };
    AllianceMotion: {
        /**
         * The maximum weight of a dispatch call that can be proposed and executed.
         */
        MaxProposalWeight: PlainDescriptor<Anonymize<I4q39t5hn830vp>>;
    };
    FellowshipReferenda: {
        /**
         * The minimum amount to be used as a deposit for a public referendum proposal.
         */
        SubmissionDeposit: PlainDescriptor<bigint>;
        /**
         * Maximum size of the referendum queue for a single track.
         */
        MaxQueued: PlainDescriptor<number>;
        /**
         * The number of blocks after submission that a referendum must begin being decided by.
         * Once this passes, then anyone may cancel the referendum.
         */
        UndecidingTimeout: PlainDescriptor<number>;
        /**
         * Quantization level for the referendum wakeup scheduler. A higher number will result in
         * fewer storage reads/writes needed for smaller voters, but also result in delays to the
         * automatic referendum status changes. Explicit servicing instructions are unaffected.
         */
        AlarmInterval: PlainDescriptor<number>;
        /**
         * A list of tracks.
         *
         * Note: if the tracks are dynamic, the value in the static metadata might be inaccurate.
         */
        Tracks: PlainDescriptor<Anonymize<Ibafpkl9hhno69>>;
    };
    FellowshipCore: {
        /**
         * The maximum size in bytes submitted evidence is allowed to be.
         */
        EvidenceSize: PlainDescriptor<number>;
        /**
         * Represents the highest possible rank in this pallet.
         *
         * Increasing this value is supported, but decreasing it may lead to a broken state.
         */
        MaxRank: PlainDescriptor<number>;
    };
    FellowshipSalary: {
        /**
         * The number of blocks within a cycle which accounts have to register their intent to
         * claim.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `PayoutPeriod`.
         */
        RegistrationPeriod: PlainDescriptor<number>;
        /**
         * The number of blocks within a cycle which accounts have to claim the payout.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `RegistrationPeriod`.
         */
        PayoutPeriod: PlainDescriptor<number>;
        /**
         * The total budget per cycle.
         *
         * This may change over the course of a cycle without any problem.
         */
        Budget: PlainDescriptor<bigint>;
    };
    FellowshipTreasury: {
        /**
         * Period between successive spends.
         */
        SpendPeriod: PlainDescriptor<number>;
        /**
         * Percentage of spare funds (if any) that are burnt per spend period.
         */
        Burn: PlainDescriptor<number>;
        /**
         * The treasury's pallet id, used for deriving its sovereign account ID.
         */
        PalletId: PlainDescriptor<SizedHex<8>>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * The maximum number of approvals that can wait in the spending queue.
         *
         * NOTE: This parameter is also used within the Bounties Pallet extension if enabled.
         */
        MaxApprovals: PlainDescriptor<number>;
        /**
         * The period during which an approved treasury spend has to be claimed.
         */
        PayoutPeriod: PlainDescriptor<number>;
        /**
         * Gets this pallet's derived pot account.
         */
        pot_account: PlainDescriptor<SS58String>;
    };
    AmbassadorReferenda: {
        /**
         * The minimum amount to be used as a deposit for a public referendum proposal.
         */
        SubmissionDeposit: PlainDescriptor<bigint>;
        /**
         * Maximum size of the referendum queue for a single track.
         */
        MaxQueued: PlainDescriptor<number>;
        /**
         * The number of blocks after submission that a referendum must begin being decided by.
         * Once this passes, then anyone may cancel the referendum.
         */
        UndecidingTimeout: PlainDescriptor<number>;
        /**
         * Quantization level for the referendum wakeup scheduler. A higher number will result in
         * fewer storage reads/writes needed for smaller voters, but also result in delays to the
         * automatic referendum status changes. Explicit servicing instructions are unaffected.
         */
        AlarmInterval: PlainDescriptor<number>;
        /**
         * A list of tracks.
         *
         * Note: if the tracks are dynamic, the value in the static metadata might be inaccurate.
         */
        Tracks: PlainDescriptor<Anonymize<Ibafpkl9hhno69>>;
    };
    AmbassadorCore: {
        /**
         * The maximum size in bytes submitted evidence is allowed to be.
         */
        EvidenceSize: PlainDescriptor<number>;
        /**
         * Represents the highest possible rank in this pallet.
         *
         * Increasing this value is supported, but decreasing it may lead to a broken state.
         */
        MaxRank: PlainDescriptor<number>;
    };
    AmbassadorSalary: {
        /**
         * The number of blocks within a cycle which accounts have to register their intent to
         * claim.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `PayoutPeriod`.
         */
        RegistrationPeriod: PlainDescriptor<number>;
        /**
         * The number of blocks within a cycle which accounts have to claim the payout.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `RegistrationPeriod`.
         */
        PayoutPeriod: PlainDescriptor<number>;
        /**
         * The total budget per cycle.
         *
         * This may change over the course of a cycle without any problem.
         */
        Budget: PlainDescriptor<bigint>;
    };
    AmbassadorTreasury: {
        /**
         * Period between successive spends.
         */
        SpendPeriod: PlainDescriptor<number>;
        /**
         * Percentage of spare funds (if any) that are burnt per spend period.
         */
        Burn: PlainDescriptor<number>;
        /**
         * The treasury's pallet id, used for deriving its sovereign account ID.
         */
        PalletId: PlainDescriptor<SizedHex<8>>;
        /**
         * DEPRECATED: associated with `spend_local` call and will be removed in May 2025.
         * Refer to <https://github.com/paritytech/polkadot-sdk/pull/5961> for migration to `spend`.
         *
         * The maximum number of approvals that can wait in the spending queue.
         *
         * NOTE: This parameter is also used within the Bounties Pallet extension if enabled.
         */
        MaxApprovals: PlainDescriptor<number>;
        /**
         * The period during which an approved treasury spend has to be claimed.
         */
        PayoutPeriod: PlainDescriptor<number>;
        /**
         * Gets this pallet's derived pot account.
         */
        pot_account: PlainDescriptor<SS58String>;
    };
    SecretarySalary: {
        /**
         * The number of blocks within a cycle which accounts have to register their intent to
         * claim.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `PayoutPeriod`.
         */
        RegistrationPeriod: PlainDescriptor<number>;
        /**
         * The number of blocks within a cycle which accounts have to claim the payout.
         *
         * The number of blocks between sequential payout cycles is the sum of this and
         * `RegistrationPeriod`.
         */
        PayoutPeriod: PlainDescriptor<number>;
        /**
         * The total budget per cycle.
         *
         * This may change over the course of a cycle without any problem.
         */
        Budget: PlainDescriptor<bigint>;
    };
};
type IViewFns = {
    Proxy: {
        /**
         * Check if a `RuntimeCall` is allowed for a given `ProxyType`.
         */
        check_permissions: RuntimeDescriptor<[call: Anonymize<I7amu2774tu62e>, proxy_type: Anonymize<Ibgsn3hr1i3gjh>], boolean>;
        /**
         * Check if one `ProxyType` is a subset of another `ProxyType`.
         */
        is_superset: RuntimeDescriptor<[to_check: Anonymize<Ibgsn3hr1i3gjh>, against: Anonymize<Ibgsn3hr1i3gjh>], boolean>;
    };
};
type IRuntimeCalls = {
    /**
     * API necessary for block authorship with aura.
     */
    AuraApi: {
        /**
         * Returns the slot duration for Aura.
         *
         * Currently, only the value provided by this type at genesis will be used.
         */
        slot_duration: RuntimeDescriptor<[], bigint>;
        /**
         * Return the current set of authorities.
         */
        authorities: RuntimeDescriptor<[], Anonymize<Ic5m5lp1oioo8r>>;
    };
    /**
     * API to tell the node side how the relay parent should be chosen.
     *
     * A larger offset indicates that the relay parent should not be the tip of the relay chain,
     * but `N` blocks behind the tip. This offset is then enforced by the runtime.
     */
    RelayParentOffsetApi: {
        /**
         * Fetch the slot offset that is expected from the relay chain.
         */
        relay_parent_offset: RuntimeDescriptor<[], number>;
    };
    /**
     * This runtime API is used to inform potential block authors whether they will
     * have the right to author at a slot, assuming they have claimed the slot.
     *
     * In particular, this API allows Aura-based parachains to regulate their "unincluded segment",
     * which is the section of the head of the chain which has not yet been made available in the
     * relay chain.
     *
     * When the unincluded segment is short, Aura chains will allow authors to create multiple
     * blocks per slot in order to build a backlog. When it is saturated, this API will limit
     * the amount of blocks that can be created.
     *
     * Changes:
     * - Version 2: Update to `can_build_upon` to take a relay chain `Slot` instead of a parachain `Slot`.
     */
    AuraUnincludedSegmentApi: {
        /**
         * Whether it is legal to extend the chain, assuming the given block is the most
         * recently included one as-of the relay parent that will be built against, and
         * the given relay chain slot.
         *
         * This should be consistent with the logic the runtime uses when validating blocks to
         * avoid issues.
         *
         * When the unincluded segment is empty, i.e. `included_hash == at`, where at is the block
         * whose state we are querying against, this must always return `true` as long as the slot
         * is more recent than the included block itself.
         */
        can_build_upon: RuntimeDescriptor<[included_hash: SizedHex<32>, slot: bigint], boolean>;
    };
    /**
     * The `Core` runtime api that every Substrate runtime needs to implement.
     */
    Core: {
        /**
         * Returns the version of the runtime.
         */
        version: RuntimeDescriptor<[], Anonymize<I4fo08joqmcqnm>>;
        /**
         * Execute the given block.
         */
        execute_block: RuntimeDescriptor<[block: Anonymize<Iaqet9jc3ihboe>], undefined>;
        /**
         * Initialize a block with the given header and return the runtime executive mode.
         */
        initialize_block: RuntimeDescriptor<[header: Anonymize<Ic952bubvq4k7d>], Anonymize<I2v50gu3s1aqk6>>;
    };
    /**
     * The `Metadata` api trait that returns metadata for the runtime.
     */
    Metadata: {
        /**
         * Returns the metadata of a runtime.
         */
        metadata: RuntimeDescriptor<[], Uint8Array>;
        /**
         * Returns the metadata at a given version.
         *
         * If the given `version` isn't supported, this will return `None`.
         * Use [`Self::metadata_versions`] to find out about supported metadata version of the runtime.
         */
        metadata_at_version: RuntimeDescriptor<[version: number], Anonymize<Iabpgqcjikia83>>;
        /**
         * Returns the supported metadata versions.
         *
         * This can be used to call `metadata_at_version`.
         */
        metadata_versions: RuntimeDescriptor<[], Anonymize<Icgljjb6j82uhn>>;
    };
    /**
     * The `BlockBuilder` api trait that provides the required functionality for building a block.
     */
    BlockBuilder: {
        /**
         * Apply the given extrinsic.
         *
         * Returns an inclusion outcome which specifies if this extrinsic is included in
         * this block or not.
         */
        apply_extrinsic: RuntimeDescriptor<[extrinsic: Uint8Array], Anonymize<Ibkog8f7nenpg4>>;
        /**
         * Finish the current block.
         */
        finalize_block: RuntimeDescriptor<[], Anonymize<Ic952bubvq4k7d>>;
        /**
         * Generate inherent extrinsics. The inherent data will vary from chain to chain.
         */
        inherent_extrinsics: RuntimeDescriptor<[inherent: Anonymize<If7uv525tdvv7a>], Anonymize<Itom7fk49o0c9>>;
        /**
         * Check that the inherents are valid. The inherent data will vary from chain to chain.
         */
        check_inherents: RuntimeDescriptor<[block: Anonymize<Iaqet9jc3ihboe>, data: Anonymize<If7uv525tdvv7a>], Anonymize<I2an1fs2eiebjp>>;
    };
    /**
     * The `TaggedTransactionQueue` api trait for interfering with the transaction queue.
     */
    TaggedTransactionQueue: {
        /**
         * Validate the transaction.
         *
         * This method is invoked by the transaction pool to learn details about given transaction.
         * The implementation should make sure to verify the correctness of the transaction
         * against current state. The given `block_hash` corresponds to the hash of the block
         * that is used as current state.
         *
         * Note that this call may be performed by the pool multiple times and transactions
         * might be verified in any possible order.
         */
        validate_transaction: RuntimeDescriptor<[source: TransactionValidityTransactionSource, tx: Uint8Array, block_hash: SizedHex<32>], Anonymize<I9ask1o4tfvcvs>>;
    };
    /**
     * The offchain worker api.
     */
    OffchainWorkerApi: {
        /**
         * Starts the off-chain task for given block header.
         */
        offchain_worker: RuntimeDescriptor<[header: Anonymize<Ic952bubvq4k7d>], undefined>;
    };
    /**
     * Session keys runtime api.
     */
    SessionKeys: {
        /**
         * Generate a set of session keys with optionally using the given seed.
         * The keys should be stored within the keystore exposed via runtime
         * externalities.
         *
         * The seed needs to be a valid `utf8` string.
         *
         * Returns the concatenated SCALE encoded public keys.
         */
        generate_session_keys: RuntimeDescriptor<[owner: Uint8Array, seed: Anonymize<Iabpgqcjikia83>], Anonymize<I4ph3d1eepnmr1>>;
        /**
         * Decode the given public session keys.
         *
         * Returns the list of public raw public keys + key type.
         */
        decode_session_keys: RuntimeDescriptor<[encoded: Uint8Array], Anonymize<Icerf8h8pdu8ss>>;
    };
    /**
     * Runtime API for executing view functions
     */
    RuntimeViewFunction: {
        /**
         * Execute a view function query.
         */
        execute_view_function: RuntimeDescriptor<[query_id: Anonymize<I4gil44d08grh>, input: Uint8Array], Anonymize<I7u915mvkdsb08>>;
    };
    /**
     * The API to query account nonce.
     */
    AccountNonceApi: {
        /**
         * Get current account nonce of given `AccountId`.
         */
        account_nonce: RuntimeDescriptor<[account: SS58String], number>;
    };
    /**
    
     */
    TransactionPaymentApi: {
        /**
        
         */
        query_info: RuntimeDescriptor<[uxt: Uint8Array, len: number], Anonymize<I6spmpef2c7svf>>;
        /**
        
         */
        query_fee_details: RuntimeDescriptor<[uxt: Uint8Array, len: number], Anonymize<Iei2mvq0mjvt81>>;
        /**
        
         */
        query_weight_to_fee: RuntimeDescriptor<[weight: Anonymize<I4q39t5hn830vp>], bigint>;
        /**
        
         */
        query_length_to_fee: RuntimeDescriptor<[length: number], bigint>;
    };
    /**
    
     */
    TransactionPaymentCallApi: {
        /**
         * Query information of a dispatch class, weight, and fee of a given encoded `Call`.
         */
        query_call_info: RuntimeDescriptor<[call: Anonymize<I7amu2774tu62e>, len: number], Anonymize<I6spmpef2c7svf>>;
        /**
         * Query fee details of a given encoded `Call`.
         */
        query_call_fee_details: RuntimeDescriptor<[call: Anonymize<I7amu2774tu62e>, len: number], Anonymize<Iei2mvq0mjvt81>>;
        /**
         * Query the output of the current `WeightToFee` given some input.
         */
        query_weight_to_fee: RuntimeDescriptor<[weight: Anonymize<I4q39t5hn830vp>], bigint>;
        /**
         * Query the output of the current `LengthToFee` given some input.
         */
        query_length_to_fee: RuntimeDescriptor<[length: number], bigint>;
    };
    /**
     * A trait of XCM payment API.
     *
     * API provides functionality for obtaining:
     *
     * * the weight required to execute an XCM message,
     * * a list of acceptable `AssetId`s for message execution payment,
     * * the cost of the weight in the specified acceptable `AssetId`.
     * * the fees for an XCM message delivery.
     *
     * To determine the execution weight of the calls required for
     * [`xcm::latest::Instruction::Transact`] instruction, `TransactionPaymentCallApi` can be used.
     */
    XcmPaymentApi: {
        /**
         * Returns a list of acceptable payment assets.
         *
         * # Arguments
         *
         * * `xcm_version`: Version.
         */
        query_acceptable_payment_assets: RuntimeDescriptor<[xcm_version: number], Anonymize<Iftvbctbo05fu4>>;
        /**
         * Returns a weight needed to execute a XCM.
         *
         * # Arguments
         *
         * * `message`: `VersionedXcm`.
         */
        query_xcm_weight: RuntimeDescriptor<[message: XcmVersionedXcm], Anonymize<Ic0c3req3mlc1l>>;
        /**
         * Converts a weight into a fee for the specified `AssetId`.
         *
         * # Arguments
         *
         * * `weight`: convertible `Weight`.
         * * `asset`: `VersionedAssetId`.
         */
        query_weight_to_asset_fee: RuntimeDescriptor<[weight: Anonymize<I4q39t5hn830vp>, asset: XcmVersionedAssetId], Anonymize<I7ocn4njqde3v5>>;
        /**
         * Query delivery fees V2.
         *
         * Get delivery fees for sending a specific `message` to a `destination`.
         * These always come in a specific asset, defined by the chain.
         *
         * # Arguments
         * * `message`: The message that'll be sent, necessary because most delivery fees are based on the
         * size of the message.
         * * `destination`: The destination to send the message to. Different destinations may use
         * different senders that charge different fees.
         */
        query_delivery_fees: RuntimeDescriptor<[destination: XcmVersionedLocation, message: XcmVersionedXcm, asset_id: XcmVersionedAssetId], Anonymize<Iek7ha36da9mf5>>;
    };
    /**
     * API for dry-running extrinsics and XCM programs to get the programs that need to be passed to the fees API.
     *
     * All calls return a vector of tuples (location, xcm) where each "xcm" is executed in "location".
     * If there's local execution, the location will be "Here".
     * This vector can be used to calculate both execution and delivery fees.
     *
     * Calls or XCMs might fail when executed, this doesn't mean the result of these calls will be an `Err`.
     * In those cases, there might still be a valid result, with the execution error inside it.
     * The only reasons why these calls might return an error are listed in the [`Error`] enum.
     */
    DryRunApi: {
        /**
         * Dry run call V2.
         */
        dry_run_call: RuntimeDescriptor<[origin: Anonymize<I7rsllqn1av13r>, call: Anonymize<I7amu2774tu62e>, result_xcms_version: number], Anonymize<Iarfsrg84usklg>>;
        /**
         * Dry run XCM program
         */
        dry_run_xcm: RuntimeDescriptor<[origin_location: XcmVersionedLocation, xcm: XcmVersionedXcm], Anonymize<Ib9kvfbnra4spu>>;
    };
    /**
     * API for useful conversions between XCM `Location` and `AccountId`.
     */
    LocationToAccountApi: {
        /**
         * Converts `Location` to `AccountId`.
         */
        convert_location: RuntimeDescriptor<[location: XcmVersionedLocation], Anonymize<Ieh6nis3hdbtgi>>;
    };
    /**
     * API for querying trusted reserves and trusted teleporters.
     */
    TrustedQueryApi: {
        /**
         * Returns if the location is a trusted reserve for the asset.
         *
         * # Arguments
         * * `asset`: `VersionedAsset`.
         * * `location`: `VersionedLocation`.
         */
        is_trusted_reserve: RuntimeDescriptor<[asset: XcmVersionedAsset, location: XcmVersionedLocation], Anonymize<Icujp6hmv35vbn>>;
        /**
         * Returns if the asset can be teleported to the location.
         *
         * # Arguments
         * * `asset`: `VersionedAsset`.
         * * `location`: `VersionedLocation`.
         */
        is_trusted_teleporter: RuntimeDescriptor<[asset: XcmVersionedAsset, location: XcmVersionedLocation], Anonymize<Icujp6hmv35vbn>>;
    };
    /**
     * API for querying XCM authorized aliases
     */
    AuthorizedAliasersApi: {
        /**
         * Returns locations allowed to alias into and act as `target`.
         */
        authorized_aliasers: RuntimeDescriptor<[target: XcmVersionedLocation], Anonymize<I4tjame31218k9>>;
        /**
         * Returns whether `origin` is allowed to alias into and act as `target`.
         */
        is_authorized_alias: RuntimeDescriptor<[origin: XcmVersionedLocation, target: XcmVersionedLocation], Anonymize<I5gif8vomct5i8>>;
    };
    /**
     * Runtime api to collect information about a collation.
     *
     * Version history:
     * - Version 2: Changed [`Self::collect_collation_info`] signature
     * - Version 3: Signals to the node to use version 1 of [`ParachainBlockData`].
     */
    CollectCollationInfo: {
        /**
         * Collect information about a collation.
         *
         * The given `header` is the header of the built block for that
         * we are collecting the collation info for.
         */
        collect_collation_info: RuntimeDescriptor<[header: Anonymize<Ic952bubvq4k7d>], Anonymize<Ic1d4u2opv3fst>>;
    };
    /**
     * API to interact with `RuntimeGenesisConfig` for the runtime
     */
    GenesisBuilder: {
        /**
         * Build `RuntimeGenesisConfig` from a JSON blob not using any defaults and store it in the
         * storage.
         *
         * In the case of a FRAME-based runtime, this function deserializes the full
         * `RuntimeGenesisConfig` from the given JSON blob and puts it into the storage. If the
         * provided JSON blob is incorrect or incomplete or the deserialization fails, an error
         * is returned.
         *
         * Please note that provided JSON blob must contain all `RuntimeGenesisConfig` fields, no
         * defaults will be used.
         */
        build_state: RuntimeDescriptor<[json: Uint8Array], Anonymize<Ie9sr1iqcg3cgm>>;
        /**
         * Returns a JSON blob representation of the built-in `RuntimeGenesisConfig` identified by
         * `id`.
         *
         * If `id` is `None` the function should return JSON blob representation of the default
         * `RuntimeGenesisConfig` struct of the runtime. Implementation must provide default
         * `RuntimeGenesisConfig`.
         *
         * Otherwise function returns a JSON representation of the built-in, named
         * `RuntimeGenesisConfig` preset identified by `id`, or `None` if such preset does not
         * exist. Returned `Vec<u8>` contains bytes of JSON blob (patch) which comprises a list of
         * (potentially nested) key-value pairs that are intended for customizing the default
         * runtime genesis config. The patch shall be merged (rfc7386) with the JSON representation
         * of the default `RuntimeGenesisConfig` to create a comprehensive genesis config that can
         * be used in `build_state` method.
         */
        get_preset: RuntimeDescriptor<[id: Anonymize<I1mqgk2tmnn9i2>], Anonymize<Iabpgqcjikia83>>;
        /**
         * Returns a list of identifiers for available builtin `RuntimeGenesisConfig` presets.
         *
         * The presets from the list can be queried with [`GenesisBuilder::get_preset`] method. If
         * no named presets are provided by the runtime the list is empty.
         */
        preset_names: RuntimeDescriptor<[], Anonymize<I6lr8sctk0bi4e>>;
    };
    /**
     * Runtime api used to access general info about a parachain runtime.
     */
    GetParachainInfo: {
        /**
         * Retrieve the parachain id used for runtime.
         */
        parachain_id: RuntimeDescriptor<[], number>;
    };
};
export type Dot_colDispatchError = Anonymize<Isk3k9e5dj7oh>;
type IAsset = PlainDescriptor<void>;
export type Dot_colExtensions = {};
type PalletsTypedef = {
    __storage: IStorage;
    __tx: ICalls;
    __event: IEvent;
    __error: IError;
    __const: IConstants;
    __view: IViewFns;
};
export type Dot_col = {
    descriptors: {
        pallets: PalletsTypedef;
        apis: IRuntimeCalls;
    } & Promise<any>;
    metadataTypes: Promise<Uint8Array>;
    asset: IAsset;
    extensions: Dot_colExtensions;
    getMetadata: () => Promise<Uint8Array>;
    genesis: string | undefined;
};
declare const _allDescriptors: Dot_col;
export default _allDescriptors;
export type Dot_colApis = ApisFromDef<IRuntimeCalls>;
export type Dot_colQueries = QueryFromPalletsDef<PalletsTypedef>;
export type Dot_colCalls = TxFromPalletsDef<PalletsTypedef>;
export type Dot_colEvents = EventsFromPalletsDef<PalletsTypedef>;
export type Dot_colErrors = ErrorsFromPalletsDef<PalletsTypedef>;
export type Dot_colConstants = ConstFromPalletsDef<PalletsTypedef>;
export type Dot_colViewFns = ViewFnsFromPalletsDef<PalletsTypedef>;
export type Dot_colCallData = Anonymize<I7amu2774tu62e> & {
    value: {
        type: string;
    };
};
type AllInteractions = {
    storage: {
        System: ['Account', 'ExtrinsicCount', 'InherentsApplied', 'BlockWeight', 'BlockSize', 'BlockHash', 'ExtrinsicData', 'Number', 'ParentHash', 'Digest', 'Events', 'EventCount', 'EventTopics', 'LastRuntimeUpgrade', 'BlocksTillUpgrade', 'UpgradedToU32RefCount', 'UpgradedToTripleRefCount', 'ExecutionPhase', 'AuthorizedUpgrade', 'ExtrinsicWeightReclaimed'];
        ParachainSystem: ['BlockWeightMode', 'PreviousCoreCount', 'UnincludedSegment', 'AggregatedUnincludedSegment', 'PendingValidationCode', 'NewValidationCode', 'ValidationData', 'DidSetValidationCode', 'LastRelayChainBlockNumber', 'UpgradeRestrictionSignal', 'UpgradeGoAhead', 'RelayStateProof', 'RelevantMessagingState', 'HostConfiguration', 'LastDmqMqcHead', 'LastHrmpMqcHeads', 'ProcessedDownwardMessages', 'LastProcessedDownwardMessage', 'HrmpWatermark', 'LastProcessedHrmpMessage', 'HrmpOutboundMessages', 'UpwardMessages', 'PendingUpwardMessages', 'PendingUpwardSignals', 'UpwardDeliveryFeeFactor', 'AnnouncedHrmpMessagesPerCandidate', 'ReservedXcmpWeightOverride', 'ReservedDmpWeightOverride', 'CustomValidationHeadData', 'PoVMessagesTracker'];
        Timestamp: ['Now', 'DidUpdate'];
        ParachainInfo: ['ParachainId'];
        Balances: ['TotalIssuance', 'InactiveIssuance', 'Account', 'Locks', 'Reserves', 'Holds', 'Freezes'];
        TransactionPayment: ['NextFeeMultiplier', 'StorageVersion', 'TxPaymentCredit'];
        Authorship: ['Author'];
        CollatorSelection: ['Invulnerables', 'CandidateList', 'LastAuthoredBlock', 'DesiredCandidates', 'CandidacyBond'];
        Session: ['Validators', 'CurrentIndex', 'QueuedChanged', 'QueuedKeys', 'DisabledValidators', 'NextKeys', 'KeyOwner', 'ExternallySetKeys'];
        Aura: ['Authorities', 'CurrentSlot'];
        AuraExt: ['Authorities', 'RelaySlotInfo'];
        XcmpQueue: ['InboundXcmpSuspended', 'OutboundXcmpStatus', 'OutboundXcmpMessages', 'SignalMessages', 'QueueConfig', 'QueueSuspended', 'DeliveryFeeFactor'];
        PolkadotXcm: ['QueryCounter', 'Queries', 'AssetTraps', 'SafeXcmVersion', 'SupportedVersion', 'VersionNotifiers', 'VersionNotifyTargets', 'VersionDiscoveryQueue', 'CurrentMigration', 'RemoteLockedFungibles', 'LockedFungibles', 'XcmExecutionSuspended', 'ShouldRecordXcm', 'RecordedXcm', 'AuthorizedAliases'];
        MessageQueue: ['BookStateFor', 'ServiceHead', 'Pages'];
        Multisig: ['Multisigs'];
        Proxy: ['Proxies', 'Announcements'];
        Preimage: ['StatusFor', 'RequestStatusFor', 'PreimageFor'];
        Scheduler: ['IncompleteSince', 'Agenda', 'Retries', 'Lookup'];
        AssetRate: ['ConversionRateToNative'];
        Alliance: ['Rule', 'Announcements', 'DepositOf', 'Members', 'RetiringMembers', 'UnscrupulousAccounts', 'UnscrupulousWebsites'];
        AllianceMotion: ['Proposals', 'ProposalOf', 'CostOf', 'Voting', 'ProposalCount', 'Members', 'Prime'];
        FellowshipCollective: ['MemberCount', 'Members', 'IdToIndex', 'IndexToId', 'Voting', 'VotingCleanup'];
        FellowshipReferenda: ['ReferendumCount', 'ReferendumInfoFor', 'TrackQueue', 'DecidingCount', 'MetadataOf'];
        FellowshipCore: ['Params', 'Member', 'MemberEvidence'];
        FellowshipSalary: ['Status', 'Claimant'];
        FellowshipTreasury: ['ProposalCount', 'Proposals', 'Deactivated', 'Approvals', 'SpendCount', 'Spends', 'LastSpendPeriod'];
        AmbassadorCollective: ['MemberCount', 'Members', 'IdToIndex', 'IndexToId', 'Voting', 'VotingCleanup'];
        AmbassadorReferenda: ['ReferendumCount', 'ReferendumInfoFor', 'TrackQueue', 'DecidingCount', 'MetadataOf'];
        AmbassadorCore: ['Params', 'Member', 'MemberEvidence'];
        AmbassadorSalary: ['Status', 'Claimant'];
        AmbassadorTreasury: ['ProposalCount', 'Proposals', 'Deactivated', 'Approvals', 'SpendCount', 'Spends', 'LastSpendPeriod'];
        SecretaryCollective: ['MemberCount', 'Members', 'IdToIndex', 'IndexToId', 'Voting', 'VotingCleanup'];
        SecretarySalary: ['Status', 'Claimant'];
    };
    tx: {
        System: ['remark', 'set_heap_pages', 'set_code', 'set_code_without_checks', 'set_storage', 'kill_storage', 'kill_prefix', 'remark_with_event', 'authorize_upgrade', 'authorize_upgrade_without_checks', 'apply_authorized_upgrade'];
        ParachainSystem: ['set_validation_data', 'sudo_send_upward_message'];
        Timestamp: ['set'];
        Balances: ['transfer_allow_death', 'force_transfer', 'transfer_keep_alive', 'transfer_all', 'force_unreserve', 'upgrade_accounts', 'force_set_balance', 'force_adjust_total_issuance', 'burn'];
        CollatorSelection: ['set_invulnerables', 'set_desired_candidates', 'set_candidacy_bond', 'register_as_candidate', 'leave_intent', 'add_invulnerable', 'remove_invulnerable', 'update_bond', 'take_candidate_slot'];
        Session: ['set_keys', 'purge_keys'];
        XcmpQueue: ['suspend_xcm_execution', 'resume_xcm_execution', 'update_suspend_threshold', 'update_drop_threshold', 'update_resume_threshold'];
        PolkadotXcm: ['send', 'teleport_assets', 'reserve_transfer_assets', 'execute', 'force_xcm_version', 'force_default_xcm_version', 'force_subscribe_version_notify', 'force_unsubscribe_version_notify', 'limited_reserve_transfer_assets', 'limited_teleport_assets', 'force_suspension', 'transfer_assets', 'claim_assets', 'transfer_assets_using_type_and_then', 'add_authorized_alias', 'remove_authorized_alias', 'remove_all_authorized_aliases'];
        MessageQueue: ['reap_page', 'execute_overweight'];
        Utility: ['batch', 'as_derivative', 'batch_all', 'dispatch_as', 'force_batch', 'with_weight', 'if_else', 'dispatch_as_fallible'];
        Multisig: ['as_multi_threshold_1', 'as_multi', 'approve_as_multi', 'cancel_as_multi', 'poke_deposit'];
        Proxy: ['proxy', 'add_proxy', 'remove_proxy', 'remove_proxies', 'create_pure', 'kill_pure', 'announce', 'remove_announcement', 'reject_announcement', 'proxy_announced', 'poke_deposit'];
        Preimage: ['note_preimage', 'unnote_preimage', 'request_preimage', 'unrequest_preimage', 'ensure_updated'];
        Scheduler: ['schedule', 'cancel', 'schedule_named', 'cancel_named', 'schedule_after', 'schedule_named_after', 'set_retry', 'set_retry_named', 'cancel_retry', 'cancel_retry_named'];
        AssetRate: ['create', 'update', 'remove'];
        Alliance: ['propose', 'vote', 'init_members', 'disband', 'set_rule', 'announce', 'remove_announcement', 'join_alliance', 'nominate_ally', 'elevate_ally', 'give_retirement_notice', 'retire', 'kick_member', 'add_unscrupulous_items', 'remove_unscrupulous_items', 'close', 'abdicate_fellow_status'];
        AllianceMotion: ['set_members', 'execute', 'propose', 'vote', 'disapprove_proposal', 'close', 'kill', 'release_proposal_cost'];
        FellowshipCollective: ['add_member', 'promote_member', 'demote_member', 'remove_member', 'vote', 'cleanup_poll', 'exchange_member'];
        FellowshipReferenda: ['submit', 'place_decision_deposit', 'refund_decision_deposit', 'cancel', 'kill', 'nudge_referendum', 'one_fewer_deciding', 'refund_submission_deposit', 'set_metadata'];
        FellowshipCore: ['bump', 'set_params', 'set_active', 'approve', 'induct', 'promote', 'promote_fast', 'offboard', 'submit_evidence', 'import', 'import_member', 'set_partial_params'];
        FellowshipSalary: ['init', 'bump', 'induct', 'register', 'payout', 'payout_other', 'check_payment'];
        FellowshipTreasury: ['spend_local', 'remove_approval', 'spend', 'payout', 'check_status', 'void_spend'];
        AmbassadorCollective: ['add_member', 'promote_member', 'demote_member', 'remove_member', 'vote', 'cleanup_poll', 'exchange_member'];
        AmbassadorReferenda: ['submit', 'place_decision_deposit', 'refund_decision_deposit', 'cancel', 'kill', 'nudge_referendum', 'one_fewer_deciding', 'refund_submission_deposit', 'set_metadata'];
        AmbassadorCore: ['bump', 'set_params', 'set_active', 'approve', 'induct', 'promote', 'promote_fast', 'offboard', 'submit_evidence', 'import', 'import_member', 'set_partial_params'];
        AmbassadorSalary: ['init', 'bump', 'induct', 'register', 'payout', 'payout_other', 'check_payment'];
        AmbassadorTreasury: ['spend_local', 'remove_approval', 'spend', 'payout', 'check_status', 'void_spend'];
        SecretaryCollective: ['add_member', 'promote_member', 'demote_member', 'remove_member', 'vote', 'cleanup_poll', 'exchange_member'];
        SecretarySalary: ['init', 'bump', 'induct', 'register', 'payout', 'payout_other', 'check_payment'];
    };
    events: {
        System: ['ExtrinsicSuccess', 'ExtrinsicFailed', 'CodeUpdated', 'NewAccount', 'KilledAccount', 'Remarked', 'UpgradeAuthorized', 'RejectedInvalidAuthorizedUpgrade'];
        ParachainSystem: ['ValidationFunctionStored', 'ValidationFunctionApplied', 'ValidationFunctionDiscarded', 'DownwardMessagesReceived', 'DownwardMessagesProcessed', 'UpwardMessageSent'];
        Balances: ['Endowed', 'DustLost', 'Transfer', 'BalanceSet', 'Reserved', 'Unreserved', 'ReserveRepatriated', 'Deposit', 'Withdraw', 'Slashed', 'Minted', 'MintedCredit', 'Burned', 'BurnedDebt', 'Suspended', 'Restored', 'Upgraded', 'Issued', 'Rescinded', 'Locked', 'Unlocked', 'Frozen', 'Thawed', 'TotalIssuanceForced', 'Held', 'BurnedHeld', 'TransferOnHold', 'TransferAndHold', 'Released', 'Unexpected'];
        TransactionPayment: ['TransactionFeePaid'];
        CollatorSelection: ['NewInvulnerables', 'InvulnerableAdded', 'InvulnerableRemoved', 'NewDesiredCandidates', 'NewCandidacyBond', 'CandidateAdded', 'CandidateBondUpdated', 'CandidateRemoved', 'CandidateReplaced', 'InvalidInvulnerableSkipped'];
        Session: ['NewSession', 'NewQueued', 'ValidatorDisabled', 'ValidatorReenabled'];
        XcmpQueue: ['XcmpMessageSent'];
        PolkadotXcm: ['Attempted', 'Sent', 'SendFailed', 'ProcessXcmError', 'UnexpectedResponse', 'ResponseReady', 'Notified', 'NotifyOverweight', 'NotifyDispatchError', 'NotifyDecodeFailed', 'InvalidResponder', 'InvalidResponderVersion', 'ResponseTaken', 'AssetsTrapped', 'VersionChangeNotified', 'SupportedVersionChanged', 'NotifyTargetSendFail', 'NotifyTargetMigrationFail', 'InvalidQuerierVersion', 'InvalidQuerier', 'VersionNotifyStarted', 'VersionNotifyRequested', 'VersionNotifyUnrequested', 'FeesPaid', 'AssetsClaimed', 'VersionMigrationFinished', 'AliasAuthorized', 'AliasAuthorizationRemoved', 'AliasesAuthorizationsRemoved'];
        CumulusXcm: ['InvalidFormat', 'UnsupportedVersion', 'ExecutedDownward'];
        MessageQueue: ['ProcessingFailed', 'Processed', 'OverweightEnqueued', 'PageReaped'];
        Utility: ['BatchInterrupted', 'BatchCompleted', 'BatchCompletedWithErrors', 'ItemCompleted', 'ItemFailed', 'DispatchedAs', 'IfElseMainSuccess', 'IfElseFallbackCalled'];
        Multisig: ['NewMultisig', 'MultisigApproval', 'MultisigExecuted', 'MultisigCancelled', 'DepositPoked'];
        Proxy: ['ProxyExecuted', 'PureCreated', 'PureKilled', 'Announced', 'ProxyAdded', 'ProxyRemoved', 'DepositPoked'];
        Preimage: ['Noted', 'Requested', 'Cleared'];
        Scheduler: ['Scheduled', 'Canceled', 'Dispatched', 'RetrySet', 'RetryCancelled', 'CallUnavailable', 'PeriodicFailed', 'RetryFailed', 'PermanentlyOverweight', 'AgendaIncomplete'];
        AssetRate: ['AssetRateCreated', 'AssetRateRemoved', 'AssetRateUpdated'];
        Alliance: ['NewRuleSet', 'Announced', 'AnnouncementRemoved', 'MembersInitialized', 'NewAllyJoined', 'AllyElevated', 'MemberRetirementPeriodStarted', 'MemberRetired', 'MemberKicked', 'UnscrupulousItemAdded', 'UnscrupulousItemRemoved', 'AllianceDisbanded', 'FellowAbdicated'];
        AllianceMotion: ['Proposed', 'Voted', 'Approved', 'Disapproved', 'Executed', 'MemberExecuted', 'Closed', 'Killed', 'ProposalCostBurned', 'ProposalCostReleased'];
        FellowshipCollective: ['MemberAdded', 'RankChanged', 'MemberRemoved', 'Voted', 'MemberExchanged'];
        FellowshipReferenda: ['Submitted', 'DecisionDepositPlaced', 'DecisionDepositRefunded', 'DepositSlashed', 'DecisionStarted', 'ConfirmStarted', 'ConfirmAborted', 'Confirmed', 'Approved', 'Rejected', 'TimedOut', 'Cancelled', 'Killed', 'SubmissionDepositRefunded', 'MetadataSet', 'MetadataCleared'];
        FellowshipCore: ['ParamsChanged', 'ActiveChanged', 'Inducted', 'Offboarded', 'Promoted', 'Demoted', 'Proven', 'Requested', 'EvidenceJudged', 'Imported', 'Swapped'];
        FellowshipSalary: ['Inducted', 'Registered', 'Paid', 'CycleStarted', 'Swapped'];
        FellowshipTreasury: ['Spending', 'Awarded', 'Burnt', 'Rollover', 'Deposit', 'SpendApproved', 'UpdatedInactive', 'AssetSpendApproved', 'AssetSpendVoided', 'Paid', 'PaymentFailed', 'SpendProcessed'];
        AmbassadorCollective: ['MemberAdded', 'RankChanged', 'MemberRemoved', 'Voted', 'MemberExchanged'];
        AmbassadorReferenda: ['Submitted', 'DecisionDepositPlaced', 'DecisionDepositRefunded', 'DepositSlashed', 'DecisionStarted', 'ConfirmStarted', 'ConfirmAborted', 'Confirmed', 'Approved', 'Rejected', 'TimedOut', 'Cancelled', 'Killed', 'SubmissionDepositRefunded', 'MetadataSet', 'MetadataCleared'];
        AmbassadorCore: ['ParamsChanged', 'ActiveChanged', 'Inducted', 'Offboarded', 'Promoted', 'Demoted', 'Proven', 'Requested', 'EvidenceJudged', 'Imported', 'Swapped'];
        AmbassadorSalary: ['Inducted', 'Registered', 'Paid', 'CycleStarted', 'Swapped'];
        AmbassadorTreasury: ['Spending', 'Awarded', 'Burnt', 'Rollover', 'Deposit', 'SpendApproved', 'UpdatedInactive', 'AssetSpendApproved', 'AssetSpendVoided', 'Paid', 'PaymentFailed', 'SpendProcessed'];
        SecretaryCollective: ['MemberAdded', 'RankChanged', 'MemberRemoved', 'Voted', 'MemberExchanged'];
        SecretarySalary: ['Inducted', 'Registered', 'Paid', 'CycleStarted', 'Swapped'];
    };
    errors: {
        System: ['InvalidSpecName', 'SpecVersionNeedsToIncrease', 'FailedToExtractRuntimeVersion', 'NonDefaultComposite', 'NonZeroRefCount', 'CallFiltered', 'MultiBlockMigrationsOngoing', 'NothingAuthorized', 'Unauthorized'];
        ParachainSystem: ['OverlappingUpgrades', 'ProhibitedByPolkadot', 'TooBig', 'ValidationDataNotAvailable', 'HostConfigurationNotAvailable', 'NotScheduled'];
        Balances: ['VestingBalance', 'LiquidityRestrictions', 'InsufficientBalance', 'ExistentialDeposit', 'Expendability', 'ExistingVestingSchedule', 'DeadAccount', 'TooManyReserves', 'TooManyHolds', 'TooManyFreezes', 'IssuanceDeactivated', 'DeltaZero'];
        CollatorSelection: ['TooManyCandidates', 'TooFewEligibleCollators', 'AlreadyCandidate', 'NotCandidate', 'TooManyInvulnerables', 'AlreadyInvulnerable', 'NotInvulnerable', 'NoAssociatedValidatorId', 'ValidatorNotRegistered', 'InsertToCandidateListFailed', 'RemoveFromCandidateListFailed', 'DepositTooLow', 'UpdateCandidateListFailed', 'InsufficientBond', 'TargetIsNotCandidate', 'IdenticalDeposit', 'InvalidUnreserve'];
        Session: ['InvalidProof', 'NoAssociatedValidatorId', 'DuplicatedKey', 'NoKeys', 'NoAccount'];
        XcmpQueue: ['BadQueueConfig', 'AlreadySuspended', 'AlreadyResumed', 'TooManyActiveOutboundChannels', 'TooBig'];
        PolkadotXcm: ['Unreachable', 'SendFailure', 'Filtered', 'UnweighableMessage', 'DestinationNotInvertible', 'Empty', 'CannotReanchor', 'TooManyAssets', 'InvalidOrigin', 'BadVersion', 'BadLocation', 'NoSubscription', 'AlreadySubscribed', 'CannotCheckOutTeleport', 'LowBalance', 'TooManyLocks', 'AccountNotSovereign', 'FeesNotMet', 'LockNotFound', 'InUse', 'InvalidAssetUnknownReserve', 'InvalidAssetUnsupportedReserve', 'TooManyReserves', 'LocalExecutionIncomplete', 'TooManyAuthorizedAliases', 'ExpiresInPast', 'AliasNotFound', 'LocalExecutionIncompleteWithError'];
        MessageQueue: ['NotReapable', 'NoPage', 'NoMessage', 'AlreadyProcessed', 'Queued', 'InsufficientWeight', 'TemporarilyUnprocessable', 'QueuePaused', 'RecursiveDisallowed'];
        Utility: ['TooManyCalls'];
        Multisig: ['MinimumThreshold', 'AlreadyApproved', 'NoApprovalsNeeded', 'TooFewSignatories', 'TooManySignatories', 'SignatoriesOutOfOrder', 'SenderInSignatories', 'NotFound', 'NotOwner', 'NoTimepoint', 'WrongTimepoint', 'UnexpectedTimepoint', 'MaxWeightTooLow', 'AlreadyStored'];
        Proxy: ['TooMany', 'NotFound', 'NotProxy', 'Unproxyable', 'Duplicate', 'NoPermission', 'Unannounced', 'NoSelfProxy'];
        Preimage: ['TooBig', 'AlreadyNoted', 'NotAuthorized', 'NotNoted', 'Requested', 'NotRequested', 'TooMany', 'TooFew'];
        Scheduler: ['FailedToSchedule', 'NotFound', 'TargetBlockNumberInPast', 'RescheduleNoChange', 'Named'];
        AssetRate: ['UnknownAssetKind', 'AlreadyExists', 'Overflow'];
        Alliance: ['AllianceNotYetInitialized', 'AllianceAlreadyInitialized', 'AlreadyMember', 'NotMember', 'NotAlly', 'NoVotingRights', 'AlreadyElevated', 'AlreadyUnscrupulous', 'AccountNonGrata', 'NotListedAsUnscrupulous', 'TooManyUnscrupulousItems', 'TooLongWebsiteUrl', 'InsufficientFunds', 'WithoutRequiredIdentityFields', 'WithoutGoodIdentityJudgement', 'MissingProposalHash', 'MissingAnnouncement', 'TooManyMembers', 'TooManyAnnouncements', 'BadWitness', 'AlreadyRetiring', 'RetirementNoticeNotGiven', 'RetirementPeriodNotPassed', 'FellowsMissing'];
        AllianceMotion: ['NotMember', 'DuplicateProposal', 'ProposalMissing', 'WrongIndex', 'DuplicateVote', 'AlreadyInitialized', 'TooEarly', 'TooManyProposals', 'WrongProposalWeight', 'WrongProposalLength', 'PrimeAccountNotMember', 'ProposalActive'];
        FellowshipCollective: ['AlreadyMember', 'NotMember', 'NotPolling', 'Ongoing', 'NoneRemaining', 'Corruption', 'RankTooLow', 'InvalidWitness', 'NoPermission', 'SameMember', 'TooManyMembers'];
        FellowshipReferenda: ['NotOngoing', 'HasDeposit', 'BadTrack', 'Full', 'QueueEmpty', 'BadReferendum', 'NothingToDo', 'NoTrack', 'Unfinished', 'NoPermission', 'NoDeposit', 'BadStatus', 'PreimageNotExist', 'PreimageStoredWithDifferentLength'];
        FellowshipCore: ['Unranked', 'Ranked', 'UnexpectedRank', 'InvalidRank', 'NoPermission', 'NothingDoing', 'AlreadyInducted', 'NotTracked', 'TooSoon'];
        FellowshipSalary: ['AlreadyStarted', 'NotMember', 'AlreadyInducted', 'NotInducted', 'NoClaim', 'ClaimZero', 'TooLate', 'TooEarly', 'NotYet', 'NotStarted', 'Bankrupt', 'PayError', 'Inconclusive', 'NotCurrent'];
        FellowshipTreasury: ['InvalidIndex', 'TooManyApprovals', 'InsufficientPermission', 'ProposalNotApproved', 'FailedToConvertBalance', 'SpendExpired', 'EarlyPayout', 'AlreadyAttempted', 'PayoutError', 'NotAttempted', 'Inconclusive'];
        AmbassadorCollective: ['AlreadyMember', 'NotMember', 'NotPolling', 'Ongoing', 'NoneRemaining', 'Corruption', 'RankTooLow', 'InvalidWitness', 'NoPermission', 'SameMember', 'TooManyMembers'];
        AmbassadorReferenda: ['NotOngoing', 'HasDeposit', 'BadTrack', 'Full', 'QueueEmpty', 'BadReferendum', 'NothingToDo', 'NoTrack', 'Unfinished', 'NoPermission', 'NoDeposit', 'BadStatus', 'PreimageNotExist', 'PreimageStoredWithDifferentLength'];
        AmbassadorCore: ['Unranked', 'Ranked', 'UnexpectedRank', 'InvalidRank', 'NoPermission', 'NothingDoing', 'AlreadyInducted', 'NotTracked', 'TooSoon'];
        AmbassadorSalary: ['AlreadyStarted', 'NotMember', 'AlreadyInducted', 'NotInducted', 'NoClaim', 'ClaimZero', 'TooLate', 'TooEarly', 'NotYet', 'NotStarted', 'Bankrupt', 'PayError', 'Inconclusive', 'NotCurrent'];
        AmbassadorTreasury: ['InvalidIndex', 'TooManyApprovals', 'InsufficientPermission', 'ProposalNotApproved', 'FailedToConvertBalance', 'SpendExpired', 'EarlyPayout', 'AlreadyAttempted', 'PayoutError', 'NotAttempted', 'Inconclusive'];
        SecretaryCollective: ['AlreadyMember', 'NotMember', 'NotPolling', 'Ongoing', 'NoneRemaining', 'Corruption', 'RankTooLow', 'InvalidWitness', 'NoPermission', 'SameMember', 'TooManyMembers'];
        SecretarySalary: ['AlreadyStarted', 'NotMember', 'AlreadyInducted', 'NotInducted', 'NoClaim', 'ClaimZero', 'TooLate', 'TooEarly', 'NotYet', 'NotStarted', 'Bankrupt', 'PayError', 'Inconclusive', 'NotCurrent'];
    };
    constants: {
        System: ['BlockWeights', 'BlockLength', 'BlockHashCount', 'DbWeight', 'Version', 'SS58Prefix'];
        ParachainSystem: ['SelfParaId'];
        Timestamp: ['MinimumPeriod'];
        Balances: ['ExistentialDeposit', 'MaxLocks', 'MaxReserves', 'MaxFreezes'];
        TransactionPayment: ['OperationalFeeMultiplier'];
        CollatorSelection: ['PotId', 'MaxCandidates', 'MinEligibleCollators', 'MaxInvulnerables', 'KickThreshold', 'pot_account'];
        Session: ['KeyDeposit'];
        Aura: ['SlotDuration'];
        XcmpQueue: ['MaxInboundSuspended', 'MaxActiveOutboundChannels', 'MaxPageSize'];
        PolkadotXcm: ['UniversalLocation', 'AdvertisedXcmVersion', 'MaxLockers', 'MaxRemoteLockConsumers'];
        MessageQueue: ['HeapSize', 'MaxStale', 'ServiceWeight', 'IdleMaxServiceWeight'];
        Utility: ['batched_calls_limit'];
        Multisig: ['DepositBase', 'DepositFactor', 'MaxSignatories'];
        Proxy: ['ProxyDepositBase', 'ProxyDepositFactor', 'MaxProxies', 'MaxPending', 'AnnouncementDepositBase', 'AnnouncementDepositFactor'];
        Scheduler: ['MaximumWeight', 'MaxScheduledPerBlock'];
        Alliance: ['MaxUnscrupulousItems', 'MaxWebsiteUrlLength', 'AllyDeposit', 'MaxAnnouncementsCount', 'MaxMembersCount'];
        AllianceMotion: ['MaxProposalWeight'];
        FellowshipReferenda: ['SubmissionDeposit', 'MaxQueued', 'UndecidingTimeout', 'AlarmInterval', 'Tracks'];
        FellowshipCore: ['EvidenceSize', 'MaxRank'];
        FellowshipSalary: ['RegistrationPeriod', 'PayoutPeriod', 'Budget'];
        FellowshipTreasury: ['SpendPeriod', 'Burn', 'PalletId', 'MaxApprovals', 'PayoutPeriod', 'pot_account'];
        AmbassadorReferenda: ['SubmissionDeposit', 'MaxQueued', 'UndecidingTimeout', 'AlarmInterval', 'Tracks'];
        AmbassadorCore: ['EvidenceSize', 'MaxRank'];
        AmbassadorSalary: ['RegistrationPeriod', 'PayoutPeriod', 'Budget'];
        AmbassadorTreasury: ['SpendPeriod', 'Burn', 'PalletId', 'MaxApprovals', 'PayoutPeriod', 'pot_account'];
        SecretarySalary: ['RegistrationPeriod', 'PayoutPeriod', 'Budget'];
    };
    viewFns: {
        Proxy: ['check_permissions', 'is_superset'];
    };
    apis: {
        AuraApi: ['slot_duration', 'authorities'];
        RelayParentOffsetApi: ['relay_parent_offset'];
        AuraUnincludedSegmentApi: ['can_build_upon'];
        Core: ['version', 'execute_block', 'initialize_block'];
        Metadata: ['metadata', 'metadata_at_version', 'metadata_versions'];
        BlockBuilder: ['apply_extrinsic', 'finalize_block', 'inherent_extrinsics', 'check_inherents'];
        TaggedTransactionQueue: ['validate_transaction'];
        OffchainWorkerApi: ['offchain_worker'];
        SessionKeys: ['generate_session_keys', 'decode_session_keys'];
        RuntimeViewFunction: ['execute_view_function'];
        AccountNonceApi: ['account_nonce'];
        TransactionPaymentApi: ['query_info', 'query_fee_details', 'query_weight_to_fee', 'query_length_to_fee'];
        TransactionPaymentCallApi: ['query_call_info', 'query_call_fee_details', 'query_weight_to_fee', 'query_length_to_fee'];
        XcmPaymentApi: ['query_acceptable_payment_assets', 'query_xcm_weight', 'query_weight_to_asset_fee', 'query_delivery_fees'];
        DryRunApi: ['dry_run_call', 'dry_run_xcm'];
        LocationToAccountApi: ['convert_location'];
        TrustedQueryApi: ['is_trusted_reserve', 'is_trusted_teleporter'];
        AuthorizedAliasersApi: ['authorized_aliasers', 'is_authorized_alias'];
        CollectCollationInfo: ['collect_collation_info'];
        GenesisBuilder: ['build_state', 'get_preset', 'preset_names'];
        GetParachainInfo: ['parachain_id'];
    };
};
export type Dot_colWhitelistEntry = PalletKey | `query.${NestedKey<AllInteractions['storage']>}` | `tx.${NestedKey<AllInteractions['tx']>}` | `event.${NestedKey<AllInteractions['events']>}` | `error.${NestedKey<AllInteractions['errors']>}` | `const.${NestedKey<AllInteractions['constants']>}` | `view.${NestedKey<AllInteractions['viewFns']>}` | `api.${NestedKey<AllInteractions['apis']>}`;
type PalletKey = `*.${({
    [K in keyof AllInteractions]: K extends 'apis' ? never : keyof AllInteractions[K];
})[keyof AllInteractions]}`;
type NestedKey<D extends Record<string, string[]>> = "*" | {
    [P in keyof D & string]: `${P}.*` | `${P}.${D[P][number]}`;
}[keyof D & string];
