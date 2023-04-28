const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);
  socket.on("join-room", (roomId) => {
    const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
    const numberOfClients = roomClients.size;

    if (numberOfClients === 0) {
      console.log(`Creating room ${roomId} and emitting room_created`);
      socket.join(roomId);
      io.in(roomId).emit('room_created_server', roomId);
      socket.remoteId = roomId;
    } else if (numberOfClients === 1) {
      console.log(`Joining room ${roomId} and emitting room_joined`);
      socket.join(roomId);
      io.in(roomId).emit('room_joined_server', roomId);
      socket.remoteId = roomId;
    } else {
      console.log(`Room ${roomId} is full, emitting room_full`);
      socket.emit("room_full", roomId);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });

  socket.on('offer', async (data) => {
    console.log('Offer received:', data);
    remoteId = data.sender;
    const desc = new RTCSessionDescription(data.sdp);
    await rtcPeerConnection.setRemoteDescription(desc);
    const answer = await rtcPeerConnection.createAnswer();
    await rtcPeerConnection.setLocalDescription(answer);
    socket.emit('answer', { sdp: rtcPeerConnection.localDescription, target: data.sender });
  });
  
  socket.on('answer', async (data) => {
    console.log('Answer received:', data);
    const desc = new RTCSessionDescription(data.sdp);
    await rtcPeerConnection.setRemoteDescription(desc);
  });
  
  socket.on('icecandidate', (data) => {
    console.log('ICE candidate received:', data);
    const candidate = new RTCIceCandidate(data.candidate);
    rtcPeerConnection.addIceCandidate(candidate);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
