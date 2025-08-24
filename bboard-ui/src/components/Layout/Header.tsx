
// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { AppBar, Box, Typography } from '@mui/material';

/**
 * Application header for the privacy voting platform
 */
export const Header: React.FC = () => (
  <AppBar
    position="static"
    data-testid="header"
    sx={{
      backgroundColor: '#0d0d0d',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        px: 10,
        py: 2.2,
        alignItems: 'center',
        gap: '1.5rem',
      }}
      data-testid="header-logo"
    >
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        🌌 NovaVote
      </Typography>
      <Typography variant="body1">POWERED BY</Typography>
      <img src="/midnight-logo.png" alt="logo-image" height={32} />
    </Box>
  </AppBar>
);
