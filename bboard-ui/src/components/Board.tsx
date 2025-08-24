import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  Button,
  Skeleton,
  Typography,
  TextField,
} from '@mui/material';
import { motion } from 'framer-motion';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import { CheckCircleOutline, ThumbDown, ThumbUp } from '@mui/icons-material';
import { type BBoardDerivedState, type DeployedBBoardAPI } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { STATE } from '../../../contract/src/index';
import { EmptyCardContent } from './Board.EmptyCardContent';

/** The props required by the {@link Board} component. */
export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedBBoardAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<BBoardDerivedState>();
  const [messagePrompt, setMessagePrompt] = useState<string>();
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  const onCreateBoard = useCallback(() => boardApiProvider.resolve(), [boardApiProvider]);
  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) => boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const onPostMessage = useCallback(async () => {
    if (!messagePrompt) return;
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        await deployedBoardAPI.post(messagePrompt);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, messagePrompt]);

  const onDeleteMessage = useCallback(async () => {
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        await deployedBoardAPI.takeDown();
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(deployedBoardAPI.deployedContractAddress);
    }
  }, [deployedBoardAPI]);

  useEffect(() => {
    if (!boardDeployment$) return;
    const subscription = boardDeployment$.subscribe(setBoardDeployment);
    return () => subscription.unsubscribe();
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment) return;
    if (boardDeployment.status === 'in-progress') return;

    setIsWorking(false);

    if (boardDeployment.status === 'failed') {
      setErrorMessage(
        boardDeployment.error.message.length ? boardDeployment.error.message : 'Encountered an unexpected error.',
      );
      return;
    }

    setDeployedBoardAPI(boardDeployment.api);
    const subscription = boardDeployment.api.state$.subscribe(setBoardState);
    return () => subscription.unsubscribe();
  }, [boardDeployment]);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.25 }}
      style={{ width: '100%', maxWidth: 480 }}
    >
      <Card
        sx={{
          position: 'relative',
          width: '100%',
          minWidth: 420,
          minHeight: 360,
          borderRadius: 4,
          boxShadow: '0px 8px 24px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #0d0d0d, #1a1a1a)',
          color: 'white',
        }}
      >
        {!boardDeployment$ && (
          <EmptyCardContent onCreateBoardCallback={onCreateBoard} onJoinBoardCallback={onJoinBoard} />
        )}

        {boardDeployment$ && (
          <>
            {/* Loading backdrop */}
            <Backdrop
              sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
              open={isWorking}
            >
              <CircularProgress data-testid="board-working-indicator" />
            </Backdrop>

            {/* Error backdrop */}
            <Backdrop
              sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
              open={!!errorMessage}
            >
              <StopIcon fontSize="large" />
              <Typography fontSize="1.1rem" fontWeight="bold">
                {errorMessage}
              </Typography>
            </Backdrop>

            <CardHeader
              avatar={
                boardState ? (
                  boardState.state === STATE.vacant || (boardState.state === STATE.occupied && boardState.isOwner) ? (
                    <LockOpenIcon data-testid="post-unlocked-icon" />
                  ) : (
                    <LockIcon data-testid="post-locked-icon" />
                  )
                ) : (
                  <Skeleton variant="circular" width={24} height={24} />
                )
              }
              titleTypographyProps={{ fontSize: '1.25rem', fontWeight: '600', color: 'white' }}
              title={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? 'Loading...'}
              action={
                deployedBoardAPI?.deployedContractAddress ? (
                  <IconButton title="Copy contract address" onClick={onCopyContractAddress} sx={{ color: 'white' }}>
                    <CopyIcon />
                  </IconButton>
                ) : (
                  <Skeleton variant="circular" width={24} height={24} />
                )
              }
            />

            <CardContent>
              {boardState ? (
                boardState.state === STATE.occupied ? (
                  <Typography fontSize="1.15rem" fontWeight="500" minHeight={80}>
                    {boardState.message}
                  </Typography>
                ) : (
                  <TextField
                    id="message-prompt"
                    variant="outlined"
                    fullWidth
                    multiline
                    minRows={3}
                    maxRows={3}
                    placeholder="Write your proposal..."
                    sx={{
                      backgroundColor: '#fff',
                      borderRadius: 2,
                      '& .MuiOutlinedInput-root': {
                        fontSize: '1rem',
                      },
                    }}
                    onChange={(e) => setMessagePrompt(e.target.value)}
                  />
                )
              ) : (
                <Skeleton variant="rectangular" width="100%" height={160} />
              )}
            </CardContent>

            <CardActions
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                pb: 2,
              }}
            >
              <div className="flex flex-row gap-2 items-center">
                <CheckCircleOutline /> <span style={{ fontSize: '1rem' }}>Public Voting</span>
              </div>

              {deployedBoardAPI ? (
                <div className="flex flex-row gap-2">
                  <Button
                    variant="contained"
                    sx={{
                      px: 3,
                      py: 1.2,
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      background: 'linear-gradient(90deg, #4e54c8, #8f94fb)',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #5d63d6, #9ea3ff)',
                      },
                    }}
                    disabled={boardState?.state === STATE.occupied || !messagePrompt?.length}
                    onClick={onPostMessage}
                  >
                    Create Proposal
                  </Button>

                  <IconButton
                    title="Take down message"
                    disabled={
                      boardState?.state === STATE.vacant ||
                      (boardState?.state === STATE.occupied && !boardState.isOwner)
                    }
                    onClick={onDeleteMessage}
                    sx={{ color: '#bbb' }}
                  >
                    <DeleteIcon />
                  </IconButton>

                  {boardState?.state !== STATE.vacant && (
                    <>
                      <IconButton sx={{ color: 'lightgreen' }}>
                        <ThumbUp />
                      </IconButton>
                      <IconButton sx={{ color: 'tomato' }}>
                        <ThumbDown />
                      </IconButton>
                    </>
                  )}
                </div>
              ) : (
                <Skeleton variant="rectangular" width={80} height={20} />
              )}

              {boardState?.state !== STATE.vacant && (
                <Typography fontSize="0.95rem" color="gray">
                  Winning so far: <strong>Approve</strong>
                </Typography>
              )}
            </CardActions>
          </>
        )}
      </Card>
    </motion.div>
  );
};

/** @internal */
const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  contractAddress ? (
    <span data-testid="board-address">
      0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;
