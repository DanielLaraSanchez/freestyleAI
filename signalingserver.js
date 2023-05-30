const { EventEmitter } = require("events");
const signalingEvents = new EventEmitter();

function setupSocketEvents(io) {
  const waitingUsers = new Set();
  const users = [];

  function handleChatMessage(socket, message) {
    const nickname = socket.handshake.query.nickname;
    const time = new Date();
    console.log(message);

    // Broadcast the chat message to all connected users
    io.emit("chatMessage", { nickname, message, time });
  }

  function handleRequestOpponent(socket) {
    waitingUsers.add(socket.id);
  
    if (waitingUsers.size >= 2) {
      let opponentSocketId = getRandomOpponent(waitingUsers);
  
      while (opponentSocketId === socket.id) {
        opponentSocketId = getRandomOpponent(waitingUsers);
      }
  
      waitingUsers.delete(socket.id);
      waitingUsers.delete(opponentSocketId);
  
      const roomId = `${socket.id}-${opponentSocketId}`;
      socket.join(roomId);
      io.sockets.sockets.get(opponentSocketId).join(roomId);
  
      const localUserNickname = socket.handshake.query.nickname;
      const remoteUserNickname = io.sockets.sockets.get(opponentSocketId).handshake.query.nickname;
  
      io.to(socket.id).emit("foundOpponent", {
        socketId: opponentSocketId,
        isInitiator: true,
        remoteNickname: remoteUserNickname,
      });
      io.to(opponentSocketId).emit("foundOpponent", {
        socketId: socket.id,
        isInitiator: false,
        remoteNickname: localUserNickname,
      });
    }
  }

  function handleSendOffer(socket, data) {
    io.to(data.to).emit("receiveOffer", {
      offer: data.offer,
      from: socket.id,
    });
  }

  function handleSendAnswer(socket, data) {
    io.to(data.to).emit("receiveAnswer", {
      answer: data.answer,
      from: socket.id,
    });
  }

  function handleSendIceCandidate(socket, data) {
    io.to(data.to).emit("receiveIceCandidate", { candidate: data.candidate });
  }

  function handleLeaveRoom(socket) {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        socket.leave(roomId);
      }
    });
  }

  function handleCloseConnection(socket, opponentSocketId) {
    socket.broadcast.to(opponentSocketId).emit("endConnection");
  }

  function handleDisconnect(socket) {
    const index = users.findIndex((user) => user.socketId === socket.id);
    if (index > -1) {
      signalingEvents.emit("userDisconnected", users[index].nickname, users);
      users.splice(index, 1);
    }
    socket.broadcast.emit("userDisconnected", socket.id);
    console.log("User disconnected:", socket.id);
    waitingUsers.delete(socket.id);

    io.emit("updateUserList", users);
    handleLeaveRoom(socket);
  }

  function handleSendWordsToOponent(opponentSocketId, words) {
    console.log(words)
    io.to(opponentSocketId).emit("receiveWordsForBattle", words)
  }

  function handleReadyButtonClicked(socket, opponentSocketId) {
    io.to(opponentSocketId).emit("opponentReady");
  }

  function getRandomOpponent(users) {
    const userList = Array.from(users);
    return userList[Math.floor(Math.random() * userList.length)];
  }

  io.on("connection", (socket) => {
    console.log("User connected: " + socket.id);

    const nickname = socket.handshake.query.nickname;
    users.push({ socketId: socket.id, nickname });
    io.emit("updateUserList", users);

    socket.on("chatMessage", (message) => handleChatMessage(socket, message));
    socket.on("requestOpponent", () => handleRequestOpponent(socket));
    socket.on("sendOffer", (data) => handleSendOffer(socket, data));
    socket.on("sendAnswer", (data) => handleSendAnswer(socket, data));
    socket.on("sendIceCandidate", (data) => handleSendIceCandidate(socket, data));
    socket.on("leaveRoom", () => handleLeaveRoom(socket));
    socket.on("disconnect", () => handleDisconnect(socket));
    socket.on("endConnection", (opponentSocketId) => handleCloseConnection(socket, opponentSocketId));
    socket.on("readyButtonClicked", (opponentSocketId) => handleReadyButtonClicked(socket, opponentSocketId));
    socket.on("sendWordsToOponent", (data) => handleSendWordsToOponent(data.to, data.words));


  });
}

module.exports = { setupSocketEvents, signalingEvents };