import {
  CallClient,
  LocalVideoStream,
  VideoStreamRenderer
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const BACKEND_TOKEN_URL =
  process.env.REACT_APP_BACKEND_TOKEN_URL || "https://hub-health-portalbackend.onrender.com/api/token";

const TEAMS_MEETING_LINK =
  process.env.REACT_APP_TEAMS_MEETING_LINK ||
  "https://teams.microsoft.com/meet/46235146178531?p=UavJ0b5R5f8k94QL1i";

let callClient = null;
let callAgent = null;
let deviceManager = null;
let activeCall = null;

let localVideoStream = null;
let localVideoRenderer = null;
let localVideoView = null;
let isLocalVideoStarted = false;

const remoteStreamRenderers = new Map();
const remoteParticipantListeners = new Map();

function validateMeetingLink(link) {
  if (!link || typeof link !== "string") {
    throw new Error("Missing Teams meeting link.");
  }

  const lower = link.toLowerCase();

  if (lower.includes("teams.live.com")) {
    throw new Error("Teams personal/life meetings are not supported.");
  }

  const isOldFormat = lower.includes("teams.microsoft.com/l/meetup-join/");
  const isNewFormat = lower.includes("teams.microsoft.com/meet/");

  if (!isOldFormat && !isNewFormat) {
    throw new Error("Invalid Teams meeting link.");
  }
}

async function getToken() {
  const tokenResponse = await fetch(BACKEND_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      displayName: "Guest User"
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(
      `Could not get ACS token from backend. HTTP ${tokenResponse.status}`
    );
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData?.token) {
    throw new Error("Backend did not return a valid token.");
  }

  return tokenData.token;
}

async function ensureClient() {
  if (!callClient) {
    callClient = new CallClient();
  }

  if (!deviceManager) {
    deviceManager = await callClient.getDeviceManager();

    try {
      await deviceManager.askDevicePermission({ audio: true, video: true });
    } catch (error) {
      console.warn("Device permission request failed:", error);
    }

    try {
      const microphones = await deviceManager.getMicrophones();
      const speakers = await deviceManager.getSpeakers();
      const cameras = await deviceManager.getCameras();

      console.log("Microphones:", microphones);
      console.log("Speakers:", speakers);
      console.log("Cameras:", cameras);

      if (microphones.length > 0) {
        await deviceManager.selectMicrophone(microphones[0]);
      }

      if (speakers.length > 0) {
        await deviceManager.selectSpeaker(speakers[0]);
      }
    } catch (error) {
      console.warn("Device enumeration/selection failed:", error);
    }
  }

  if (!callAgent) {
    const token = await getToken();
    const credential = new AzureCommunicationTokenCredential(token);

    callAgent = await callClient.createCallAgent(credential, {
      displayName: "Guest User"
    });
  }
}

async function createLocalVideoStreamIfNeeded() {
  await ensureClient();

  if (localVideoStream) {
    return localVideoStream;
  }

  const cameras = await deviceManager.getCameras();

  if (!cameras || cameras.length === 0) {
    throw new Error("No camera device found.");
  }

  localVideoStream = new LocalVideoStream(cameras[0]);
  return localVideoStream;
}

async function renderLocalVideo(container) {
  if (!container) return;

  const stream = await createLocalVideoStreamIfNeeded();

  if (!localVideoRenderer) {
    localVideoRenderer = new VideoStreamRenderer(stream);
  }

  if (!localVideoView) {
    localVideoView = await localVideoRenderer.createView();
  }

  localVideoView.target.style.width = "100%";
  localVideoView.target.style.height = "100%";
  localVideoView.target.style.objectFit = "cover";
  localVideoView.target.style.display = "block";
  localVideoView.target.style.backgroundColor = "#000";

  container.innerHTML = "";
  container.appendChild(localVideoView.target);
}

async function disposeLocalPreview() {
  try {
    if (localVideoView) {
      localVideoView.dispose();
      localVideoView = null;
    }
  } catch (error) {
    console.warn("Failed disposing local video view:", error);
  }

  try {
    if (localVideoRenderer) {
      localVideoRenderer.dispose();
      localVideoRenderer = null;
    }
  } catch (error) {
    console.warn("Failed disposing local video renderer:", error);
  }
}

async function renderRemoteVideoStream(remoteVideoStream, remoteVideosContainer) {
  if (!remoteVideosContainer) return;

  const streamKey = remoteVideoStream.id ?? `${Date.now()}-${Math.random()}`;

  if (remoteStreamRenderers.has(streamKey)) {
    return;
  }

  const renderer = new VideoStreamRenderer(remoteVideoStream);
  const view = await renderer.createView();

  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.maxWidth = "980px";
  wrapper.style.aspectRatio = "16 / 9";
  wrapper.style.background = "#000";
  wrapper.style.borderRadius = "20px";
  wrapper.style.overflow = "hidden";
  wrapper.style.border = "1px solid rgba(255,255,255,0.08)";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";

  view.target.style.width = "100%";
  view.target.style.height = "100%";
  view.target.style.objectFit = "cover";
  view.target.style.display = "block";

  wrapper.appendChild(view.target);

  remoteVideosContainer.innerHTML = "";
  remoteVideosContainer.appendChild(wrapper);

  remoteStreamRenderers.set(streamKey, {
    renderer,
    view,
    wrapper
  });
}

function disposeRemoteVideoStream(remoteVideoStream) {
  const streamKey = remoteVideoStream.id;

  if (!remoteStreamRenderers.has(streamKey)) {
    return;
  }

  const entry = remoteStreamRenderers.get(streamKey);

  try {
    entry.view?.dispose();
  } catch (error) {
    console.warn("Failed disposing remote video view:", error);
  }

  try {
    entry.renderer?.dispose();
  } catch (error) {
    console.warn("Failed disposing remote video renderer:", error);
  }

  try {
    entry.wrapper?.remove();
  } catch (error) {
    console.warn("Failed removing remote video wrapper:", error);
  }

  remoteStreamRenderers.delete(streamKey);
}

function clearAllRemoteVideos() {
  for (const [, entry] of remoteStreamRenderers) {
    try {
      entry.view?.dispose();
    } catch {}

    try {
      entry.renderer?.dispose();
    } catch {}

    try {
      entry.wrapper?.remove();
    } catch {}
  }

  remoteStreamRenderers.clear();
}

async function handleRemoteVideoStream(remoteVideoStream, remoteVideosContainer) {
  const tryRender = async () => {
    try {
      if (remoteVideoStream.isAvailable) {
        await renderRemoteVideoStream(remoteVideoStream, remoteVideosContainer);
      } else {
        disposeRemoteVideoStream(remoteVideoStream);
      }
    } catch (error) {
      console.error("Remote video render failed:", error);
    }
  };

  remoteVideoStream.on("isAvailableChanged", tryRender);

  if (remoteVideoStream.isAvailable) {
    await tryRender();
  }
}

async function subscribeToParticipant(participant, remoteVideosContainer) {
  console.log("Participant connected:", participant);
  console.log("participant.isMuted:", participant.isMuted);
  console.log("participant.state:", participant.state);
  console.log("participant.displayName:", participant.displayName);

  const onMutedChanged = () => {
    console.log("Remote participant muted changed:", participant.isMuted);
  };

  const onStateChanged = () => {
    console.log("Remote participant state changed:", participant.state);
  };

  const onVideoStreamsUpdated = (e) => {
    e.added.forEach(async (stream) => {
      await handleRemoteVideoStream(stream, remoteVideosContainer);
    });

    e.removed.forEach((stream) => {
      disposeRemoteVideoStream(stream);
    });
  };

  participant.on("isMutedChanged", onMutedChanged);
  participant.on("stateChanged", onStateChanged);
  participant.on("videoStreamsUpdated", onVideoStreamsUpdated);

  const participantKey =
    participant.identifier?.rawId ||
    participant.identifier?.communicationUserId ||
    participant.identifier?.microsoftTeamsUserId ||
    `${Date.now()}-${Math.random()}`;

  remoteParticipantListeners.set(participantKey, {
    participant,
    onMutedChanged,
    onStateChanged,
    onVideoStreamsUpdated
  });

  participant.videoStreams.forEach(async (stream) => {
    await handleRemoteVideoStream(stream, remoteVideosContainer);
  });
}

function clearParticipantListeners() {
  for (const [, entry] of remoteParticipantListeners) {
    try {
      entry.participant.off("isMutedChanged", entry.onMutedChanged);
    } catch {}

    try {
      entry.participant.off("stateChanged", entry.onStateChanged);
    } catch {}

    try {
      entry.participant.off("videoStreamsUpdated", entry.onVideoStreamsUpdated);
    } catch {}
  }

  remoteParticipantListeners.clear();
}

export async function joinCall({
  localVideoContainer,
  remoteVideosContainer,
  onStateChanged,
  onMutedChanged,
  onParticipantsChanged
} = {}) {
  validateMeetingLink(TEAMS_MEETING_LINK);
  await ensureClient();

  if (activeCall && activeCall.state && activeCall.state !== "Disconnected") {
    if (typeof onStateChanged === "function") {
      onStateChanged(activeCall.state, activeCall);
    }
    return activeCall;
  }

  activeCall = callAgent.join(
    { meetingLink: TEAMS_MEETING_LINK },
    {
      audioOptions: { muted: false }
    }
  );

  activeCall.on("stateChanged", async () => {
    console.log("Call state:", activeCall.state);
    console.log("Remote participants count:", activeCall.remoteParticipants.length);

    if (
      activeCall.state === "Connected" &&
      localVideoContainer &&
      !isLocalVideoStarted
    ) {
      try {
        const stream = await createLocalVideoStreamIfNeeded();
        await renderLocalVideo(localVideoContainer);
        await activeCall.startVideo(stream);
        isLocalVideoStarted = true;
      } catch (error) {
        console.error("Auto-start local video failed:", error);
      }
    }

    if (typeof onStateChanged === "function") {
      onStateChanged(activeCall.state, activeCall);
    }
  });

  activeCall.on("isMutedChanged", () => {
    console.log("Local muted:", activeCall.isMuted);

    if (typeof onMutedChanged === "function") {
      onMutedChanged(activeCall.isMuted, activeCall);
    }
  });

  activeCall.on("remoteParticipantsUpdated", (e) => {
    console.log("Remote participants updated:", e);

    e.added.forEach(async (participant) => {
      await subscribeToParticipant(participant, remoteVideosContainer);
    });

    e.removed.forEach((participant) => {
      console.log("Remote participant removed:", participant);
    });

    if (typeof onParticipantsChanged === "function") {
      onParticipantsChanged(activeCall.remoteParticipants, activeCall);
    }
  });

  activeCall.remoteParticipants.forEach(async (participant) => {
    await subscribeToParticipant(participant, remoteVideosContainer);
  });

  if (typeof onStateChanged === "function") {
    onStateChanged(activeCall.state, activeCall);
  }

  if (typeof onMutedChanged === "function") {
    onMutedChanged(activeCall.isMuted, activeCall);
  }

  if (typeof onParticipantsChanged === "function") {
    onParticipantsChanged(activeCall.remoteParticipants, activeCall);
  }

  return activeCall;
}

export async function startMyVideo(localVideoContainer) {
  if (!activeCall) {
    throw new Error("No active call.");
  }

  if (isLocalVideoStarted) {
    return;
  }

  const stream = await createLocalVideoStreamIfNeeded();
  await renderLocalVideo(localVideoContainer);
  await activeCall.startVideo(stream);
  isLocalVideoStarted = true;
}

export async function stopMyVideo() {
  if (!activeCall || !localVideoStream || !isLocalVideoStarted) {
    return;
  }

  try {
    await activeCall.stopVideo(localVideoStream);
  } catch (error) {
    console.warn("stopMyVideo failed:", error);
  }

  await disposeLocalPreview();
  isLocalVideoStarted = false;
}

export async function muteMyAudio() {
  if (!activeCall) {
    throw new Error("No active call.");
  }

  if (!activeCall.isMuted) {
    await activeCall.mute();
  }
}

export async function unmuteMyAudio() {
  if (!activeCall) {
    throw new Error("No active call.");
  }

  if (activeCall.isMuted) {
    await activeCall.unmute();
  }
}

export function getCallState() {
  return activeCall?.state ?? "Disconnected";
}

export function isMyAudioMuted() {
  return activeCall?.isMuted ?? false;
}

export function isVideoStarted() {
  return isLocalVideoStarted;
}

export async function leaveCall() {
  if (!activeCall) {
    return;
  }

  const callToClose = activeCall;
  activeCall = null;

  try {
    if (localVideoStream && isLocalVideoStarted) {
      try {
        await callToClose.stopVideo(localVideoStream);
      } catch (error) {
        console.warn("stopVideo during leave failed:", error);
      }
    }

    try {
      await callToClose.hangUp();
    } catch (error) {
      console.warn("hangUp failed:", error);
    }
  } finally {
    try {
      await disposeLocalPreview();
    } catch (error) {
      console.warn("disposeLocalPreview failed:", error);
    }

    try {
      clearAllRemoteVideos();
    } catch (error) {
      console.warn("clearAllRemoteVideos failed:", error);
    }

    try {
      clearParticipantListeners();
    } catch (error) {
      console.warn("clearParticipantListeners failed:", error);
    }

    localVideoStream = null;
    localVideoRenderer = null;
    localVideoView = null;
    isLocalVideoStarted = false;
  }
}
