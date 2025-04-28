// /Users/adimov/Developer/final/vibe/hooks/useRecordingFlow.ts
import * as recordingService from "@/services/recordingService";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import useStore from "../state/index";

// 1. Define the states for the recording flow
type RecordingFlowState =
	| "idle" // Initial state, ready to start
	| "checkingPermissions"
	| "creatingConversation" // Only if first recording step
	| "readyToRecord" // Permissions OK, conversation created (if needed)
	| "recording"
	| "stopping" // Hardware stop in progress
	| "savingIntent" // Saving recording URI to store after stop
	| "waitingForServerId" // Last step done, waiting for store mapping to trigger navigation
	| "complete" // Flow finished, ready for navigation
	| "error"; // An error occurred

interface UseRecordingFlowProps {
	modeId: string;
}

interface RecordingFlowResult {
	localId: string;
	recordMode: "separate" | "live";
	currentPartner: 1 | 2;
	flowState: RecordingFlowState; // Replaces isRecording, isProcessing, isFlowComplete
	error: string | null;
	isButtonDisabled: boolean; // Derived from flowState
	handleToggleMode: (index: number) => void;
	handleToggleRecording: () => Promise<void>;
	handleRetry?: () => void; // Optional: Add a retry handler for error state
	cleanup: () => Promise<void>;
}

// Helper for getting access to usage functionality without hooks
const getUsageHelper = () => {
	return {
		async checkCanCreateConversation(): Promise<boolean> {
			// Base implementation using store directly
			const store = useStore.getState();
			const usageStats = store.usageStats;

			// If no usage stats, we can't check properly
			if (!usageStats) {
				console.error(
					"[RecordingSession] No usage stats available to check conversation limit",
				);
				return false;
			}

			return usageStats.isSubscribed || usageStats.remainingConversations > 0;
		},
	};
};

// Define a class for a persistent recording session that will survive component unmounts
class RecordingSession {
	private static instance: RecordingSession | null = null;
	private _localId: string;
	private _recordMode: "separate" | "live" = "separate";
	private _currentPartner: 1 | 2 = 1;
	private _flowState: RecordingFlowState = "idle";
	private _error: string | null = null;
	private _lastRecordingUri: string | null = null;
	private _isAudioSetupComplete = false;
	private _modeId: string;
	private _operationInProgress = false;
	private _stateChangeCallbacks: ((state: RecordingFlowState) => void)[] = [];
	private _errorChangeCallbacks: ((error: string | null) => void)[] = [];

	private constructor(modeId: string) {
		this._localId = Crypto.randomUUID();
		this._modeId = modeId;
		console.log(
			`[RecordingSession] Created new session with localId=${this._localId}, modeId=${modeId}`,
		);
		this.setupAudio();
	}

	public static getInstance(modeId: string): RecordingSession {
		if (
			!RecordingSession.instance ||
			RecordingSession.instance._modeId !== modeId
		) {
			// Clean up previous instance if needed
			if (RecordingSession.instance) {
				RecordingSession.instance.cleanup().catch(console.error);
			}

			RecordingSession.instance = new RecordingSession(modeId);
		}
		return RecordingSession.instance;
	}

	public get localId(): string {
		return this._localId;
	}

	public get recordMode(): "separate" | "live" {
		return this._recordMode;
	}

	public get currentPartner(): 1 | 2 {
		return this._currentPartner;
	}

	public get flowState(): RecordingFlowState {
		return this._flowState;
	}

	public get error(): string | null {
		return this._error;
	}

	public get isAudioSetupComplete(): boolean {
		return this._isAudioSetupComplete;
	}

	public get modeId(): string {
		return this._modeId;
	}

	public get operationInProgress(): boolean {
		return this._operationInProgress;
	}

