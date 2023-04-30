const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const rooms = {};

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);
  socket.on('join-room', (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
    const numberOfClients = roomClients.size;
  
    if (numberOfClients === 0) {
      console.log(`Creating room ${roomId}`);
      socket.join(roomId);
      rooms[roomId] = { creator: socket.id };
      socket.emit('room_created_client');
    } else if (numberOfClients === 1) {
      console.log(`Joining room ${roomId}`);
      socket.join(roomId);
      rooms[roomId].joiner = socket.id;
  
      // Emit room_joined_client to both clients in the room
      io.in(roomId).emit('room_joined_client', rooms[roomId]);
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit('room_full', roomId);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });

  // Handle the offer event on the server-side
  socket.on('offer', (data) => {
    console.log('Offer received:', data);
    // Forward the offer to the target client
    socket.to(data.target).emit('offer', data);
  });

  // Handle the answer event on the server-side
  socket.on('answer', (data) => {
    console.log('Answer received:', data);
    // Forward the answer to the target client
    socket.to(data.target).emit('answer', data);
  });

  // Handle the icecandidate event on the server-side
  socket.on('icecandidate', (data) => {
    console.log('Received ICE candidate:', data.candidate);
    // Forward the icecandidate data to the target client
    socket.to(data.target).emit('icecandidate', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});