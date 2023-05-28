import { wordList } from "./utilities/words.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log(wordList);
  const fightBtn = document.getElementById("fight-btn");
  const localVideoContainer = document.querySelector(".local-video-container");
  const remoteVideoContainer = document.querySelector(
    ".remote-video-container"
  );
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("close-modal");
  const usersList = document.getElementById("users-list");
  const countdownElement = document.getElementById("countdown");
  const signoutBtn = document.getElementById("signout-btn");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatMessagesContainer = document.querySelector(
    ".chat-messages-container"
  );
  const readyBtn = document.getElementById("ready-btn");

  let opponentSocketId = null;
  let isInitiator = false;
  let opponentReady = false;

  // WebRTC related
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

  let peerConnection;

  // Create video elements
  const localVideo = document.createElement("video");
  const remoteVideo = document.createElement("video");
  localVideo.classList.add("local-video");
  remoteVideo.classList.add("remote-video");
  localVideoContainer.appendChild(localVideo);
  remoteVideoContainer.appendChild(remoteVideo);

  // Initialize socket connection
  const socket = io({ query: { nickname: getCookieValue("fRapsUser") } });

  //**********************************************
  // EVENT LISTENERS
  //**********************************************

  // Fight button click event
  if (fightBtn) {
    fightBtn.addEventListener("click", async () => {
      modal.style.display = "block";
      await startMediaCapture();
      socket.emit("requestOpponent");
    });
  }

  // Close modal click event
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      endRapBattle();
    });
  }

  // Click outside modal event
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      endRapBattle();
    }
  });

  // Sign out button click event
  signoutBtn.addEventListener("click", async function () {
    clearCookie("fRapsUser");
    window.location.href = "/signout";
  });

  // Chat send button click event
  chatSendBtn.addEventListener("click", () => {
    if (chatInput.value !== "") {
      socket.emit("chatMessage", chatInput.value);
      chatInput.value = "";
    }
  });

  // Chat input keyup event
  chatInput.addEventListener("keyup", (e) => {
    if (e.keyCode === 13 && chatInput.value !== "") {
      socket.emit("chatMessage", chatInput.value);
      chatInput.value = "";
    }
  });

  // Modify the readyBtn click event listener
  readyBtn.addEventListener("click", () => {
    console.log("its being called here before user clicks")
    readyBtn.disabled = true;
    if (opponentReady) {
      // setTimeout(() => {
      //   endRapBattle();
      // }, 10000);
      socket.emit("readyButtonClicked", opponentSocketId);
     orquestrateBattle();
      console.log("here the action starts 1");
    } else {
      opponentReady = true;
      socket.emit("readyButtonClicked", opponentSocketId);
    }
  });

  // Socket.io events
  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("opponentReady", () => {
    console.log("here the action starts 2", opponentReady);
    if (opponentReady) {
    orquestrateBattle();
    }
    opponentReady = true;
  });

  socket.on("foundOpponent", (data) => {
    opponentSocketId = data.socketId;
    isInitiator = data.isInitiator;

    initiateWebRTCConnection(isInitiator);
    socket.on("userDisconnected", (disconnectedSocketId) => {
      console.log("works");
      if (opponentSocketId === disconnectedSocketId) {
        endRapBattle();
      }
    });
  });

  socket.on("receiveIceCandidate", async (data) => {
    const candidate = new RTCIceCandidate(data.candidate);
    await peerConnection.addIceCandidate(candidate);
  });

  async function GetAllUsersConnectedFromDB() {
    try {
      const response = await fetch("/auth/getonlineusers");
      if (!response.ok) {
        throw new Error("Error fetching online users");
      }
      const onlineUsers = await response.json();
      return onlineUsers;
    } catch (error) {
      console.error(error);
    }
  }

  socket.on("updateUserList", async (users) => {
    usersList.innerHTML = "";
    const onlineUsers = await GetAllUsersConnectedFromDB();
    // Loop through the onlineUsers array instead of users
    onlineUsers.forEach((user) => {
      const listItem = document.createElement("li");
      listItem.classList.add("user-item");
      const avatarWrapper = document.createElement("div");
      const userDBObject = onlineUsers.filter(
        (u) => u.nickname === user.nickname
      )[0];
      const avatar = document.createElement("img");
      // Set the src attribute of the img element to user.profilePicture (assuming it's base64 encoded)
      avatar.src =
        userDBObject.profilePicture &&
        userDBObject.profilePicture.startsWith("data:image/")
          ? userDBObject.profilePicture
          : `data:image/jpeg;base64,${userDBObject.profilePicture}`;
      avatar.style.width = "80px";
      avatar.style.height = "80px";

      avatarWrapper.appendChild(avatar);
      listItem.appendChild(avatarWrapper);

      const userNameWrapper = document.createElement("div");
      const userName = document.createElement("span");
      userName.textContent = user.nickname; // Since the user object contains the nickname directly
      userNameWrapper.appendChild(userName);
      listItem.appendChild(userNameWrapper);

      usersList.appendChild(listItem);
    });
  });
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
    endRapBattle();
  });

  socket.on("endConnection", () => {
    endRapBattle();
  });

  socket.on("chatMessage", (data) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-message");
    const timeStamp = new Date(data.time).toLocaleString("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    messageElement.innerHTML = `
          <div class="chat-message-info">
            <span class="chat-message-sender">${data.nickname}</span>
            <span class="chat-message-time">${timeStamp}</span>
          </div>
          <div class="chat-message-text">${data.message}</div>
        `;
    chatMessagesContainer.appendChild(messageElement);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });

  // Initialize and configure peer connection
  initializePeerConnection();

  //**********************************************
  // UTILITY FUNCTIONS
  //**********************************************
function orquestrateBattle() {
  startCountdown(10);
        setTimeout(() => {
          displayRandomWord();
          startStopWatch();
      }, 10000);
      setTimeout(() => {
      endRapBattle();
    }, 60000);
}

function startStopWatch() {
  const timerDiv = document.getElementById("timer");
  let secondsLeft = 60;
  
  const countdown = setInterval(function() {
    timerDiv.textContent = secondsLeft;
    
    if (secondsLeft === 0) {
      clearInterval(countdown);
    } else {
      secondsLeft--;
    }
  }, 1000);

}

  function displayRandomWord() {
    const wordsDiv = document.getElementById("words");
    while (wordsDiv.firstChild) {
      wordsDiv.removeChild(wordsDiv.firstChild);
    }
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    const h3 = document.createElement("h3");
    h3.textContent = randomWord;
    wordsDiv.appendChild(h3);
  }

  function getCookieValue(name) {
    const matchedCookie = document.cookie.match(new RegExp(name + "=([^;]+)"));
    if (matchedCookie && matchedCookie[1]) {
      const cookieValue = decodeURIComponent(matchedCookie[1]);
      try {
        const parsedValue = JSON.parse(cookieValue);
        return parsedValue.nickname;
      } catch (error) {
        // If parsing fails, return the value as is
        return cookieValue;
      }
    } else {
      return null;
    }
  }

  let count = 0;
  const intervalId = setInterval(() => {
    count++;
    if (count === 6) {
      clearInterval(intervalId);
    }
  }, 10000);

  function startMediaCapture() {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideo.srcObject = stream;
        await localVideo.play();
        stream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, stream));
        resolve();
      } catch (error) {
        console.error("Error accessing media devices.", error);
        reject(error);
      }
    });
  }

  function clearCookie(name) {
    document.cookie =
      name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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

  function endRapBattle() {
    if (readyBtn.disabled === true) readyBtn.disabled = false;
    opponentReady = false;
    if (opponentSocketId !== null) {
      socket.emit("endConnection", opponentSocketId);
    }
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
    peerConnection.close();
    initializePeerConnection();
    isInitiator = false;
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

  function startCountdown(duration) {
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
});
