import React, { useEffect, useMemo, useState } from 'react';
import { Button, CardActions, CardContent, Dialog, Stack, TextField, Typography } from '@mui/material';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { useDeployedBoardContext } from '../hooks';

export interface EmptyCardContentProps {
  onCreateBoardCallback: () => void;
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
}

const shortAddr = (addr: string): string => {
  if (addr.length <= 18) return addr;
  // ej: 0xec34f531...c54d4861  (10 chars al inicio, 8 al final)
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
};

export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);
  const [address, setAddress] = useState('');
  const ctx = useDeployedBoardContext();
  const [known, setKnown] = useState<ContractAddress[]>([]);
  const [titles, setTitles] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const sub = ctx.knownBoards$.subscribe(setKnown);
    return () => sub.unsubscribe();
  }, [ctx]);

  // Cargar títulos para cada contrato conocido
  useEffect(() => {
    const subs = known.map((addr) =>
      ctx.getBoardTitle$(addr).subscribe((title) =>
        setTitles((prev) => (prev[addr] === title ? prev : { ...prev, [addr]: title })),
      ),
    );
    return () => subs.forEach((s) => s.unsubscribe());
  }, [ctx, known]);

  const onOpenJoin = () => setTextPromptOpen(true);
  const onCloseJoin = () => setTextPromptOpen(false);
  const onConfirmJoin = () => {
    const trimmed = address.trim();
    if (trimmed.length) {
      onJoinBoardCallback(trimmed as ContractAddress);
      setTextPromptOpen(false);
    }
  };

  return (
    <>
      <CardContent>
        <Stack spacing={1}>
          <Button variant="contained" color="primary" onClick={onCreateBoardCallback} data-testid="create-board-btn">
            Create board
          </Button>
          <Button variant="outlined" color="primary" onClick={onOpenJoin} data-testid="join-board-btn">
            Join by address
          </Button>

          {known.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Known boards
              </Typography>
              <Stack spacing={0.5}>
                {known.map((addr) => {
                  const title = titles[addr] ?? 'Untitled';
                  return (
                    <Stack key={addr} direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => onJoinBoardCallback(addr)}
                        data-testid={`known-board-${addr}`}
                        sx={{
                          textTransform: 'none',
                          justifyContent: 'flex-start',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {title} — {shortAddr(addr)}
                      </Button>
                      <Button variant="outlined" color="inherit" size="small" onClick={() => ctx.removeKnownBoard(addr)}>
                        Remove
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>
              <Button variant="text" color="inherit" size="small" onClick={() => ctx.clearKnownBoards()}>
                Clear list
              </Button>
            </>
          )}
        </Stack>
      </CardContent>

      <CardActions>{/* empty */}</CardActions>
      <Dialog open={textPromptOpen} onClose={onCloseJoin} fullWidth maxWidth="sm">
        <CardContent>
          <TextField
            autoFocus
            fullWidth
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Paste contract address"
            inputProps={{ 'data-testid': 'join-address-input' }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button onClick={onCloseJoin} variant="outlined" color="inherit">
              Cancel
            </Button>
            <Button onClick={onConfirmJoin} variant="contained" color="primary" disabled={!address.trim().length}>
              Join
            </Button>
          </Stack>
        </CardContent>
      </Dialog>
    </>
  );
};
