import {
  type CodecType,
  type SignedStatement as HostSignedStatement,
  type Statement as HostStatement,
  GenericError,
  StatementProofErr,
} from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { fromHex, toHex } from '@novasamatech/scale';
import { type Proof, type SignedStatement, type Statement } from '@novasamatech/sdk-statement';
import { errAsync } from 'neverthrow';
import { useEffect } from 'react';

import { useLooseRef } from '@/shared/hooks';
import { nonNullable } from '@/shared/utils';
import { statementStoreAdapter, usePappProvider } from '@/domains/application';

export function useStatementStore(container: Container, identifier: string) {
  const papp = usePappProvider();
  const pappRef = useLooseRef(papp);
  const session = useSession();
  const sessionRef = useLooseRef(session);

  useEffect(() => {
    const cleanupSubmit = container.handleStatementStoreSubmit(statement => {
      return statementStoreAdapter
        .submitStatement(mapFromHostSignedStatement(statement))
        .map(() => undefined)
        .mapErr(e => new GenericError({ reason: e.message }));
    });

    const cleanupSubscribe = container.handleStatementStoreSubscribe((topics, send) => {
      const filter =
        topics.tag === 'MatchAll'
          ? {
              matchAll: topics.value,
            }
          : {
              matchAny: topics.value,
            };

      return statementStoreAdapter.subscribeStatements(filter, ({ statements, isComplete }) => {
        const mapped = statements.map(mapFromSdkStatement).filter(nonNullable);
        if (mapped.length > 0) {
          send({ statements: mapped, isComplete });
        }
      });
    });

    const createProofWithSessionSecret = (statement: CodecType<typeof HostStatement>) => {
      const papp = pappRef();
      const session = sessionRef();
      if (!session?.session || !papp) {
        return errAsync(new StatementProofErr.UnableToSign());
      }

      return papp.allowance
        .getStatementStoreProver(session.session.id, identifier)
        .mapErr(e => new StatementProofErr.Unknown({ reason: e.message }))
        .andThen(prover =>
          prover.generateMessageProof(mapFromHostStatement(statement)).mapErr(e => {
            console.error(e);
            return new StatementProofErr.Unknown({ reason: e.message });
          }),
        )
        .map(s => mapSdkProof(s.proof));
    };

    const cleanupCreateProof = container.handleStatementStoreCreateProof(([, statement]) =>
      createProofWithSessionSecret(statement),
    );

    const cleanupCreateProofAuthorized = container.handleStatementStoreCreateProofAuthorized(statement =>
      createProofWithSessionSecret(statement),
    );

    return () => {
      cleanupSubmit();
      cleanupSubscribe();
      cleanupCreateProof();
      cleanupCreateProofAuthorized();
    };
  }, [container, identifier]);
}

function mapHostProof(proof: CodecType<typeof HostSignedStatement>['proof']): Proof {
  switch (proof.tag) {
    case 'Ecdsa':
      return {
        type: 'ecdsa',
        value: {
          signature: toHex(proof.value.signature),
          signer: toHex(proof.value.signer),
        },
      };
    case 'Ed25519':
      return {
        type: 'ed25519',
        value: {
          signature: toHex(proof.value.signature),
          signer: toHex(proof.value.signer),
        },
      };
    case 'Sr25519':
      return {
        type: 'sr25519',
        value: {
          signature: toHex(proof.value.signature),
          signer: toHex(proof.value.signer),
        },
      };
    case 'OnChain':
      return {
        type: 'onChain',
        value: {
          who: toHex(proof.value.who),
          blockHash: toHex(proof.value.blockHash),
          event: proof.value.event,
        },
      };
  }
}

function mapFromHostSignedStatement(statement: CodecType<typeof HostSignedStatement>): SignedStatement {
  const s: SignedStatement = {
    proof: mapHostProof(statement.proof),
  };

  if (statement.expiry) {
    s.expiry = statement.expiry;
  }

  if (statement.channel) {
    s.channel = toHex(statement.channel);
  }

  if (statement.topics) {
    s.topics = statement.topics.map(toHex);
  }

  if (statement.data) {
    s.data = statement.data;
  }

  if (statement.decryptionKey) {
    s.decryptionKey = toHex(statement.decryptionKey);
  }

  return s;
}

function mapFromHostStatement(statement: CodecType<typeof HostStatement>): Statement {
  const s: Statement = {};

  if (statement.proof) {
    s.proof = mapHostProof(statement.proof);
  }

  if (statement.expiry) {
    s.expiry = statement.expiry;
  }

  if (statement.channel) {
    s.channel = toHex(statement.channel);
  }

  if (statement.topics) {
    s.topics = statement.topics.map(toHex);
  }

  if (statement.data) {
    s.data = statement.data;
  }

  if (statement.decryptionKey) {
    s.decryptionKey = toHex(statement.decryptionKey);
  }

  return s;
}

function mapSdkProof(proof: Proof): CodecType<typeof HostSignedStatement>['proof'] {
  switch (proof.type) {
    case 'ecdsa':
      return {
        tag: 'Ecdsa',
        value: {
          signature: fromHex(proof.value.signature),
          signer: fromHex(proof.value.signer),
        },
      };
    case 'ed25519':
      return {
        tag: 'Ed25519',
        value: {
          signature: fromHex(proof.value.signature),
          signer: fromHex(proof.value.signer),
        },
      };
    case 'sr25519':
      return {
        tag: 'Sr25519',
        value: {
          signature: fromHex(proof.value.signature),
          signer: fromHex(proof.value.signer),
        },
      };
    case 'onChain':
      return {
        tag: 'OnChain',
        value: {
          who: fromHex(proof.value.who),
          blockHash: fromHex(proof.value.blockHash),
          event: proof.value.event,
        },
      };
  }
}

function mapFromSdkStatement(statement: Statement): CodecType<typeof HostSignedStatement> | null {
  if (!statement.proof) {
    return null;
  }

  return {
    proof: mapSdkProof(statement.proof),
    expiry: statement.expiry,
    channel: statement.channel ? fromHex(statement.channel) : undefined,
    topics: statement.topics ? statement.topics.map(fromHex) : [],
    data: statement.data,
    decryptionKey: statement.decryptionKey ? fromHex(statement.decryptionKey) : undefined,
  };
}
