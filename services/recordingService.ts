import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface RecordingInstance {
  recording: Audio.Recording;
  uri: string | null
}

let currentRecordingInstance: RecordingInstance | null = null;

export const checkPermissions = async (): Promise<boolean> => {
  try {
    const { status: currentStatus } = await Audio.getPermissionsAsync();
    if (currentStatus === 'granted') {
      return true;
    }
    const { status: newStatus } = await Audio.requestPermissionsAsync();
    return newStatus === 'granted';
  } catch (err) {
    return false;
  }
};

export const setupAudioMode = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
  } catch (err) {
    throw new Error('Failed to initialize audio recording session');
  }
};

export const cleanupAudioMode = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (err) {}
};

export const startRecording = async (): Promise<Audio.Recording> => {
  await cleanupCurrentRecording();

  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    throw new Error('Microphone permission denied');
  }

  let newRecording: Audio.Recording | null = null;
  try {
    newRecording = new Audio.Recording();
    await newRecording.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
        numberOfChannels: 1,
      },
      ios: {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
        numberOfChannels: 1,
      }
    });
    await newRecording.startAsync();
    currentRecordingInstance = { recording: newRecording, uri: null };
    return newRecording;
  } catch (err) {
    if (newRecording) {
        try {
          await newRecording.stopAndUnloadAsync();
        } catch (cleanupError) {}
    }
    currentRecordingInstance = null;
    throw new Error(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
  }
};

export const stopRecording = async (): Promise<string | null> => {
  const instanceToStop = currentRecordingInstance;

  if (!instanceToStop) {
    return null;
  }

  const { recording } = instanceToStop;

  try {
    const status = await recording.getStatusAsync();
    if (!status.isRecording) {
      await cleanupSpecificInstance(recording);
      currentRecordingInstance = null;
      return null;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch (stopError) {
      if (typeof recording._cleanupForUnloadedRecorder === 'function') {
        await recording._cleanupForUnloadedRecorder();
      } else
        {}
    }

    const uri = recording.getURI();
    currentRecordingInstance = null;
    return uri;
  } catch (err) {
    try {
      await cleanupSpecificInstance(recording);
    } catch (cleanupErr) {}
    currentRecordingInstance = null;
    return null;
  }
};

export const cleanupCurrentRecording = async (fileUriToDelete?: string): Promise<void> => {
  const instanceToClean = currentRecordingInstance;
  currentRecordingInstance = null;
  if (instanceToClean) {
    await cleanupSpecificInstance(instanceToClean.recording);
  } else
    {}

  if (fileUriToDelete) {
    await deleteFile(fileUriToDelete);
  }
};

async function cleanupSpecificInstance(recording: Audio.Recording): Promise<void> {
  try {
    await recording.stopAndUnloadAsync();
  } catch (err) {
    if (typeof recording._cleanupForUnloadedRecorder === 'function') {
       try {
         await recording._cleanupForUnloadedRecorder();
       } catch (cleanupErr) {}
    }
  }
}

async function deleteFile(fileUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } else {}
  } catch (deleteErr) {}
}