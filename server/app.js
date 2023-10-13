require('dotenv').config();
const express = require('express');
const app = express();
const socketio = require('socket.io');
const server = require('http').createServer(app);

const url = process.env.CLIENT_URL;
const io = socketio(server, {
  cors: {
    origin: url,
    credentials: true
  }
});
const cors = require('cors');

const port = 3000;
let users = [];
let connections = [];
let calls = [];


app.use(cors({
  origin: url,
  credentials: true
}));

io.on('connection', (socket) => {
  console.log('user connected: ', socket.id);
  socket.on('set-username', username => {
    const user = { id: socket.id, username };
    connections.push(socket);
    users.push(user);
    socket.emit('users-list', users.filter(user => user.id !== socket.id));
    socket.broadcast.emit('users-list', [user]);
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('candidate', {
      candidate,
      from: socket.id
    });
  })

  socket.on('call-user', ({ offer, to }) => {
    socket.to(to).emit('call-made', {
      offer,
      caller: socket.id
    });
  });

  socket.on('make-answer', ({ answer, to }) => {
    const existingCall = calls.find(call => call.caller === socket.id && call.recipent === to);
    console.log(existingCall);
    if(!existingCall) {
      calls.push({
        active: true,
        caller: socket.id,
        recipent: to
      })
    }
    
    console.log(calls);
    socket.to(to).emit('answer-made', {
      answer,
      recipent: socket.id
    });
  });

  socket.on('end-call', user => {
    console.log('end-call');
    calls = calls.filter(call => call.caller !== socket.id && call.recipent !== socket.id);
    console.log('User' + user);
    socket.to(user).emit('call-ended', socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('user disconnected: ', socket.id);
    connections = connections.filter(connection => connection.id !== socket.id);
    users = users.filter(user => user.id !== socket.id);
    calls = calls.filter(call => call.caller !== socket.id && call.recipent !== socket.id);
    socket.broadcast.emit('remove-user', socket.id);
  })
});

server.listen(port, () => console.log(`Server started on port ${port}`));





