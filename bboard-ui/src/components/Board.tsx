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
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import { type BBoardDerivedState, type DeployedBBoardAPI } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { BBoardPrivateState, State } from '../../../contract/src/index';
import { EmptyCardContent } from './Board.EmptyCardContent';

/** The props required by the {@link Board} component. */
export interface BoardProps {
  /** The observable bulletin board deployment. */
  boardDeployment$?: Observable<BoardDeployment>;
}

/**
 * Provides the UI for a deployed bulletin board contract; allowing a single publish (title+message).
 */
export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedBBoardAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<BBoardDerivedState>();
  const [messagePrompt, setMessagePrompt] = useState<string>('');
  const [privateState, setPrivateState] = useState<BBoardPrivateState>();

  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  // Inline title editor state
  const [titleEditValue, setTitleEditValue] = useState<string>('');

  // Deploy / Join callbacks
  const onCreateBoard = useCallback(() => boardApiProvider.resolve(), [boardApiProvider]);
  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) => boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(deployedBoardAPI.deployedContractAddress);
    }
  }, [deployedBoardAPI]);

  const onVote = useCallback(
    async (choice: boolean) => {
      try {
        if (!deployedBoardAPI) return;
        setIsWorking(true);
        await deployedBoardAPI.vote(choice);
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
      }
    },
    [deployedBoardAPI],
  );

  // Se puede publicar si todavía no existe título ni mensaje en el ledger
  const canPublish = !!boardState && !boardState.title && !boardState.message;

  // Publicar título + mensaje (una sola vez)
  const onSavePublish = useCallback(async () => {
    try {
      if (!deployedBoardAPI || !boardState) return;
      const titleTrimmed = (titleEditValue ?? '').trim();
      const msgTrimmed = (messagePrompt ?? '').trim();
      if (!titleTrimmed.length || !msgTrimmed.length) return;

      setIsWorking(true);
      await deployedBoardAPI.setPublishOne(titleTrimmed, msgTrimmed);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, boardState, titleEditValue, messagePrompt, setIsWorking, setErrorMessage]);

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

  // Sincroniza inputs locales con el ledger después de publicar
  useEffect(() => {
    setTitleEditValue(boardState?.title ?? '');
    setMessagePrompt(boardState?.message ?? '');
  }, [boardState?.title, boardState?.message]);

  return (
    <Card
      sx={{
        position: 'relative',
        width: 480,
        minHeight: 460,
        borderRadius: 3,
        background: 'linear-gradient(145deg, #0f0f0f, #1c1c1c)',
        color: '#e0e0e0',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      }}
    >
      {!boardDeployment$ && (
        <EmptyCardContent onCreateBoardCallback={onCreateBoard} onJoinBoardCallback={onJoinBoard} />
      )}

      {boardDeployment$ && (
        <>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="board-working-indicator" />
          </Backdrop>
          <Backdrop
            sx={{ position: 'absolute', color: '#ff4d4d', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 500 }} data-testid="board-error-message">
              {errorMessage}
            </Typography>
          </Backdrop>

          <CardHeader
            titleTypographyProps={{ sx: { color: '#fff', fontSize: '1.3rem', fontWeight: 600 } }}
            subheaderTypographyProps={{ sx: { color: '#aaa', fontSize: '0.9rem' } }}
            title={boardState ? (boardState.title ?? 'Loading…') : 'Loading…'}
            subheader={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? undefined}
            action={
              deployedBoardAPI?.deployedContractAddress ? (
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon sx={{ color: '#bbb' }} />
                </IconButton>
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
          />

          <CardContent sx={{ px: 3, pb: 3 }}>
            {/* Title editor */}
            {boardState ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <TextField
                  fullWidth
                  label="Board title"
                  value={titleEditValue}
                  onChange={(e) => setTitleEditValue(e.target.value)}
                  size="medium"
                  variant="outlined"
                  InputProps={{
                    style: { color: '#fff', fontSize: '1rem' },
                  }}
                  InputLabelProps={{ style: { color: '#d6d6d6' } }}
                  placeholder={'Set board title'}
                  disabled={!canPublish || isWorking}
                />
                {canPublish && (
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ height: 44, borderRadius: 2 }}
                    onClick={onSavePublish}
                    data-testid="board-publish-save-btn"
                    disabled={
                      isWorking || !(titleEditValue ?? '').trim().length || !(messagePrompt ?? '').trim().length
                    }
                  >
                    Create
                  </Button>
                )}
              </div>
            ) : (
              <Skeleton variant="rectangular" width={420} height={48} sx={{ mb: 2 }} />
            )}

            {/* Message */}
            {boardState ? (
              !boardState.message ? (
                <TextField
                  id="message-prompt"
                  data-testid="board-message-prompt"
                  variant="outlined"
                  fullWidth
                  multiline
                  minRows={8}
                  maxRows={8}
                  placeholder="Message to post"
                  InputProps={{ style: { color: '#fff', fontSize: '1rem' } }}
                  InputLabelProps={{ style: { color: '#aaa1a1' } }}
                  value={messagePrompt}
                  onChange={(e) => setMessagePrompt(e.target.value)}
                  disabled={!canPublish || isWorking}
                />
              ) : (
                <Typography
                  data-testid="board-posted-message"
                  sx={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#ddd', minHeight: 220 }}
                >
                  {boardState.message}
                  <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                    <Button
                      onClick={() => onVote(true)}
                      sx={{ bgcolor: '#197e05', color: 'white', borderRadius: 2, '&:hover': { bgcolor: '#1565c0' } }}
                      disabled={isWorking || !deployedBoardAPI}
                      data-testid="vote-up-btn"
                    >
                      👍 {boardState ? String(privateState?.trueCount) : '?'}
                    </Button>
                    <Button
                      onClick={() => onVote(false)}
                      sx={{ bgcolor: '#e53935', color: 'white', borderRadius: 2, '&:hover': { bgcolor: '#c62828' } }}
                      disabled={isWorking || !deployedBoardAPI}
                      data-testid="vote-down-btn"
                    >
                      👎 {boardState ? String(privateState?.falseCount) : '?'}
                    </Button>
                    {boardState.result && (
                      <span style={{ alignSelf: 'center', fontWeight: 600, color: '#aaa' }}>
                        Result:{' '}
                        {(boardState.result as State) === 0
                          ? 'Approved'
                          : boardState.result === State.DISAPPROVED
                            ? 'Disapproved'
                            : boardState.result === State.DRAW
                              ? 'Draw'
                              : boardState.result}
                      </span>
                    )}
                  </div>
                </Typography>
              )
            ) : (
              <Skeleton variant="rectangular" width={420} height={220} />
            )}
          </CardContent>

          <CardActions />
        </>
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
