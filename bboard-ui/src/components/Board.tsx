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
  Skeleton,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import WriteIcon from '@mui/icons-material/EditNoteOutlined';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import RenameIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import { type BBoardDerivedState, type DeployedBBoardAPI } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { BBoardPrivateState, STATE } from '../../../contract/src/index';
import { EmptyCardContent } from './Board.EmptyCardContent';
import { TitleDialog } from './TitleDialog';

/** The props required by the {@link Board} component. */
export interface BoardProps {
  /** The observable bulletin board deployment. */
  boardDeployment$?: Observable<BoardDeployment>;
}

/**
 * Provides the UI for a deployed bulletin board contract; allowing messages to be posted or removed
 * following the rules enforced by the underlying Compact contract.
 */
export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedBBoardAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<BBoardDerivedState>();
  const [messagePrompt, setMessagePrompt] = useState<string>();
  const [privateState, setPrivateState] = useState<BBoardPrivateState>();

  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  // Dialog for setting/claiming title
  const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);

  // Two simple callbacks that call `resolve(...)` to either deploy or join a bulletin board
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
  }, [deployedBoardAPI, setErrorMessage, setIsWorking, messagePrompt]);

  const onVoteNegative = useCallback(async () => {
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        await deployedBoardAPI.vote(false);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, setErrorMessage, setIsWorking]);
  const onVotePositive = useCallback(async () => {
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        await deployedBoardAPI.vote(true);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, setErrorMessage, setIsWorking]);

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
  }, [deployedBoardAPI, setErrorMessage, setIsWorking]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(deployedBoardAPI.deployedContractAddress);
    }
  }, [deployedBoardAPI]);

  // Helpers for title ownership logic
  const isOwnerUninitialized = (ownerHex?: string): boolean => (ownerHex ? /^0x0+$/i.test(ownerHex) : false);

  const onOpenTitleDialog = useCallback(() => {
    setIsTitleDialogOpen(true);
  }, []);

  const onSubmitTitleDialog = useCallback(
    async (title: string) => {
      try {
        if (!deployedBoardAPI || !boardState) return;
        setIsWorking(true);

        if (isOwnerUninitialized(boardState.ownerHex)) {
          await deployedBoardAPI.claimOwnershipAndSetTitle(title);
        } else if (boardState.isBoardOwner) {
          await deployedBoardAPI.setTitle(title);
        }
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
        setIsTitleDialogOpen(false);
      }
    },
    [deployedBoardAPI, boardState, setIsWorking],
  );

  // Subscriptions to deployment/state/private
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
  }, [boardDeployment, setIsWorking, setErrorMessage, setDeployedBoardAPI]);

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
    const subscription = boardDeployment.api.private$.subscribe(setPrivateState);
    return () => subscription.unsubscribe();
  }, [boardDeployment, setIsWorking, setErrorMessage, setDeployedBoardAPI]);

  return (
    <Card sx={{ position: 'relative', width: 275, height: 300, minWidth: 275, minHeight: 300 }} color="primary">
      {!boardDeployment$ && (
        <EmptyCardContent onCreateBoardCallback={onCreateBoard} onJoinBoardCallback={onJoinBoard} />
      )}

      {boardDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="board-working-indicator" />
          </Backdrop>
          <Backdrop
            sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="board-error-message">
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
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
            titleTypographyProps={{ color: 'primary' }}
            title={boardState ? boardState.title ?? 'Loading…' : 'Loading…'}
            subheader={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? undefined}
            action={
              <React.Fragment>
                {deployedBoardAPI?.deployedContractAddress ? (
                  <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <Skeleton variant="circular" width={20} height={20} />
                )}
                {boardState ? (
                  <IconButton
                    title={
                      isOwnerUninitialized(boardState.ownerHex)
                        ? 'Claim ownership and set title'
                        : boardState.isBoardOwner
                        ? 'Change title'
                        : 'Title can only be changed by the board owner'
                    }
                    onClick={onOpenTitleDialog}
                    disabled={!isOwnerUninitialized(boardState.ownerHex) && !boardState.isBoardOwner}
                  >
                    <RenameIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <Skeleton variant="circular" width={20} height={20} />
                )}
              </React.Fragment>
            }
          />
          <CardContent>
            {boardState ? (
              boardState.state === STATE.occupied ? (
                <Typography data-testid="board-posted-message" minHeight={160} color="primary">
                  {boardState.message}
                  {' ('}
                  <Button onClick={onVotePositive} style={{ cursor: 'pointer' }} title="Vote up">
                    👍 {privateState?.trueCount ?? '?'}
                  </Button>
                  {' | '}
                  <Button onClick={onVoteNegative} style={{ cursor: 'pointer' }} title="Vote down">
                    👎 {privateState?.falseCount ?? '?'}
                  </Button>
                  {')'}
                </Typography>
              ) : (
                <TextField
                  id="message-prompt"
                  data-testid="board-message-prompt"
                  variant="outlined"
                  focused
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={6}
                  placeholder="Message to post"
                  size="small"
                  color="primary"
                  inputProps={{ style: { color: 'black' } }}
                  onChange={(e) => {
                    setMessagePrompt(e.target.value);
                  }}
                />
              )
            ) : (
              <Skeleton variant="rectangular" width={245} height={160} />
            )}
          </CardContent>
          <CardActions>
            {deployedBoardAPI ? (
              <React.Fragment>
                <IconButton
                  title="Post message"
                  data-testid="board-post-message-btn"
                  disabled={boardState?.state === STATE.occupied || !messagePrompt?.length}
                  onClick={onPostMessage}
                >
                  <WriteIcon />
                </IconButton>
                <IconButton
                  title="Take down message"
                  data-testid="board-take-down-message-btn"
                  disabled={
                    boardState?.state === STATE.vacant || (boardState?.state === STATE.occupied && !boardState.isOwner)
                  }
                  onClick={onDeleteMessage}
                >
                  <DeleteIcon />
                </IconButton>
              </React.Fragment>
            ) : (
              <Skeleton variant="rectangular" width={80} height={20} />
            )}
          </CardActions>

          <TitleDialog
            open={isTitleDialogOpen}
            title={isOwnerUninitialized(boardState?.ownerHex) ? 'Set board title' : 'Change board title'}
            initialValue={boardState?.title ?? ''}
            onCancel={() => setIsTitleDialogOpen(false)}
            onSubmit={onSubmitTitleDialog}
          />
        </React.Fragment>
      )}
    </Card>
  );
};

/** @internal */
const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  // Returns a new string made up of the first, and last, 8 characters of a given contract address.
  contractAddress ? (
    <span data-testid="board-address">
      0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;