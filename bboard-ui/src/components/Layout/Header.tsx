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