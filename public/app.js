document.addEventListener("DOMContentLoaded", () => {
  let isInitiator = false;
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

  socket.on("foundOpponent", (data) => {
    opponentSocketId = data.socketId;
    isInitiator = data.isInitiator;
    initiateWebRTCConnection(isInitiator);
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
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
          "stun:stun.ekiga.net",
          "stun:stun.ideasip.com",
          "stun:stun.rixtelecom.se",
          "stun:stun.schlund.de",
          "stun:stun.stunprotocol.org:3478",
          "stun:stun.voiparound.com",
          "stun:stun.voipbuster.com",
          "stun:stun.voipstunt.com",
          "stun:stun.voxgratia.org"          
        ],
      },
    ],
  };
  const peerConnection = new RTCPeerConnection(configuration);

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localVideo.srcObject = stream;
      localVideo.play().catch((error) => console.warn("Error playing local video:", error));
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));
    })
    .catch((error) => {
      console.error("Error accessing media devices.", error);
    });

  peerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
      remoteVideo.play().catch((error) => console.warn("Error playing remote video:", error));
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendIceCandidate", {
        candidate: event.candidate,
        to: opponentSocketId,
      });
    }
  };

  socket.on("receiveIceCandidate", async (data) => {
    const candidate = new RTCIceCandidate(data.candidate);
    await peerConnection.addIceCandidate(candidate);
  });

  function initiateWebRTCConnection(createOffer) {
    if (createOffer) {
      peerConnection
        .createOffer()
        .then((offer) => {
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          socket.emit("sendOffer", {
            offer: peerConnection.localDescription,
            to: opponentSocketId,
          });
        })
        .catch((error) => {
          console.error("Error creating offer:", error);
        });
    }
  }

  socket.on("receiveOffer", async (data) => {
    await peerConnection.setRemoteDescription(data.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("sendAnswer", { answer: peerConnection.localDescription, to: data.from });
  });

  socket.on("receiveAnswer", async (data) => {
    await peerConnection.setRemoteDescription(data.answer);
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