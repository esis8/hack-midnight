import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { Board, MainLayout } from './components';
import { useDeployedBoardContext } from './hooks';
import { type BoardDeployment } from './contexts';
import { type Observable } from 'rxjs';


const App: React.FC = () => {
  const provider = useDeployedBoardContext();
  const [selectedDeployment$, setSelectedDeployment$] = useState<Observable<BoardDeployment> | undefined>(undefined);

 useEffect(() => {
    const sub = provider.knownBoards$.subscribe((addrs) => {
      if (!selectedDeployment$ && addrs.length > 0) {
        setSelectedDeployment$(provider.resolve(addrs[0]));
      }
    });
    return () => sub.unsubscribe();
  }, [provider, selectedDeployment$]);

    useEffect(() => {
    const sub = provider.boardDeployments$.subscribe((list) => {
      if (list.length === 0) return;
      const last = list[list.length - 1];
      if (selectedDeployment$ !== last) {
        setSelectedDeployment$(last);
      }
    });
    return () => sub.unsubscribe();
  }, [provider, selectedDeployment$]);

  return (
    <Box sx={{ background: '#000', minHeight: '100vh' }}>
      <MainLayout>
        <div data-testid="board-start">
          <Board />
        </div>
            {selectedDeployment$ ? (
            <Board boardDeployment$={selectedDeployment$} />
          ) : (
            <Board />
          )}
      </MainLayout>
    </Box>
  );
};

export default App;