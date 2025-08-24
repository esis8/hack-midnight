// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0

import React, { useState } from 'react';
import {
  Button,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';

/**
 * The props required by the {@link EmptyCardContent} component.
 *
 * @internal
 */
export interface EmptyCardContentProps {
  /** A callback that will be called to create a new bulletin board. */
  onCreateBoardCallback: () => void;
  /** A callback that will be called to join an existing bulletin board. */
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
}

/**
 * Used when there is no board deployment to render a UI allowing the user to join or deploy bulletin boards.
 *
 * @internal
 */
export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);
  const [address, setAddress] = useState('');

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
        <p>Deploy a new board or join an existing one.</p>
      </CardContent>
      <CardActions>
        <Button variant="contained" color="primary" onClick={onCreateBoardCallback} data-testid="deploy-board-btn">
          Create board
        </Button>
        <Button variant="outlined" color="primary" onClick={onOpenJoin} data-testid="join-board-btn">
          Join board
        </Button>
      </CardActions>

      <Dialog open={textPromptOpen} onClose={onCloseJoin} fullWidth maxWidth="sm">
        <DialogTitle>Join existing board</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Contract address (hex)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            inputProps={{ 'data-testid': 'join-address-input' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseJoin} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={onConfirmJoin} variant="contained" color="primary" disabled={!address.trim().length}>
            Join
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
