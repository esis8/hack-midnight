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
import { BBoardPrivateState } from '../../../contract/src/index';
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
    <Card sx={{ position: 'relative', width: 420, height: 420, minWidth: 420, minHeight: 420 }} color="primary">
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
            sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="board-error-message">
              {errorMessage}
            </Typography>
          </Backdrop>

          <CardHeader
            titleTypographyProps={{ color: 'primary' }}
            title={boardState ? (boardState.title ?? 'Loading…') : 'Loading…'}
            subheader={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? undefined}
            action={
              deployedBoardAPI?.deployedContractAddress ? (
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
          />

          <CardContent>
            {/* Editor de título + botón Save (mismo ancho que el mensaje) */}
            {boardState ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <TextField
                  fullWidth
                  label="Board title"
                  value={titleEditValue}
                  onChange={(e) => setTitleEditValue(e.target.value)}
                  size="small"
                  color="primary"
                  inputProps={{ 'data-testid': 'board-title-input', style: { color: 'black' } }}
                  placeholder={'Set board title'}
                  disabled={!canPublish || isWorking}
                />
                {canPublish && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={onSavePublish}
                    data-testid="board-publish-save-btn"
                    disabled={
                      isWorking || !(titleEditValue ?? '').trim().length || !(messagePrompt ?? '').trim().length
                    }
                  >
                    Save
                  </Button>
                )}
              </div>
            ) : (
              <Skeleton variant="rectangular" width={380} height={44} style={{ marginBottom: 12 }} />
            )}

            {/* Área de mensaje: mismo ancho; editable sólo antes de publicar */}
            {boardState ? (
              !boardState.message ? (
                <TextField
                  id="message-prompt"
                  data-testid="board-message-prompt"
                  variant="outlined"
                  focused
                  fullWidth
                  multiline
                  minRows={10}
                  maxRows={10}
                  placeholder="Message to post"
                  size="small"
                  color="primary"
                  inputProps={{ style: { color: 'black' } }}
                  value={messagePrompt}
                  onChange={(e) => setMessagePrompt(e.target.value)}
                  disabled={!canPublish || isWorking}
                />
              ) : (
                <Typography data-testid="board-posted-message" minHeight={240} color="primary">
                  {boardState.message}
                  {' ('}
                  <Button
                    onClick={() => onVote(true)}
                    style={{ cursor: 'pointer' }}
                    title="Vote up"
                    disabled={isWorking || !deployedBoardAPI}
                    data-testid="vote-up-btn"
                  >
                    👍 {boardState ? String(privateState?.trueCount) : '?'}
                  </Button>
                  {' | '}
                  <Button
                    onClick={() => onVote(false)}
                    style={{ cursor: 'pointer' }}
                    title="Vote down"
                    disabled={isWorking || !deployedBoardAPI}
                    data-testid="vote-down-btn"
                  >
                    👎 {boardState ? String(privateState?.falseCount) : '?'}
                  </Button>
                  {')'}
                </Typography>
              )
            ) : (
              <Skeleton variant="rectangular" width={380} height={240} />
            )}
          </CardContent>

          <CardActions>{/* No actions after publish-once */}</CardActions>
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
