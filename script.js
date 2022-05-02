// 节点属性化
const localVideo = document.getElementById("localVideo");
const MODEL_URL = 'https://raw.githubusercontent.com/pakhohinquit/enh/main/models'

Promise.all ([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
]).then(location.hash)

// 如果需要，生成随机房间名称
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: 替换为您自己的频道ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// 房间名称需要加上前缀“observable-”
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;

function onSuccess() {};
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // 我们连接到房间，收到了一系列“成员”
  // 连接到房间（包括我们）。信号服务器准备好了。
  room.on('members', members => {
    console.log('MEMBERS', members);
    // 如果我们是第二个连接到房间的用户，我们将创建offerer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// 通过Scaledrone发送信令数据
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // “onicecandidate”会在ICE代理需要交付服务时通知我们
  // 通过信令服务器向另一个对等方发送消息
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // 如果用户是offerer，让“negotiationneeded”事件创建offerer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  // 当远程流到达时，在#remoteVideo元素中显示它
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
   
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // 在#localVideo元素中显示本地视频
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);
    
  // 收听来自Scaledrone的信令数据
  room.on('data', (message, client) => {
    // 消息是我们发出的
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      // 这是在收到另一位同行的提议或答复后调用的
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // 当收到一份offer时，回答它
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // 将新的ICE候选者添加到我们的远程描述中
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

//对视频中的人脸进行检测，创建画布，将检测结果绘制在画布上
localVideo.addEventListener('play',()=>{
  const canvas = faceapi.createCanvasFromMedia(localVideo)
  document.body.append (canvas)
  const displaySize = {width:localVideo.width,height:localVideo.height}
  faceapi.matchDimensions(canvas,displaySize)
  setInterval( async()=>{ 
      const detections = await faceapi.detectAllFaces(localVideo, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender()
      const resizedDetections = faceapi.resizeResults(detections, displaySize)
      canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
      faceapi.draw.drawDetections(canvas,resizedDetections)
      resizedDetections.forEach(result => {
          const { age, gender, genderProbability } = result;
          new faceapi.draw.DrawTextField(
              [
                  `${Math.round(age, 0)} years`,
                  `${gender} (${Math.round(genderProbability)})`
              ],
              result.detection.box.bottomRight
          ).draw(canvas);
      });
  }, 100)
})