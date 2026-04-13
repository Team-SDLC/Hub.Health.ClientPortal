import {
  CallClient,
  LocalVideoStream,
  VideoStreamRenderer
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const BACKEND_TOKEN_URL = "http://localhost:3001/api/token";

const TEAMS_MEETING_LINK =
  "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MjBiNjMyN2EtZGJhMC00MzA0LWI2MjEtZWJhOTA2NWM2NWU4%40thread.v2/0?context=%7b%22Tid%22%3a%22dc0b52a3-68c5-44f7-881d-9383d8850b96%22%2c%22Oid%22%3a%22c93f4ad1-6486-487a-9800-d42f3dd9c8ec%22%7d";

let callClient = null;
let callAgent = null;
let deviceManager = null;
let activeCall = null;

let localVideoStream = null;
let localVideoRenderer = null;
let localVideoView = null;

const remoteStreamRenderers = new Map();

function validateMeetingLink(link) {
  if (!link || typeof link !== "string") {
    throw new Error("Missing Teams meeting link.");
  }

  const lower = link.toLowerCase();

  if (!lower.includes("teams.microsoft.com/l/meetup-join/")) {
    throw new Error("Invalid Teams meeting link.");
  }

  if (lower.includes("teams.live.com")) {
    throw new Error("Teams personal/life meetings are not supported.");
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
    throw new Error(`Could not get ACS token from backend. HTTP ${tokenResponse.status}`);
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
  wrapper.style.width = "320px";
  wrapper.style.height = "240px";
  wrapper.style.background = "#000";
  wrapper.style.borderRadius = "12px";
  wrapper.style.overflow = "hidden";
  wrapper.style.border = "1px solid #ddd";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";

  wrapper.appendChild(view.target);
  remoteVideosContainer.appendChild(wrapper);

  remoteStreamRenderers.set(streamKey, {
    renderer,
    view,
    wrapper
  });
}

function disposeRemoteVideoStream(remoteVideoStream) {
  const streamKey = remoteVideoStream.id;

  if (!remoteStreamRenderers.has(streamKey)) return;

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
  participant.videoStreams.forEach(async (stream) => {
    await handleRemoteVideoStream(stream, remoteVideosContainer);
  });

  participant.on("videoStreamsUpdated", (e) => {
    e.added.forEach(async (stream) => {
      await handleRemoteVideoStream(stream, remoteVideosContainer);
    });

    e.removed.forEach((stream) => {
      disposeRemoteVideoStream(stream);
    });
  });
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

  activeCall.on("stateChanged", () => {
    console.log("Call state:", activeCall.state);
    if (typeof onStateChanged === "function") {
      onStateChanged(activeCall.state, activeCall);
    }
  });

  activeCall.on("isMutedChanged", () => {
    console.log("Muted:", activeCall.isMuted);
    if (typeof onMutedChanged === "function") {
      onMutedChanged(activeCall.isMuted, activeCall);
    }
  });

  activeCall.on("remoteParticipantsUpdated", (e) => {
    console.log("Remote participants updated:", e);

    e.added.forEach(async (participant) => {
      await subscribeToParticipant(participant, remoteVideosContainer);
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

  if (typeof onParticipantsChanged === "function") {
    onParticipantsChanged(activeCall.remoteParticipants, activeCall);
  }

  console.log("Join started.");

  return activeCall;
}

export async function startMyVideo(localVideoContainer) {
  if (!activeCall) {
    throw new Error("No active call.");
  }

  const stream = await createLocalVideoStreamIfNeeded();
  await renderLocalVideo(localVideoContainer);
  await activeCall.startVideo(stream);
}

export async function stopMyVideo() {
  if (!activeCall || !localVideoStream) {
    return;
  }

  await activeCall.stopVideo(localVideoStream);
  await disposeLocalPreview();
}

export async function leaveCall() {
  if (!activeCall) return;

  try {
    if (localVideoStream) {
      try {
        await activeCall.stopVideo(localVideoStream);
      } catch {}
    }

    await activeCall.hangUp();
  } finally {
    await disposeLocalPreview();
    clearAllRemoteVideos();
    activeCall = null;
  }
}