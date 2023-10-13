import config from "../config/index.js";

const url = config.production.url;
const socket = io(url, {
  withCredentials: true
});

const servers = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ]
};

const peerConnection = new RTCPeerConnection(servers);
let localStream;
let remoteStream;
let correspondingUser;

// const initializeConnection = () => {
//   return new Promise((resolve, reject) => {
//     const peerConnection = new RTCPeerConnection(servers);
//     resolve(peerConnection);
//   });
// }

const listenToClick = (card) => {
  card.addEventListener('click', async () => {
    // peerConnection = new RTCPeerConnection(servers);;
    console.log(peerConnection);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    localICECondidate(); // Listen To Local ICE Candidates
    const endCallButton = document.getElementById('end-call');
    endCallButton.classList.add('visible');
    correspondingUser = card.id;
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
    if(correspondingUser === userCard.id) {
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
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
  }
}

const getVideos = async () => {
  const localVideo = document.getElementById('local-video');
  localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      height: 720,
      width: 1280,
      // frameRate: { ideal: 30 }
    },
    audio: true
  });
  localVideo.srcObject = localStream;
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  handleTrack();
}

// const callUser = () => {
//   const onlineUsers = document.querySelectorAll('.user');
//   console.log(onlineUsers.length);
//   onlineUsers.forEach(user => {
//     listenToClick(user);
//   });
// }

const localICECondidate = () => {
  peerConnection.onicecandidate = (event) => {
    if(event.candidate) {
      console.log(event.candidate);
      socket.emit('ice-candidate', {
        candidate: event.candidate,
        to: correspondingUser
      });
    }
  }
  onICECandidate(); // Listen To Remote ICE Candidates
}

const onICECandidate = () => {
  socket.on('candidate', async (data) => {
    const candidate = data.candidate;
    if(candidate) {
      console.log(candidate);
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}

const listenToCall = () => {
  socket.on('call-made', async ({ offer, caller }) => {
    // peerConnection = new RTCPeerConnection(servers);
    console.log(peerConnection);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    localICECondidate(); // Listen To Local ICE Candidates
    const endCallButton = document.getElementById('end-call');
    endCallButton.classList.add('visible');
    correspondingUser = caller;
    await getVideos(); // Display Local and Remote Videos
    socket.emit('make-answer', {
      answer,
      to: caller
    });
  });
}

const listenToAnswer = () => {
  socket.on('answer-made', async ({ answer }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await getVideos(); // Display Local and Remote Videos
  });
}

const endCall = () => {
  const endCallButton = document.getElementById('end-call');
  endCallButton.addEventListener('click', () => {
    console.log('end call');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const endCallButton = document.getElementById('end-call');
    peerConnection.close();
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    endCallButton.classList.remove('visible');
    console.log('User' + correspondingUser);
    socket.emit('end-call', correspondingUser);
  });
}

const callEnded = () => {
  socket.on('call-ended', () => {
    console.log('call ended');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const endCallButton = document.getElementById('end-call');
    peerConnection.close();
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
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


