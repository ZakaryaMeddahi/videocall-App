import config from "../config";

const url = config.development.url;
const socket = io(url, {
  withCredentials: true
});

const peerConnection = new RTCPeerConnection();
let user;

const listenToClick = (card) => {
  card.addEventListener('click', async e => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const endCallButton = document.getElementById('end-call');
    endCallButton.classList.add('visible');
    user = card.id;
    socket.emit('call-user', {
      offer,
      to: card.id
    });
    console.log(offer);
  });
}



const userCard = ({ id, username }) => {
  const card = document.createElement('div');
  card.classList.add('user');
  card.id = id;
  card.innerHTML = `
    <p class="username">${username}</p>
  `;
  listenToClick(card);
  return card;
}

const createUsers = (users) => {
  const usersContainer = document.querySelector('.users-container');
  console.log(users);
  users.forEach(user => {
    const existingUser = document.getElementById(user.id);
    if(!existingUser) {
      const card = userCard(user);
      usersContainer.append(card);
    }
  });
}

const getUsers = () => {
  socket.on('users-list', (users) => {
    createUsers(users);
  });
}

const removeUser = () => {
  socket.on('remove-user', (userId) => {
    const userCard = document.getElementById(userId);
    if(user === userCard.id) {
      const remoteVideo = document.getElementById('remote-video');
      const endCallButton = document.getElementById('end-call');
      remoteVideo.srcObject = null;
      endCallButton.classList.remove('visible');
    }
    userCard.remove();
  });
}

const handleTrack = () => {
  const remoteVideo = document.getElementById('remote-video');
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  }
}

const getVideos = async () => {
  const localVideo = document.getElementById('local-video');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      height: 720,
      width: 1280
    },
    audio: true
  });
  localVideo.srcObject = stream;
  stream.getTracks().forEach(track => {
    peerConnection.addTrack(track, stream);
  });
  handleTrack();
}

const callUser = () => {
  const onlineUsers = document.querySelectorAll('.user');
  console.log(onlineUsers.length);
  onlineUsers.forEach(user => {
    listenToClick(user);
  });
}

const listenToCall = () => {
  socket.on('call-made', async ({ offer, caller }) => {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    const endCallButton = document.getElementById('end-call');
    endCallButton.classList.add('visible');
    user = caller;
    getVideos(); // Display Local and Remote Videos
    socket.emit('make-answer', {
      answer,
      to: caller
    });
  });
}

const listenToAnswer = () => {
  socket.on('answer-made', async ({ answer }) => {
    await peerConnection.setRemoteDescription(answer);
    getVideos(); // Display Local and Remote Videos
  });
}

const endCall = () => {
  const endCallButton = document.getElementById('end-call');
  endCallButton.addEventListener('click', () => {
    console.log('end call');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const endCallButton = document.getElementById('end-call');
    localVideo.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
    endCallButton.classList.remove('visible');
    console.log('User' + user);
    socket.emit('end-call', user);
  });
}

const callEnded = () => {
  socket.on('call-ended', () => {
    console.log('call ended');
    const localVideo = document.getElementById('local-video').srcObject;
    const remoteVideo = document.getElementById('remote-video');
    const endCallButton = document.getElementById('end-call');
    localVideo.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
    endCallButton.classList.remove('visible');
  });
}

socket.on('connect', () => {
  console.log('connected');
  const submitButton = document.getElementById('submit');
  submitButton.onclick = (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const form = document.querySelector('.user-info_form');
    const overlay = document.querySelector('.overlay');
    form.style.display = 'none';
    overlay.style.display = 'none';
    socket.emit('set-username', username);
    getUsers(); // Get All Connected Users
    removeUser(); // Remove A User From The List When Get Disconnected
    listenToCall(); // Listen To Any Calls From Other Users (Callers)
    listenToAnswer(); // Listen To Answer From The Recipent To Start The Meet
    endCall(); // End The Call By Removing Remote Video
    callEnded(); // Listen If The Call Has Been Ended By The Corresponding User
  }
});


