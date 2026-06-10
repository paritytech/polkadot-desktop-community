import { useCallback } from 'react';

import { useAction } from '@/shared/hooks';
import { type FolderItemPositions } from '../dashboard-layout/types';

import { cardsUseCase } from './cards';
import { foldersUseCase } from './folders';

export const useRemoveIconFromFolder = () => {
  const { run, pending, status } = useAction(({ iconId }: { iconId: string }) => foldersUseCase.removeIconFromFolder(iconId));
  const removeIconFromFolder = useCallback((iconId: string) => run({ iconId }), [run]);
  return { removeIconFromFolder, pending, status };
};

export const useSetFolderItemPositions = () => {
  const { run, pending, status } = useAction(({ folderId, positions }: { folderId: string; positions: FolderItemPositions }) =>
    foldersUseCase.setFolderItemPositions(folderId, positions),
  );
  const setFolderItemPositions = useCallback(
    (folderId: string, positions: FolderItemPositions) => run({ folderId, positions }),
    [run],
  );
  return { setFolderItemPositions, pending, status };
};

export const useRemoveFolder = () => {
  // A folder is a first-class card, so removing it is removing its card.
  const { run, pending, status } = useAction(({ folderId }: { folderId: string }) => cardsUseCase.removeCardFromLayout(folderId));
  const removeFolder = useCallback((folderId: string) => run({ folderId }), [run]);
  return { removeFolder, pending, status };
};
