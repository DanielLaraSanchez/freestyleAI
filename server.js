const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const rooms = {};
const waitingUsers = new Set();
const users = [];

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);
  users.push(socket.id);
  io.emit("updateUserList", users);

  socket.on("join-room", (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
    const numberOfClients = roomClients.size;
  
    if (numberOfClients === 0) {
      console.log(`Creating room ${roomId}`);
      socket.join(roomId);
      rooms[roomId] = { creator: socket.id };
      socket.emit("room_created_client");
    } else if (numberOfClients === 1) {
      console.log(`Joining room ${roomId}`);
      socket.join(roomId);
      rooms[roomId].joiner = socket.id;
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit("room_full", roomId);
    }
  });

  socket.on("requestOpponent", () => {
    if (waitingUsers.size > 0) {
      const opponentSocketId = getRandomOpponent(waitingUsers);
      waitingUsers.delete(opponentSocketId);
      socket.emit("foundOpponent", { socketId: opponentSocketId, isInitiator: true });
      io.to(opponentSocketId).emit("foundOpponent", { socketId: socket.id, isInitiator: false });
      io.to(socket.id).emit("startRapBattleInitiator");
      io.to(opponentSocketId).emit("startRapBattleNonInitiator");
    } else {
      waitingUsers.add(socket.id);
    }
  });

  socket.on("sendOffer", (data) => {
    io.to(data.to).emit("receiveOffer", {
      offer: data.offer,
      from: socket.id,
    });
  });

  socket.on("sendAnswer", (data) => {
    io.to(data.to).emit("receiveAnswer", {
      answer: data.answer,
      from: socket.id,
    });
  });

  socket.on("sendIceCandidate", (data) => {
    io.to(data.to).emit("receiveIceCandidate", { candidate: data.candidate });
  });

  socket.on("endRapBattle", (opponentId) => {
    io.to(opponentId).emit("endRapBattle");
  });

  
  socket.on("disconnect", () => {
    const index = users.indexOf(socket.id);
    if (index > -1) {
      users.splice(index, 1);
    }
    console.log("User disconnected:", socket.id);
    waitingUsers.delete(socket.id);
    io.emit("updateUserList", users);
  
    // Add this line to emit "endRapBattle" event to the opponent when a user disconnects
    const opponentSocketId = Object.values(rooms).find(
      (room) =>
        room.creator === socket.id || room.joiner === socket.id
    );
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("endRapBattle");
    }
  
    // Emit "userDisconnected" event to all connected clients
    io.emit("userDisconnected", socket.id);
  });

  function getRandomOpponent(users) {
    const userList = Array.from(users);
    return userList[Math.floor(Math.random() * userList.length)];
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});