	private setFlowState(state: RecordingFlowState): void {
		if (this._flowState !== state) {
			console.log(
				`[RecordingSession] State change: ${this._flowState} -> ${state}`,
			);
			this._flowState = state;
			// Notify all subscribers
			for (const callback of this._stateChangeCallbacks) {
				callback(state);
			}
		}
	}

	private setError(error: string | null): void {
		if (this._error !== error) {
			console.log(
				`[RecordingSession] Error change: ${this._error} -> ${error}`,
			);
			this._error = error;
			// Notify all subscribers
			for (const callback of this._errorChangeCallbacks) {
				callback(error);
			}
		}
	}

	public onStateChange(
		callback: (state: RecordingFlowState) => void,
	): () => void {
		this._stateChangeCallbacks.push(callback);
		return () => {
			this._stateChangeCallbacks = this._stateChangeCallbacks.filter(
				(cb) => cb !== callback,
			);
		};
	}

	public onErrorChange(callback: (error: string | null) => void): () => void {
		this._errorChangeCallbacks.push(callback);
		return () => {
			this._errorChangeCallbacks = this._errorChangeCallbacks.filter(
				(cb) => cb !== callback,
			);
		};
	}

	public setRecordMode(mode: "separate" | "live"): void {
		this._recordMode = mode;
		this._currentPartner = 1;
	}

	private async setupAudio(): Promise<void> {
		console.log("[RecordingSession] Initializing Audio Mode Setup...");
		try {
			await recordingService.setupAudioMode();
			console.log("[RecordingSession] Audio mode setup SUCCESS.");
			this._isAudioSetupComplete = true;
			this.setFlowState("idle");
		} catch (err) {
			console.error("[RecordingSession] Audio mode setup FAILED:", err);
			this.setError("Failed to initialize audio recording");
			this.setFlowState("error");
			this._isAudioSetupComplete = true; // Mark setup as complete even though failed
		}
	}

