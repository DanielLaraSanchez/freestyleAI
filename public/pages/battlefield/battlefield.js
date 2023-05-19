document.addEventListener("DOMContentLoaded", () => {
  let isInitiator = false;
  const socket = io();
  const fightBtn = document.getElementById("fight-btn");
  const localVideoContainer = document.querySelector(".local-video-container");
  const remoteVideoContainer = document.querySelector(
    ".remote-video-container"
  );
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("close-modal");

  let opponentSocketId = null;
  let peerConnection;
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
          "stun:stun.voxgratia.org",
        ],
      },
    ],
  };

  if (fightBtn) {
    fightBtn.addEventListener("click", async () => {
      modal.style.display = "block";
      await startMediaCapture();
      socket.emit("requestOpponent");
    });
  }

  if (closeModal) {
    closeModal.addEventListener("click", () => {
      endRapBattle();
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      endRapBattle();
    }
  });

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  // WebRTC logic

  const localVideo = document.createElement("video");
  const remoteVideo = document.createElement("video");
  localVideo.classList.add("local-video");
  remoteVideo.classList.add("remote-video");
  localVideoContainer.appendChild(localVideo);
  remoteVideoContainer.appendChild(remoteVideo);
  localVideo.muted = false;

  initializePeerConnection();

  socket.on("foundOpponent", (data) => {
    opponentSocketId = data.socketId;
    isInitiator = data.isInitiator;

    initiateWebRTCConnection(isInitiator);

    if (isInitiator) {
      startCountdown(10); // Start the countdown for 10 seconds
    }

    socket.on("userDisconnected", (disconnectedSocketId) => {
      if (opponentSocketId === disconnectedSocketId) {
        endRapBattle();
      }
    });
  });
  function startMediaCapture() {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideo.srcObject = stream;
        await localVideo.play();
        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
        resolve();
      } catch (error) {
        console.error("Error accessing media devices.", error);
        reject(error);
      }
    });
  }

  function initializePeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
        remoteVideo.srcObject = stream;
        remoteVideo
          .play()
          .catch((error) => console.warn("Error playing remote video:", error));
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
  }

  socket.on("receiveIceCandidate", async (data) => {
    const candidate = new RTCIceCandidate(data.candidate);
    await peerConnection.addIceCandidate(candidate);
  });

  socket.on("updateUserList", (users) => {
    const usersList = document.getElementById("users-list");

    // Clear the existing list
    usersList.innerHTML = "";

    // Add each user to the list
    users.forEach((user) => {
      const listItem = document.createElement("li");
      listItem.classList.add("user-item");

      const avatarWrapper = document.createElement("div");
      const avatar = document.createElement("i");
      avatar.classList.add("material-icons");
      avatar.textContent = "face"; // Change the icon here
      avatarWrapper.appendChild(avatar);
      listItem.appendChild(avatarWrapper);

      const userNameWrapper = document.createElement("div");
      const userName = document.createElement("span");
      userName.textContent = user === socket.id ? "YOU" : user;
      userNameWrapper.appendChild(userName);
      listItem.appendChild(userNameWrapper);

      usersList.appendChild(listItem);
    });
  });

  function endRapBattle() {
    // Remove event listener for "userDisconnected"
    socket.off("userDisconnected");

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

    // Close the peer connection
    peerConnection.close();

    // Initialize a new peer connection
    initializePeerConnection();

    // Set isInitiator back to false
    isInitiator = false;

    // Emit "leaveRoom" event to inform the server to reset the room
    socket.emit("leaveRoom");
  }

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
    socket.emit("sendAnswer", {
      answer: peerConnection.localDescription,
      to: data.from,
    });
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

  function startCountdown(duration) {
    const countdownElement = document.getElementById("countdown");
    let remainingTime = duration;

    const updateCountdown = () => {
      countdownElement.textContent = remainingTime;
      countdownElement.classList.remove("countdown-animation");
      void countdownElement.offsetWidth; // Trigger reflow
      countdownElement.classList.add("countdown-animation");
    };

    updateCountdown();

    const countdownInterval = setInterval(() => {
      remainingTime--;

      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = ""; // Clear the countdown text
      } else {
        updateCountdown();
      }
    }, 1000);
  }

  const signoutBtn = document.getElementById("signout-btn");

  // Attach a click event listener
  signoutBtn.addEventListener("click", function () {
    // Redirect the user to the sign-out route
    window.location.href = "/signout";
  });
});
