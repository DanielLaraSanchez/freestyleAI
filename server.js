const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const rooms = {};
const waitingUsers = new Set();

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

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
      io.in(roomId).emit("room_joined_client");
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit("room_full", roomId);
    }
  });

  socket.on("requestOpponent", () => {
    if (waitingUsers.size > 0) {
      const opponentSocketId = getRandomOpponent(waitingUsers);
      waitingUsers.delete(opponentSocketId);
      socket.emit("foundOpponent", opponentSocketId);
      io.to(opponentSocketId).emit("foundOpponent", socket.id);
      io.to(opponentSocketId).emit("startRapBattle");
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
    console.log("User disconnected:", socket.id);
    waitingUsers.delete(socket.id);
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