	public async toggleRecording(): Promise<void> {
		if (this._operationInProgress) {
			console.warn(
				"[RecordingSession] Operation already in progress. Skipping toggleRecording request.",
			);
			return;
		}

		if (!this._isAudioSetupComplete) {
			console.warn(
				"[RecordingSession] toggleRecording called before audio setup complete. Ignoring.",
			);
			this.setError("Audio system is initializing, please wait.");
			return;
		}

		this._operationInProgress = true;
		this.setError(null);
		console.log(
			`[RecordingSession] toggleRecording called. Current state: ${this._flowState}`,
		);

		try {
			// Stop recording flow
			if (this._flowState === "recording") {
				console.log("[RecordingSession] Attempting to STOP recording...");
				this.setFlowState("stopping");

				const uri = await recordingService.stopRecording();
				if (!uri) throw new Error("Recording URI not found after stop");

				this._lastRecordingUri = uri;
				console.log(
					`[RecordingSession] Recording stopped successfully. URI: ${uri}`,
				);

				this.setFlowState("savingIntent");
				const audioKey =
					this._recordMode === "live"
						? "live"
						: this._currentPartner.toString();

				const store = useStore.getState();
				await store.saveUploadIntent(this._localId, uri, audioKey);
				console.log(
					`[RecordingSession] Saved upload intent for localId ${this._localId}, audioKey ${audioKey}`,
				);

				const isLastRecordingStep =
					this._recordMode === "live" ||
					(this._recordMode === "separate" && this._currentPartner === 2);

				if (isLastRecordingStep) {
					console.log("[RecordingSession] Last recording step finished.");
					const currentServerId =
						useStore.getState().localToServerIds[this._localId];
					console.log(
						`[RecordingSession] Setting state to ${currentServerId ? "complete" : "waitingForServerId"}`,
					);
					this.setFlowState(
						currentServerId ? "complete" : "waitingForServerId",
					);
				} else {
					this._currentPartner = 2;
					console.log(
						"[RecordingSession] Separate mode: Switched to Partner 2. Setting state to readyToRecord.",
					);
					this.setFlowState("readyToRecord");
				}
			}
			// Start recording flow
			else if (
				this._flowState === "idle" ||
				this._flowState === "readyToRecord"
			) {
				console.log("[RecordingSession] Attempting to START recording...");
				this.setFlowState("checkingPermissions");

				// Check usage
				console.log("[RecordingSession] START: Checking usage...");
				const usageHelper = getUsageHelper();
				const canCreate = await usageHelper.checkCanCreateConversation();

				if (!canCreate) {
					console.error(
						"[RecordingSession] START: Cannot create conversation (usage limit).",
					);
					throw new Error("Usage limit reached or subscription required");
				}
				console.log("[RecordingSession] START: Usage check passed.");

				// Check permissions
				console.log("[RecordingSession] START: Checking permissions...");
				const hasPermission = await recordingService.checkPermissions();

				if (!hasPermission) {
					console.error(
						"[RecordingSession] START: Microphone permission denied.",
					);
					throw new Error("Microphone permission denied");
				}
				console.log("[RecordingSession] START: Permissions check passed.");

				// Create conversation if needed
				const isFirstRecordingAttempt = this._currentPartner === 1;
				const existingServerId =
					useStore.getState().localToServerIds[this._localId];

				if (isFirstRecordingAttempt && !existingServerId) {
					console.log(
						`[RecordingSession] START: First recording attempt and no server ID. Creating conversation: localId=${this._localId}`,
					);
					console.log(
						"[RecordingSession] START: Setting state to creatingConversation",
					);
					this.setFlowState("creatingConversation");

					// Create conversation in background
					const store = useStore.getState();
					const creationPromise = store.createConversation(
						this._modeId,
						this._recordMode,
						this._localId,
					);

					// Set ready state before waiting for conversation creation
					console.log(
						"[RecordingSession] START: Setting state to readyToRecord",
					);
					this.setFlowState("readyToRecord");

					// Handle conversation creation result
					creationPromise
						.then(() => {
							console.log(
								`[RecordingSession] START: Conversation creation completed for localId: ${this._localId}.`,
							);
						})
						.catch((createErr) => {
							console.error(
								`[RecordingSession] START: Conversation creation error: ${createErr}. Recording will continue anyway.`,
							);
						});
				} else {
					console.log(
						`[RecordingSession] START: Not first recording attempt or server ID (${existingServerId}) exists. Skipping createConversation.`,
					);
					console.log(
						"[RecordingSession] START: Setting state to readyToRecord",
					);
					this.setFlowState("readyToRecord");
				}

				// Start recording
				console.log(
					"[RecordingSession] START: Calling recordingService.startRecording()...",
				);
				try {
					await recordingService.startRecording();
					console.log(
						"[RecordingSession] START: recordingService.startRecording() completed successfully.",
					);
					console.log("[RecordingSession] START: Setting state to recording");
					this.setFlowState("recording");
				} catch (startErr) {
					console.error(
						"[RecordingSession] START: startRecording failed:",
						startErr,
					);
					const message =
						startErr instanceof Error ? startErr.message : String(startErr);
					this.setError(`Failed to start recording: ${message}`);
					this.setFlowState("error");
					await recordingService.cleanupCurrentRecording();
					throw startErr; // Re-throw to be caught by outer catch
				}
			} else {
				console.warn(
					`[RecordingSession] toggleRecording called in unexpected state: ${this._flowState}`,
				);
			}
		} catch (err) {
			console.error(
				"[RecordingSession] Error during recording operation:",
				err,
			);
			const message = err instanceof Error ? err.message : String(err);
			this.setError(`Recording operation failed: ${message}`);
			this.setFlowState("error");
			await recordingService.cleanupCurrentRecording(
				this._lastRecordingUri || undefined,
			);
		} finally {
			this._operationInProgress = false;
		}
	}

