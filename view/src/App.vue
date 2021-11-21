<template>
	<div style="height: 100vh;">
		<div v-if="!showRoom"
			style="background:#eff0ff;font-size: 18px;display: flex;flex-direction: column;height: 100%;justify-content: center;align-items: center;">
			<div style="width:50%">房间ID：
				<a-input v-model="roomid" />
			</div>
			<div style="width:50%;padding: 20px 0;">你的名字：
				<a-input v-model="userName" />
			</div>
			<div style="width:50%;padding: 20px 0;">
				类型：
				<a-radio-group name="radioGroup" v-model="medias.type">
					<a-radio :value="'getUserMedia'">
						视频
					</a-radio>
					<a-radio :value="'getDisplayMedia'" style="margin-top:4px">
						分享
					</a-radio>
				</a-radio-group>
			</div>
			<div>
				<a-button type="primary" @click="enterRoom" :loading="loading">进入房间</a-button>
			</div>
		</div>
		<div v-else style="display: flex;height: 100%;">
			<div id="videoBox"></div>
			<div style="width:40%;display: flex;flex-direction: column;justify-content: space-between;">
				<div>
					<div
						style="display: flex;justify-content: space-between;font-size: 16px;padding: 10px;background: rgb(136 136 255 / 80%);color: #fff;">
						<div>聊天信息</div>
						<div style="cursor: pointer;" @click="closeRoom">
							<a-icon type="close-circle" />
						</div>
					</div>
					<div style="padding: 10px;">
						<div v-for="(item,index) in chatMsg" :key="'chat_text'+index">
							{{item}}
						</div>
					</div>
				</div>
				<div class="panel-bottom">
					<a-input-search v-model="textMsg" size="large" @search="sendTextMsg">
						<a-button slot="enterButton">
							发送
						</a-button>
					</a-input-search>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
	var chatSocket = null
	export default {
		data() {
			return {
				wsAddrs: 'ws://localhost:6860',
				localStream: null,
				showRoom: false,
				loading: false,
				medias: {
					/** navigator.mediaDevices.enumerateDevices()
					{
					    "audio": {
					        echoCancellation: boolean,
					        noiseSuppression: boolean
					    },  // 是否捕获音频
					    "video": {  // 视频相关设置
					        "width": {
					            "min": "381", // 当前视频的最小宽度
					            "max": "640" 
					        },
					        "height": {
					            "min": "200", // 最小高度
					            "max": "480"
					        },
					        "frameRate": {
					            "min": "28", // 最小帧率
					             "max": "10"
					        }
					    }
					}
					*/
					type: 'getUserMedia',
					getUserMedia: {
						"audio": true,
						"video": true
					},
					getDisplayMedia: {
						video: {
							cursor: 'always' | 'motion' | 'never',
							displaySurface: 'application' | 'browser' | 'monitor' | 'window'
						}
					}
				},
				peerList: {},
				chatMsg: [],
				textMsg: '',
				roomid: this.$route.query.room,
				userName: this.$route.query.name,
				userInfo: {}
			}
		},
		mounted() {

		},
		methods: {
			enterRoom() {
				if(!this.roomid || !this.userName) return
				this.loading = true
				this.websocketInit()
			},
			closeRoom() {
				this.localStream && this.localStream.getTracks && this.localStream.getTracks().forEach(track => track.stop())
				this.sendMessage({
					type: "unsubscribe",
					roomid: this.roomid,
					options: this.userInfo
				})
			},
			getUserMedia() {
				window.navigator.mediaDevices[this.medias.type](this.medias[this.medias.type]).then(localMediaStream => {
					this.localStream = localMediaStream
					this.showRoom = true
					this.loading = false
					this.$nextTick(()=>{
						this.addVideo('localVideo', this.userName, this.localStream)
						this.sendMessage({
							type: 'subscribe'
						})
					})
				}).catch(error => {
					this.loading = false
					console.log('获取本地摄像头失败：' + error);
					alert('视频流获取失败')
				})
			},
			addVideo(id, name, stream) {
				let video = document.querySelector('#' + id)
				if (video) {
					video.srcObject = stream
				} else {
					let div = document.createElement('div')
					let childrenDiv = document.createElement('div')
					childrenDiv.innerHTML = name
					video = document.createElement('video')
					video.autoplay = 'autoplay'
					video.controls = true
					video.srcObject = stream
					video.id = id
					div.append(video)
					div.append(childrenDiv)
					document.getElementById('videoBox').append(div)
				}
			},
			getPeerConnection(v) {
				console.log('getPeerConnection')
				let iceServer = {
					"iceServers": [
						// {
						//   "url": "stun:stun.l.google.com:19302"
						// }
					],
					sdpSemantics: 'plan-b'
				};
				// 创建
				var peer = new RTCPeerConnection(iceServer)
				//向 RTCPeerConnection 中加入需要发送的流
				peer.addStream(this.localStream)
				// 判断使用哪个方法监听流
				var hasAddTrack = (peer.addTrack !== undefined);
				if (hasAddTrack) {
					peer.ontrack = (event) => {
						this.addVideo('video' + v.account, v.userName, event.streams[0])
					}
				} else {
					peer.onaddstream = (event) => {
						this.addVideo('video' + v.account, v.userName, event.streams)
					}
				}
				//发送ICE候选到其他客户端
				peer.onicecandidate = (event) => {
					if (event.candidate) {
						this.sendMessage({
							type: '__ice_candidate',
							candidate: event.candidate,
							account: v.account
						});
					}
				}
				this.peerList[v.account] = peer
			},
			websocketInit() {
				chatSocket = new WebSocket(this.wsAddrs)
				// 监听消息
				chatSocket.onmessage = (evt) => {
					let msg = JSON.parse(evt.data)
					let options = msg.options || {}
					let data = options.roomInfo
					let who = options.who
					let dom = document.querySelector('#video' + [options._roomid, this.userInfo._roomid].sort().join(''))
					switch (msg.type) {
						case "inited":
							this.userInfo = options
							this.getUserMedia()
							break;
						case "subscribed":
							if (data.length > 1) {
								data.forEach(v => {
									let obj = {
										userName: v.userName
									}
									let arr = [v._roomid, this.userInfo._roomid]
									obj.account = arr.sort().join('')
									if (!this.peerList[obj.account] && v._roomid !== this.userInfo._roomid) {
										this.getPeerConnection(obj)
									}
								})
								// 当房间有人存在则向房间其它人发offer
								if (who._roomid === this.userInfo._roomid) {
									for (let k in this.peerList) {
										this.peerList[k].createOffer({
											offerToReceiveAudio: 1,
											offerToReceiveVideo: 1
										}).then((desc) => {
											this.peerList[k].setLocalDescription(desc, () => {
												this.sendMessage({
													type: 'video-offer',
													sdp: this.peerList[k].localDescription,
													account: k
												})
											})
										})
									}
								}
							}
							this.chatMsg.push(who.userName + ' 加入了房间')
							break;
						case "__ice_candidate":
							//如果是一个ICE的候选，则将其加入到PeerConnection中
							if (msg.candidate) {
								this.peerList[msg.account] && this.peerList[msg.account].addIceCandidate(msg.candidate)
									.catch(() => {});
							}
							break;
						case "error":
							alert(msg.msg)
							break;
						case "text":
							this.chatMsg.push(msg.userName + ': ' + msg.text)
							break;
							// 信令消息:这些消息用于在视频通话之前的谈判期间交换WebRTC信令信息。
						case "video-offer": // 发送 offer
							this.peerList[msg.account] && this.peerList[msg.account].setRemoteDescription(msg.sdp,
								() => {
									this.peerList[msg.account].createAnswer().then((desc) => {
										this.peerList[msg.account].setLocalDescription(desc, () => {
											this.sendMessage({
												type: 'video-answer',
												sdp: this.peerList[msg.account]
													.localDescription,
												account: msg.account
											})
										})
									})
								}, () => {})
							break;
						case "video-answer": // Callee已经答复了我们的报价
							this.peerList[msg.account] && this.peerList[msg.account].setRemoteDescription(msg.sdp,
								function() {}, () => {});
							break;
						case "disconnected":
						case "unsubscribed":
							if (this.userInfo._roomid == options._roomid) {
								document.getElementById('videoBox').innerHTML = ''
								this.showRoom = false
								return
							}
							if (dom) {
								dom.parentNode.remove()
								this.chatMsg.push(options.userName + ' 退出了房间')
							}
							break;
						default:
							console.log("未知的信息收到了:" + msg)
					}
				};
				//连接成功建立的回调方法
				chatSocket.onopen = () => {
					console.log("onopen")
					this.sendMessage({
						type: 'init',
						options: {
							userName: this.userName
						}
					})
				}
				//连接关闭的回调方法
				chatSocket.onclose = function() {
					chatSocket.close();
					console.log("websocket.onclose");
				}
				//连接发生错误的回调方法
				chatSocket.onerror = function() {
					this.loading = false
					console.log("chatSocket.error");
				};
				window.onbeforeunload = function() {
					chatSocket.close();
				}
			},
			sendMessage(msg) {
				msg.roomid = this.roomid;
				chatSocket.send(JSON.stringify(msg))
			},
			sendTextMsg() {
				if (this.textMsg) {
					this.sendMessage({
						type: 'text',
						userName: this.userName,
						text: this.textMsg
					});
					this.textMsg = ''
				}
			}
		}
	}
</script>
<style>
	#videoBox {
		width: 60%;
		border: 1px solid #d4d4d4;
		overflow-y: auto;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	#videoBox>div{
		width: 50%;
		position: relative;
	}
	#videoBox>div div{
		position: absolute;
		top: 0;
		font-size: 16px;
		background: rgba(217, 224, 216, 0.4);
		width: 100%;
		padding: 6px;
	}
	video {
		width: 100%
	}
</style>
