function setupSocketEvents(io) {
    const waitingUsers = new Set();
    const users = [];
  
    io.on("connection", (socket) => {
      console.log("User connected: " + socket.id);
      users.push(socket.id);
      io.emit("updateUserList", users);
  
      socket.on("requestOpponent", () => {
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
  
          io.to(socket.id).emit("foundOpponent", {
            socketId: opponentSocketId,
            isInitiator: true,
          });
          io.to(opponentSocketId).emit("foundOpponent", {
            socketId: socket.id,
            isInitiator: false,
          });
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
        socket.rooms.forEach((roomId) => {
          if (roomId !== socket.id) {
            socket.leave(roomId);
          }
        });
      });
  
      socket.on("disconnect", () => {
        const index = users.indexOf(socket.id);
        if (index > -1) {
          users.splice(index, 1);
        }
        console.log("User disconnected:", socket.id);
        waitingUsers.delete(socket.id);
  
        io.emit("updateUserList", users);
  
        socket.rooms.forEach((roomId) => {
          if (roomId !== socket.id) {
            socket.leave(roomId);
          }
        });
  
        io.emit("userDisconnected", socket.id);
      });
  
      function getRandomOpponent(users) {
        const userList = Array.from(users);
        return userList[Math.floor(Math.random() * userList.length)];
      }
    });
  }
  
  module.exports = { setupSocketEvents };