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

  socket.on("requestOpponent", () => {
    const roomId = "defaultRoom";
    const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
    const numberOfClients = roomClients.size;

    if (numberOfClients === 0) {
      console.log(`Creating room ${roomId}`);
      socket.join(roomId);
      rooms[roomId] = { creator: socket.id };
    } else if (numberOfClients === 1) {
      console.log(`Joining room ${roomId}`);
      socket.join(roomId);
      rooms[roomId].joiner = socket.id;

      const initiatorSocketId = rooms[roomId].creator;
      const joinerSocketId = rooms[roomId].joiner;

      io.to(initiatorSocketId).emit("foundOpponent", {
        socketId: joinerSocketId,
        isInitiator: true,
      });
      io.to(joinerSocketId).emit("foundOpponent", {
        socketId: initiatorSocketId,
        isInitiator: false,
      });
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit("room_full", roomId);
      resetRoom(roomId);
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

  socket.on("leaveRoom", () => {
    const roomId = "defaultRoom";
    socket.leave(roomId);
    resetRoom(roomId);
  });

  socket.on("disconnect", () => {
    const index = users.indexOf(socket.id);
    if (index > -1) {
      users.splice(index, 1);
    }
    console.log("User disconnected:", socket.id);
    waitingUsers.delete(socket.id);

    io.emit("updateUserList", users);

    // Remove the user from the room and reset the room state
    const roomId = "defaultRoom";
    socket.leave(roomId);
    resetRoom(roomId);

    // Emit "userDisconnected" event to all connected clients
    io.emit("userDisconnected", socket.id);
  });

  function resetRoom(roomId) {
    if (rooms[roomId]) {
      delete rooms[roomId].creator;
      delete rooms[roomId].joiner;

      if (!rooms[roomId].creator && !rooms[roomId].joiner) {
        delete rooms[roomId];
      }
    }
  }

  function getRandomOpponent(users) {
    const userList = Array.from(users);
    return userList[Math.floor(Math.random() * userList.length)];
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});