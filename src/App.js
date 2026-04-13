import React, { useRef, useState } from "react";
import {
  joinCall,
  leaveCall,
  startMyVideo,
  stopMyVideo
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

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [callState, setCallState] = useState("None");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

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
      await leaveCall();
      setCallState("Disconnected");
      setStatus("Call ended.");
      setRemoteParticipantCount(0);
      setIsMuted(false);
      setIsVideoOn(false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to leave call.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartVideo = async () => {
    try {
      await startMyVideo(localVideoRef.current);
      setIsVideoOn(true);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not start camera.");
    }
  };

  const handleStopVideo = async () => {
    try {
      await stopMyVideo();
      setIsVideoOn(false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not stop camera.");
    }
  };

  const isConnected = callState === "Connected" || callState === "InLobby";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f3f3",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "30px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          width: "1450px",
          maxWidth: "96%",
          background: "#fff",
          borderRadius: "28px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: "40px"
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "82px",
            marginTop: "10px",
            marginBottom: "22px"
          }}
        >
          Video Consultation
        </h1>

        <p
          style={{
            textAlign: "center",
            fontSize: "28px",
            marginBottom: "28px"
          }}
        >
          Click below to join the Teams meeting from this React app.
        </p>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <button
            onClick={handleJoin}
            disabled={loading || isConnected}
            style={{ padding: "14px 28px", fontSize: "22px", marginRight: "12px" }}
          >
            Join Call
          </button>

          <button
            onClick={handleLeave}
            disabled={loading || !isConnected}
            style={{ padding: "14px 28px", fontSize: "22px", marginRight: "12px" }}
          >
            Leave Call
          </button>

          <button
            onClick={handleStartVideo}
            disabled={!isConnected || isVideoOn}
            style={{ padding: "14px 28px", fontSize: "22px", marginRight: "12px" }}
          >
            Start My Video
          </button>

          <button
            onClick={handleStopVideo}
            disabled={!isConnected || !isVideoOn}
            style={{ padding: "14px 28px", fontSize: "22px" }}
          >
            Stop My Video
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: "24px",
            marginBottom: "24px"
          }}
        >
          {status}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "420px 1fr",
            gap: "24px",
            alignItems: "start"
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "18px",
              padding: "18px",
              background: "#fafafa"
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "28px" }}>Call details</h3>

            <p style={{ fontSize: "22px" }}>
              <strong>Call state:</strong> {callState}
            </p>

            <p style={{ fontSize: "22px" }}>
              <strong>Muted:</strong> {isMuted ? "Yes" : "No"}
            </p>

            <p style={{ fontSize: "22px" }}>
              <strong>Remote participants:</strong> {remoteParticipantCount}
            </p>

            <h3 style={{ fontSize: "28px", marginTop: "24px" }}>My video</h3>

            <div
              ref={localVideoRef}
              style={{
                width: "100%",
                height: "260px",
                background: "#111",
                borderRadius: "14px",
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#fff",
                fontSize: "18px"
              }}
            >
              {!isVideoOn ? "Local camera preview will appear here" : null}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "18px",
              padding: "18px",
              background: "#fafafa",
              minHeight: "420px"
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "28px" }}>Remote video</h3>

            <div
              ref={remoteVideosRef}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                minHeight: "320px",
                alignItems: "flex-start"
              }}
            />

            {remoteParticipantCount === 0 && (
              <p style={{ fontSize: "20px", color: "#666" }}>
                No remote participant video yet.
              </p>
            )}

            {remoteParticipantCount > 0 && (
              <p style={{ fontSize: "18px", color: "#666" }}>
                If this area stays blank, the other participant is connected but may have their camera turned off.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}