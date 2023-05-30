import { wordList } from "./utilities/words.js";

document.addEventListener("DOMContentLoaded", async () => {
  let onlineUsers = [];
  onlineUsers = await GetAllUsersConnectedFromDB();
  let wordsForBattle = getRandomWords(wordList);
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
  const voteBtn = document.getElementById("vote-btn");
  readyBtn.style.display = "none";
  voteBtn.style.display = "none";

  let opponentSocketId = null;
  let isInitiator = false;
  let opponentReady = false;
  let timeoutIds = [];
  let remoteNickname;
  let ranking = [];

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
  if (ranking) {
    displayRanking();
  } else {
    console.log("Failed to fetch ranking");
  }

  if (fightBtn) {
    fightBtn.addEventListener("click", async () => {
      modal.style.display = "block";
      await startMediaCapture();
      socket.emit("requestOpponent");
      const localNickname = socket.io.opts.query.nickname;
      document.getElementById("local-nickname-field").innerHTML = localNickname;
    });
  }

  if (voteBtn) {
    voteBtn.addEventListener("click", async () => {
      const nickname = remoteNickname;
      try {
        const response = await fetch(`/vote/${nickname}`);
        if (response.ok) {
          const result = await response.json();
          console.log(result);
        } else {
          console.log(`Error: ${response.status}`);
        }
      } catch (error) {
        console.error("Error fetching vote endpoint:", error);
      }
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
    readyBtn.disabled = true;
    readyBtn.style.display = "none";
    if (opponentReady) {
      acceptOrquestration();
    } else {
      opponentReady = true;
      socket.emit("readyButtonClicked", opponentSocketId);
    }
  });

  // Socket.io events
  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("receiveWordsForBattle", (data) => {
    wordsForBattle = data;
  });

  socket.on("opponentReady", () => {
    if (opponentReady) {
      startOrquestration();
    }
    opponentReady = true;
  });

  socket.on("foundOpponent", (data) => {
    opponentSocketId = data.socketId;
    isInitiator = data.isInitiator;
    remoteNickname = data.remoteNickname;
    document.getElementById("remote-nickname-field").innerHTML =
      data.remoteNickname;

    initiateWebRTCConnection(isInitiator);
    socket.on("userDisconnected", (disconnectedSocketId) => {
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
    await Promise.all(
      users.map(async (user) => {
        const userAlreadyFetched = onlineUsers.some(
          (u) => u.nickname === user.nickname
        );

        if (!userAlreadyFetched) {
          // Fetch the user from the server and add it to our onlineUsers array
          const fetchedUser = await fetchUserFromServer(user.nickname);
          onlineUsers.push(fetchedUser);
        }
      })
    );
    await updateUserList(users);

    usersList.innerHTML = "";
    usersList.querySelectorAll("li").forEach((li) => {
      const socketId = li.id.split("-")[1];
      const userExists = users.find((user) => user.socketId === socketId);

      if (!userExists) {
        usersList.removeChild(li);
      }
    });

    // Insert new users into the list (if not already present)
    users.forEach((user) => {
      if (!usersList.querySelector(`#user-${user.socketId}`)) {
        const listItem = createUserListItem(user, onlineUsers);
        usersList.appendChild(listItem);
      }
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
    // Add styles
    messageElement.style.backgroundColor = "lightblue";
    messageElement.style.padding = "14px";
    messageElement.style.borderBottomRightRadius = "10px";
    messageElement.style.borderTopRightRadius = "10px";
    messageElement.style.borderTopLeftRadius = "10px";
    messageElement.style.marginBottom = "8px";
    messageElement.style.fontWeight = "600";
    const timeStamp = new Date(data.time).toLocaleString("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    messageElement.innerHTML = `
          <div class="chat-message-info">
            <span style="font-size: small; margin-right:5px; font-weight:400;color: #505661;" class="chat-message-sender">${data.nickname}</span>
            <span  style="font-size: small; font-weight:400;color: #505661;" class="chat-message-time">${timeStamp}</span>
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
  async function displayRanking() {
    // Create a new ul element
    ranking = await getAllUsers();
    const ul = document.createElement("ul");

    // Iterate over the ranking data and create li elements for each user
    ranking.forEach((user) => {
      const li = document.createElement("li");
      let profilePicture = user.profilePicture && user.profilePicture.startsWith("data:image/")
        ? user.profilePicture
        : `data:image/jpeg;base64,${user.profilePicture}`;
      li.innerHTML = `
        <img src="${profilePicture}" alt="${user.nickname}'s profile picture" width="50" height="50">
        <span>${user.nickname}</span>
        <span>Points: ${user.points}</span>
      `;
      ul.appendChild(li);
    });

    // Append the ul to the ranking div
    const rankingDiv = document.getElementById("ranking");
    
    // Clear the contents of the rankingDiv before appending the new list
    rankingDiv.innerHTML = "";

    rankingDiv.appendChild(ul);
}
  async function getAllUsers() {
    try {
      const response = await fetch("/auth/getallusers");
      if (response.ok) {
        const ranking = await response.json();
        console.log(ranking); // Remove this line if you don't want to log the ranking
        return ranking;
      } else {
        console.log(`Error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching getallusers endpoint:", error);
      return null;
    }
  }

  function clearDynamicContent() {
    document.getElementById("words").textContent = "";
    document.getElementById("timer").textContent = "";
    document.getElementById("countdown").textContent = "";
    document.getElementById("remote-nickname-field").textContent = "";
  }

  function startOrquestration() {
    startCountdown(10);
    socket.emit("sendWordsToOponent", {
      to: opponentSocketId,
      words: wordsForBattle,
    });

    const initiatorFirstTimeOut = setTimeout(() => {
      muteAudio(remoteVideo);
      voteBtn.style.display = "none";
      displayWords(wordsForBattle.round1ArrayOfWords, timeoutIds);
      startStopWatch();
    }, 10000);
    timeoutIds.push(initiatorFirstTimeOut);

    const initiatorSecondTimeOut = setTimeout(() => {
      unmuteAudio(remoteVideo);
      muteAudio(localVideo);
      startCountdown(10);
    }, 70000);
    timeoutIds.push(initiatorSecondTimeOut);

    const initiatorThirdTimeOut = setTimeout(() => {
      startStopWatch();
      voteBtn.style.display = "inline-block";
      displayWords(wordsForBattle.round2ArrayOfWords, timeoutIds);
    }, 80000);
    timeoutIds.push(initiatorThirdTimeOut);

    const initiatorFourthTimeOut = setTimeout(() => {
      endRapBattle();
    }, 150000);

    timeoutIds.push(initiatorFourthTimeOut);
  }

  function acceptOrquestration() {
    socket.emit("readyButtonClicked", opponentSocketId);
    startCountdown(10);
    const nonInitiatorFirstTimeOut = setTimeout(() => {
      voteBtn.style.display = "inline-block";
      muteAudio(localVideo);
      startStopWatch();
      displayWords(wordsForBattle.round1ArrayOfWords, timeoutIds);
    }, 10000);
    timeoutIds.push(nonInitiatorFirstTimeOut);
    const nonInitiatorSecondTimeOut = setTimeout(() => {
      unmuteAudio(localVideo);
      voteBtn.style.display = "none";

      muteAudio(remoteVideo);
      startCountdown(10);
    }, 70000);
    timeoutIds.push(nonInitiatorSecondTimeOut);
    const nonInitiatorThirdTimeOut = setTimeout(() => {
      startStopWatch();
      displayWords(wordsForBattle.round2ArrayOfWords, timeoutIds);
    }, 80000);
    timeoutIds.push(nonInitiatorThirdTimeOut);
    const nonInitiatorFourthTimeOut = setTimeout(() => {
      endRapBattle();
    }, 150000);

    timeoutIds.push(nonInitiatorFourthTimeOut);
  }

  function displayWords(words, timeoutIds) {
    const wordsContainer = document.getElementById("words");

    words.forEach((word, index) => {
      const delay = index * 10000;
      const timeoutId = setTimeout(() => {
        wordsContainer.textContent = word;
        if (index === words.length - 1) {
          const removeLastWordTimeoutId = setTimeout(() => {
            wordsContainer.textContent = "";
          }, 10000);
          timeoutIds.push(removeLastWordTimeoutId);
        }
      }, delay);
      timeoutIds.push(timeoutId);
    });
  }

  function getRandomWords(wordList) {
    const numberOfWords = 12;
    let selectedWords = [];

    for (let i = 0; i < numberOfWords; i++) {
      const randomIndex = Math.floor(Math.random() * wordList.length);
      selectedWords.push(wordList[randomIndex]);
    }

    return {
      round1ArrayOfWords: selectedWords.slice(0, 6),
      round2ArrayOfWords: selectedWords.slice(6, 12),
    };
  }

  function muteAudio(peer) {
    if (peer.srcObject) {
      const audioTracks = peer.srcObject.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => (track.enabled = false));
      }
    }
  }

  function unmuteAudio(peer) {
    if (peer.srcObject) {
      const audioTracks = peer.srcObject.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => (track.enabled = true));
      }
    }
  }
  async function fetchUserFromServer(nickname) {
    try {
      const response = await fetch(`/auth/getuserbyname?name=${nickname}`);
      if (!response.ok) {
        throw new Error("Error fetching user");
      }
      const user = await response.json();
      return user;
    } catch (error) {
      console.error(error);
    }
  }
  async function updateUserList(connectedUsers) {
    // Synchronize the onlineUsers array with the connectedUsers array from the server
    onlineUsers = onlineUsers.filter((user) =>
      connectedUsers.some(
        (connectedUser) => connectedUser.nickname === user.nickname
      )
    );
    await connectedUsers.forEach(async (connectedUser) => {
      const userAlreadyFetched = onlineUsers.some(
        (user) => user.nickname === connectedUser.nickname
      );

      if (!userAlreadyFetched) {
        // Fetch the user from the server and add it to our onlineUsers array
        await fetchUserFromServer(connectedUser.nickname)
          .then((fetchedUser) => {
            onlineUsers.push(fetchedUser);
          })
          .catch((error) => console.log(error));
      }
    });
    // First, remove list items that are not present in the connectedUsers list
    usersList.querySelectorAll("li").forEach((li) => {
      const socketId = li.id.split("-")[1];
      const userExists = connectedUsers.find(
        (user) => user.socketId === socketId
      );

      if (!userExists) {
        usersList.removeChild(li);
      }
    });

    // Insert new connectedUsers into the list (if not already present)
    connectedUsers.forEach((user) => {
      if (!usersList.querySelector(`#user-${user.socketId}`)) {
        const listItem = createUserListItem(user, onlineUsers);
        usersList.appendChild(listItem);
      }
    });
  }

  function createUserListItem(user, onlineUsers) {
    const listItem = document.createElement("li");
    listItem.classList.add("user-item");
    const avatarWrapper = document.createElement("div");
    const userDBObject = onlineUsers.filter(
      (u) => u.nickname === user.nickname
    )[0];
    const avatar = document.createElement("img");
    if (userDBObject) {
      avatar.src =
        userDBObject?.profilePicture &&
        userDBObject?.profilePicture.startsWith("data:image/")
          ? userDBObject?.profilePicture
          : `data:image/jpeg;base64,${userDBObject?.profilePicture}`;
      avatar.style.width = "80px";
      avatar.style.height = "80px";
    }

    avatarWrapper.appendChild(avatar);
    listItem.appendChild(avatarWrapper);

    const userNameWrapper = document.createElement("div");
    const userName = document.createElement("span");
    userName.textContent = user.nickname;
    userNameWrapper.appendChild(userName);
    listItem.appendChild(userNameWrapper);

    // Set a unique identifier for the list item element
    listItem.id = `user-${user.socketId}`;

    return listItem;
  }

  function startStopWatch() {
    const timerDiv = document.getElementById("timer");
    let secondsLeft = 60;

    const countdown = setInterval(function () {
      timerDiv.textContent = secondsLeft;

      if (secondsLeft === 0) {
        timerDiv.textContent = "";
        clearInterval(countdown);
      } else {
        secondsLeft--;
      }
    }, 1000);
    timeoutIds.push(countdown);
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
    clearDynamicContent();
    // Clear all timeouts
    timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));

    // Clear the timeoutIds array
    timeoutIds = [];
    readyBtn.disabled = false;
    readyBtn.style.display = "none";
    voteBtn.style.display = "none";

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
    displayRanking();
  }

  function initiateWebRTCConnection(createOffer) {
    readyBtn.style.display = "inline-block";

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
      timeoutIds.push(countdownInterval);
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = ""; // Clear the countdown text
      } else {
        updateCountdown();
      }
    }, 1000);
  }
});
