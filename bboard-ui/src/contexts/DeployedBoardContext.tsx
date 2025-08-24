import React, { createContext, useContext, type PropsWithChildren, useMemo } from 'react';
import type { Logger } from 'pino';
import { BrowserDeployedBoardManager, type DeployedBoardAPIProvider } from './BrowserDeployedBoardManager';

export type DeployedBoardProviderProps = PropsWithChildren<{
  logger: Logger;
  networkId: string;
}>;

// Exporta el contexto para que pueda ser usado por el hook
export const DeployedBoardContext = createContext<DeployedBoardAPIProvider | undefined>(undefined);

export const DeployedBoardProvider: React.FC<Readonly<DeployedBoardProviderProps>> = ({
  logger,
  networkId,
  children,
}) => {
  const value = useMemo(() => new BrowserDeployedBoardManager(logger, networkId), [logger, networkId]);
  return <DeployedBoardContext.Provider value={value}>{children}</DeployedBoardContext.Provider>;
};

// (opcional) Hook local si lo quieres usar directamente desde aquí
export const useDeployedBoardAPIProvider = (): DeployedBoardAPIProvider => {
  const ctx = useContext(DeployedBoardContext);
  if (!ctx) throw new Error('A <DeployedBoardProvider /> is required.');
  return ctx;
};

export type { DeployedBoardAPIProvider };