	public async cleanup(): Promise<void> {
		console.log("[RecordingSession] cleanup: Starting session cleanup.");

		if (this._flowState === "recording") {
			try {
				console.log("[RecordingSession] cleanup: Stopping active recording.");
				await recordingService.stopRecording();
			} catch (err) {
				console.error(
					"[RecordingSession] cleanup: Error stopping recording:",
					err,
				);
			}
		}

		// Clean up any recording file
		await recordingService.cleanupCurrentRecording(
			this._lastRecordingUri || undefined,
		);
		this._lastRecordingUri = null;

		// Reset state but keep localId and modeId
		this._recordMode = "separate";
		this._currentPartner = 1;
		this._flowState = "idle";
		this._error = null;

		console.log("[RecordingSession] cleanup: Session reset to idle state.");
	}

	public retry(): void {
		if (this._flowState === "error") {
			console.log("[RecordingSession] Retrying after error.");
			this.setError(null);
			this.setFlowState("idle");
		}
	}

	public checkForUpdatedServerId(): void {
		if (this._flowState === "waitingForServerId") {
			const serverId = useStore.getState().localToServerIds[this._localId];
			if (serverId) {
				console.log(
					`[RecordingSession] Server ID ${serverId} detected while waiting. Transitioning to complete.`,
				);
				this.setFlowState("complete");
			}
		}
	}
}

export const useRecordingFlow = ({
	modeId,
}: UseRecordingFlowProps): RecordingFlowResult => {
	// Get or create the persistent session
	const sessionRef = useRef<RecordingSession | null>(null);
	if (!sessionRef.current) {
		sessionRef.current = RecordingSession.getInstance(modeId);
	}

	const session = sessionRef.current;

	// Local hook state that will sync with the persistent session
	const [flowState, setFlowState] = useState<RecordingFlowState>(
		session.flowState,
	);
	const [error, setError] = useState<string | null>(session.error);
	const mountedRef = useRef(true);

	// Subscribe to session state changes
	useEffect(() => {
		mountedRef.current = true;

		// Subscribe to session state changes
		const unsubscribeState = session.onStateChange((newState) => {
			if (mountedRef.current) {
				setFlowState(newState);
			}
		});

		// Subscribe to session error changes
		const unsubscribeError = session.onErrorChange((newError) => {
			if (mountedRef.current) {
				setError(newError);
			}
		});

		// Check for serverId updates to transition from waiting to complete
		const intervalId = setInterval(() => {
			if (mountedRef.current && session.flowState === "waitingForServerId") {
				session.checkForUpdatedServerId();
			}
		}, 500);

		// Cleanup
		return () => {
			mountedRef.current = false;
			unsubscribeState();
			unsubscribeError();
			clearInterval(intervalId);
		};
	}, [session]);

	// Derive button disabled state from FSM state and audio setup
	const isButtonDisabled =
		!["idle", "readyToRecord", "complete", "error"].includes(flowState) ||
		!session.isAudioSetupComplete ||
		session.operationInProgress;

	// Mode Toggle Handler
	const handleToggleMode = useCallback(
		(index: number) => {
			session.setRecordMode(index === 0 ? "separate" : "live");
		},
		[session],
	);

	// Recording Toggle Handler (now delegates to the session)
	const handleToggleRecording = useCallback(async () => {
		await session.toggleRecording();
	}, [session]);

	// Retry Handler
	const handleRetry = useCallback(() => {
		if (flowState === "error") {
			session.retry();
		}
	}, [flowState, session]);

	// Cleanup function
	const cleanup = useCallback(async () => {
		await session.cleanup();
	}, [session]);

	return {
		localId: session.localId,
		recordMode: session.recordMode,
		currentPartner: session.currentPartner,
		flowState,
		error,
		isButtonDisabled,
		handleToggleMode,
		handleToggleRecording,
		handleRetry: flowState === "error" ? handleRetry : undefined,
		cleanup,
	};
};
