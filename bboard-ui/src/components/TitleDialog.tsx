// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0

import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

export interface TitleDialogProps {
  open: boolean;
  title: string;
  initialValue?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export const TitleDialog: React.FC<Readonly<TitleDialogProps>> = ({
  open,
  title,
  initialValue = '',
  onCancel,
  onSubmit,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const onConfirm = () => {
    const trimmed = value.trim();
    if (trimmed.length) onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Board title"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputProps={{ 'data-testid': 'title-dialog-input' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary" disabled={!value.trim().length}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};