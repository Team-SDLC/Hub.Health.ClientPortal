import React, { useRef, useState } from "react";
import {
  joinCall,
  leaveCall,
  startMyVideo,
  stopMyVideo,
  muteMyAudio,
  unmuteMyAudio,
  isVideoStarted
} from "./VideoCall";

function getReadableStatus(callState) {
  switch (callState) {
    case "Connecting":
      return "Joining meeting...";
    case "InLobby":
      return "You are in the lobby. Waiting to be admitted...";
    case "Connected":
      return "Connected to the Teams meeting.";
    case "Disconnecting":
      return "Leaving call...";
    case "Disconnected":
      return "Call ended.";
    default:
      return callState || "Ready";
  }
}

function getStatusColor(callState) {
  switch (callState) {
    case "Connected":
      return {
        background: "#e8fff1",
        color: "#0f9f57",
        border: "1px solid #b7efcc"
      };
    case "Connecting":
    case "InLobby":
      return {
        background: "#fff7e8",
        color: "#b76e00",
        border: "1px solid #f4d79b"
      };
    case "Disconnected":
      return {
        background: "#f5f5f5",
        color: "#666",
        border: "1px solid #e3e3e3"
      };
    default:
      return {
        background: "#eef3ff",
        color: "#315efb",
        border: "1px solid #cfdcff"
      };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f5f7fb 0%, #eef2f9 100%)",
    padding: "32px 20px",
    fontFamily: 'Inter, Arial, "Segoe UI", Roboto, sans-serif'
  },
  shell: {
    width: "1500px",
    maxWidth: "100%",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "28px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
    border: "1px solid #e9edf5",
    overflow: "hidden"
  },
  hero: {
    padding: "38px 40px 26px 40px",
    background: "linear-gradient(135deg, #ffffff 0%, #f7faff 100%)",
    borderBottom: "1px solid #edf1f7"
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#315efb",
    background: "#eef3ff",
    border: "1px solid #dbe5ff",
    marginBottom: "18px"
  },
  title: {
    margin: 0,
    fontSize: "56px",
    lineHeight: 1.05,
    color: "#0f172a",
    letterSpacing: "-1.5px"
  },
  subtitle: {
    marginTop: "14px",
    marginBottom: 0,
    fontSize: "20px",
    lineHeight: 1.6,
    color: "#5b6475",
    maxWidth: "860px"
  },
  topBar: {
    padding: "22px 40px 0 40px"
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px"
  },
  primaryButton: {
    padding: "14px 22px",
    borderRadius: "14px",
    border: "none",
    background: "#315efb",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(49, 94, 251, 0.22)"
  },
  secondaryButton: {
    padding: "14px 22px",
    borderRadius: "14px",
    border: "1px solid #dbe1ea",
    background: "#fff",
    color: "#172033",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer"
  },
  dangerButton: {
    padding: "14px 22px",
    borderRadius: "14px",
    border: "1px solid #ffd2d2",
    background: "#fff5f5",
    color: "#d92d20",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer"
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
    boxShadow: "none"
  },
  statusWrap: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "14px"
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 16px",
    borderRadius: "999px",
    fontSize: "15px",
    fontWeight: 700
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: "24px",
    padding: "10px 40px 40px 40px",
    alignItems: "start"
  },
  card: {
    background: "#fff",
    border: "1px solid #e8edf5",
    borderRadius: "24px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)"
  },
  detailsCard: {
    padding: "24px"
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "26px",
    color: "#111827",
    letterSpacing: "-0.4px"
  },
  statList: {
    display: "grid",
    gap: "14px",
    marginBottom: "28px"
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #edf2f7"
  },
  statLabel: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#667085"
  },
  statValue: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#111827"
  },
  localVideoFrame: {
    width: "100%",
    height: "300px",
    background: "linear-gradient(180deg, #10131a 0%, #05070b 100%)",
    borderRadius: "22px",
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#cfd6e4",
    fontSize: "16px",
    position: "relative",
    border: "1px solid rgba(255,255,255,0.06)"
  },
  remoteCard: {
    padding: "24px"
  },
  remoteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "18px",
    flexWrap: "wrap"
  },
  helperText: {
    margin: 0,
    fontSize: "15px",
    color: "#667085"
  },
  remoteFrame: {
    minHeight: "540px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #0c111b 0%, #111827 100%)",
    overflow: "hidden",
    border: "1px solid #1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  remoteVideosHost: {
    width: "100%",
    minHeight: "540px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px"
  },
  emptyState: {
    color: "#b8c1d1",
    fontSize: "18px",
    textAlign: "center",
    maxWidth: "420px",
    lineHeight: 1.6,
    padding: "20px"
  }
};

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [callState, setCallState] = useState("None");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(null);

  const handleJoin = async () => {
    try {
      setLoading(true);
      setStatus("Joining meeting...");

      await joinCall({
        localVideoContainer: localVideoRef.current,
        remoteVideosContainer: remoteVideosRef.current,
        onStateChanged: (newState, call) => {
          setCallState(newState);
          setStatus(getReadableStatus(newState));

          if (typeof call?.isMuted === "boolean") {
            setIsMuted(call.isMuted);
          }

          if (newState === "Connected") {
            setIsVideoOn(true);
          }

          if (newState === "Disconnected") {
            setIsVideoOn(false);
            setIsMuted(false);
            setRemoteParticipantCount(0);
          }
        },
        onMutedChanged: (muted) => {
          setIsMuted(muted);
        },
        onParticipantsChanged: (participants) => {
          setRemoteParticipantCount(participants?.length || 0);
        }
      });
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to join meeting.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      setLoading(true);
      setIsLeaving(true);

      await leaveCall();
      await sleep(800);

      setCallState("Disconnected");
      setStatus("Call ended.");
      setRemoteParticipantCount(0);
      setIsMuted(false);
      setIsVideoOn(false);

      if (remoteVideosRef.current) {
        remoteVideosRef.current.innerHTML = "";
      }

      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = "";
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to leave call.");
    } finally {
      setLoading(false);
      setIsLeaving(false);
    }
  };

  const handleMuteAudio = async () => {
    try {
      await muteMyAudio();
      setIsMuted(true);
      setStatus("Microphone muted.");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not mute microphone.");
    }
  };

  const handleUnmuteAudio = async () => {
    try {
      await unmuteMyAudio();
      setIsMuted(false);
      setStatus("Microphone unmuted.");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not unmute microphone.");
    }
  };

  const handleUnblockVideo = async () => {
    try {
      if (isVideoStarted()) {
        setIsVideoOn(true);
        return;
      }

      await startMyVideo(localVideoRef.current);
      setIsVideoOn(true);
      setStatus("Camera turned on.");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not turn on camera.");
    }
  };

  const handleBlockVideo = async () => {
    try {
      await stopMyVideo();
      setIsVideoOn(false);
      setStatus("Camera turned off.");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not turn off camera.");
    }
  };

  const isConnected = callState === "Connected" || callState === "InLobby";
  const statusStyle = getStatusColor(callState);

  const getButtonStyle = (type, disabled = false) => {
    const base =
      type === "primary"
        ? styles.primaryButton
        : type === "danger"
        ? styles.dangerButton
        : styles.secondaryButton;

    return disabled ? { ...base, ...styles.disabledButton } : base;
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Live consultation room</div>

          <h1 style={styles.title}>Video Consultation</h1>

          <p style={styles.subtitle}>
            Join the Teams meeting, manage your microphone and camera, and keep
            the consultation space clean and easy to use.
          </p>
        </div>

        <div style={styles.topBar}>
          <div style={styles.actions}>
            <button
              onClick={handleJoin}
              disabled={loading || isConnected || isLeaving}
              style={getButtonStyle(
                "primary",
                loading || isConnected || isLeaving
              )}
            >
              Join Call
            </button>

            <button
              onClick={handleLeave}
              disabled={loading || !isConnected}
              style={getButtonStyle("danger", loading || !isConnected)}
            >
              Leave Call
            </button>

            <button
              onClick={handleMuteAudio}
              disabled={!isConnected || isMuted}
              style={getButtonStyle("secondary", !isConnected || isMuted)}
            >
              Mute Mic
            </button>

            <button
              onClick={handleUnmuteAudio}
              disabled={!isConnected || !isMuted}
              style={getButtonStyle("secondary", !isConnected || !isMuted)}
            >
              Unmute Mic
            </button>

            <button
              onClick={handleUnblockVideo}
              disabled={!isConnected || isVideoOn}
              style={getButtonStyle("secondary", !isConnected || isVideoOn)}
            >
              Turn Camera On
            </button>

            <button
              onClick={handleBlockVideo}
              disabled={!isConnected || !isVideoOn}
              style={getButtonStyle("secondary", !isConnected || !isVideoOn)}
            >
              Turn Camera Off
            </button>
          </div>

          <div style={styles.statusWrap}>
            <div style={{ ...styles.statusPill, ...statusStyle }}>
              {status}
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={{ ...styles.card, ...styles.detailsCard }}>
            <h3 style={styles.sectionTitle}>Call details</h3>

            <div style={styles.statList}>
              <div style={styles.statRow}>
                <span style={styles.statLabel}>Call state</span>
                <span style={styles.statValue}>{callState}</span>
              </div>

              <div style={styles.statRow}>
                <span style={styles.statLabel}>Microphone</span>
                <span style={styles.statValue}>
                  {isMuted ? "Muted" : "Live"}
                </span>
              </div>

              <div style={styles.statRow}>
                <span style={styles.statLabel}>Remote participants</span>
                <span style={styles.statValue}>{remoteParticipantCount}</span>
              </div>

              <div style={styles.statRow}>
                <span style={styles.statLabel}>Camera</span>
                <span style={styles.statValue}>
                  {isVideoOn ? "On" : "Off"}
                </span>
              </div>
            </div>

            <h3 style={styles.sectionTitle}>My video</h3>

            <div ref={localVideoRef} style={styles.localVideoFrame}>
              {!isVideoOn ? "Your camera preview will appear here" : null}
            </div>
          </div>

          <div style={{ ...styles.card, ...styles.remoteCard }}>
            <div style={styles.remoteHeader}>
              <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
                Remote video
              </h3>

              <p style={styles.helperText}>
                {remoteParticipantCount > 0
                  ? "Participant connected"
                  : "Waiting for participant"}
              </p>
            </div>

            <div style={styles.remoteFrame}>
              <div ref={remoteVideosRef} style={styles.remoteVideosHost} />

              {remoteParticipantCount === 0 && (
                <div style={styles.emptyState}>
                  No remote participant video yet. Once someone joins with their
                  camera on, the video will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}