const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);

  socket.on('join-room', (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
    const numberOfClients = roomClients.size;

    if (numberOfClients === 0) {
      console.log(`Creating room ${roomId} and emitting room_created`);
      socket.join(roomId);
      socket.emit('room_created', roomId);
    } else if (numberOfClients === 1) {
      console.log(`Joining room ${roomId} and emitting room_joined`);
      socket.join(roomId);
      socket.emit('room_joined', roomId);
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit('room_full', roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);
  });

  socket.on('offer', (data) => {
    console.log(`Forwarding offer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('offer', { sdp: data.sdp, sender: socket.id });
  });

  socket.on('answer', (data) => {
    console.log(`Forwarding answer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('answer', { sdp: data.sdp, sender: socket.id });
  });

  socket.on('icecandidate', (data) => {
    console.log(`Forwarding ICE candidate from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('icecandidate', { candidate: data.candidate, sender: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});