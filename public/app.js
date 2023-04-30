document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const fightBtn = document.getElementById("fight-btn");
  const videoContainer = document.getElementById("modal-video-container");
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("close-modal");

  let opponentSocketId = null;

  if (fightBtn) {
    fightBtn.addEventListener("click", () => {
      modal.style.display = "block";
      socket.emit("requestOpponent");
    });
  }

  if (closeModal) {
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("foundOpponent", (data) => {
    opponentSocketId = data;
    initiateWebRTCConnection();
  });

  // WebRTC logic

  const localVideo = document.createElement("video");
  const remoteVideo = document.createElement("video");
  localVideo.classList.add("local-video");
  remoteVideo.classList.add("remote-video");
  videoContainer.appendChild(localVideo);
  videoContainer.appendChild(remoteVideo);
  localVideo.muted = true;

  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };
  const peerConnection = new RTCPeerConnection(configuration);

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localVideo.srcObject = stream;
      localVideo.play();
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    })
    .catch((error) => {
      console.error("Error accessing media devices.", error);
    });

  peerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
      remoteVideo.play();
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendIceCandidate", { candidate: event.candidate, to: opponentSocketId });
    }
  };

  socket.on("receiveIceCandidate", (data) => {
    const candidate = new RTCIceCandidate(data.candidate);
    peerConnection.addIceCandidate(candidate).catch((error) => {
      console.error("Error adding received ice candidate:", error);
    });
  });

  function initiateWebRTCConnection() {
    peerConnection
      .createOffer()
      .then((offer) => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        socket.emit("sendOffer", { offer: peerConnection.localDescription, to: opponentSocketId });
      })
      .catch((error) => {
        console.error("Error creating offer:", error);
      });
  }

  socket.on("receiveOffer", async (data) => {
    try {
      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("sendAnswer", { answer: peerConnection.localDescription, to: data.from });
    } catch (error) {
      console.error("Error handling receiveOffer:", error);
    }
  });
  
  socket.on("receiveAnswer", async (data) => {
    try {
      const answer = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error("Error setting remote description:", error);
    }
  });

  function startTimer() {
    setTimeout(() => {
      if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach((track) => track.stop());
        localVideo.srcObject = null;
      }
      if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
        remoteVideo.srcObject = null;
      }
      socket.emit("endRapBattle", opponentSocketId);
    }, 60000);
  }

  socket.on("startRapBattle", () => {
    startTimer();
  });

  socket.on("endRapBattle", () => {
    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach((track) => track.stop());
      localVideo.srcObject = null;
    }
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
    }
    opponentSocketId = null;
    modal.style.display = "none";
  });
});